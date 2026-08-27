/**
 * 围子花园 · 棋盘与连通块
 *
 * 棋盘是一维 Int8Array,下标 `i = y * size + x`,左上角是 (0,0)。
 * 这里只放「盘面长什么样」的纯数据操作:邻点、连通块、气、盘面指纹。
 * 规则判定(自杀、劫、超劫)在 rules.ts,计分在 score.ts,死活在 life.ts。
 */

/** 空点 */
export const EMPTY = 0;
/** 黑子,鸭梨执黑 */
export const BLACK = 1;
/** 白子,康康执白 */
export const WHITE = 2;

export type Color = 1 | 2;
export type Cell = 0 | 1 | 2;

/** 三种路数:九路花园 / 十三路原野 / 十九路星空 */
export type BoardSize = 9 | 13 | 19;
export const BOARD_SIZES: readonly BoardSize[] = [9, 13, 19];

export const SIZE_LABELS: Record<BoardSize, string> = {
  9: "九路花园",
  13: "十三路原野",
  19: "十九路星空"
};

export interface Board {
  readonly size: number;
  readonly cells: Int8Array;
}

/** 一块同色连通块 */
export interface Group {
  color: Color;
  /** 组成这块棋的所有点(升序) */
  stones: number[];
  /** 这块棋的气(升序、去重) */
  liberties: number[];
}

/** 换手:黑 ↔ 白 */
export function other(color: Color): Color {
  return color === BLACK ? WHITE : BLACK;
}

/** 颜色的中文名字(界面与提示语共用,黑=鸭梨、白=康康) */
export function colorName(color: Color): string {
  return color === BLACK ? "鸭梨（黑）" : "康康（白）";
}

export function createBoard(size: number): Board {
  return { size, cells: new Int8Array(size * size) };
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: Int8Array.from(board.cells) };
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function pointOf(size: number, x: number, y: number): number {
  return y * size + x;
}

export function xOf(size: number, pt: number): number {
  return pt % size;
}

export function yOf(size: number, pt: number): number {
  return Math.floor(pt / size);
}

export function xy(size: number, pt: number): { x: number; y: number } {
  return { x: pt % size, y: Math.floor(pt / size) };
}

export function get(board: Board, pt: number): Cell {
  return board.cells[pt] as Cell;
}

/** 落一颗子(会改动传入的棋盘,内部与模拟用;对外请走 rules.play) */
export function setCell(board: Board, pt: number, cell: Cell): void {
  board.cells[pt] = cell;
}

// ---------------------------------------------------------------------------
// 邻点表:同一路数只算一次,后面所有搜索都直接查表
// ---------------------------------------------------------------------------

const NEIGHBOR_CACHE = new Map<number, number[][]>();
const DIAGONAL_CACHE = new Map<number, number[][]>();

/** 每个点的正交邻点表(4 邻,边角会少) */
export function neighborTable(size: number): number[][] {
  const hit = NEIGHBOR_CACHE.get(size);
  if (hit) return hit;
  const table: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const list: number[] = [];
      if (y > 0) list.push(pointOf(size, x, y - 1));
      if (x > 0) list.push(pointOf(size, x - 1, y));
      if (x < size - 1) list.push(pointOf(size, x + 1, y));
      if (y < size - 1) list.push(pointOf(size, x, y + 1));
      table.push(list);
    }
  }
  NEIGHBOR_CACHE.set(size, table);
  return table;
}

/** 每个点的斜邻点表(真眼判定要看斜角) */
export function diagonalTable(size: number): number[][] {
  const hit = DIAGONAL_CACHE.get(size);
  if (hit) return hit;
  const table: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const list: number[] = [];
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(size, nx, ny)) list.push(pointOf(size, nx, ny));
      }
      table.push(list);
    }
  }
  DIAGONAL_CACHE.set(size, table);
  return table;
}

export function neighbors(size: number, pt: number): number[] {
  return neighborTable(size)[pt] ?? [];
}

export function diagonals(size: number, pt: number): number[] {
  return diagonalTable(size)[pt] ?? [];
}

/** 一个点还剩几口气(空点返回 0) */
export function libertyCount(board: Board, pt: number): number {
  const g = groupAt(board, pt);
  return g ? g.liberties.length : 0;
}

// ---------------------------------------------------------------------------
// 连通块与气
// ---------------------------------------------------------------------------

/**
 * pt 所在的同色连通块与它的气。pt 是空点时返回 null。
 * 用显式栈做洪水填充,19 路 361 点也不会爆调用栈。
 */
export function groupAt(board: Board, pt: number): Group | null {
  const color = board.cells[pt];
  if (color === EMPTY) return null;
  const table = neighborTable(board.size);
  const seen = new Uint8Array(board.cells.length);
  const libSeen = new Uint8Array(board.cells.length);
  const stones: number[] = [];
  const liberties: number[] = [];
  const stack = [pt];
  seen[pt] = 1;
  while (stack.length) {
    const cur = stack.pop() as number;
    stones.push(cur);
    for (const n of table[cur]) {
      const c = board.cells[n];
      if (c === EMPTY) {
        if (!libSeen[n]) {
          libSeen[n] = 1;
          liberties.push(n);
        }
      } else if (c === color && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  stones.sort((a, b) => a - b);
  liberties.sort((a, b) => a - b);
  return { color: color as Color, stones, liberties };
}

/** 盘面上所有连通块(每块只出现一次) */
export function groups(board: Board): Group[] {
  const seen = new Uint8Array(board.cells.length);
  const out: Group[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === EMPTY || seen[i]) continue;
    const g = groupAt(board, i);
    if (!g) continue;
    for (const s of g.stones) seen[s] = 1;
    out.push(g);
  }
  return out;
}

/** 某一串子的气(传进来的点必须同色相连;空数组返回空数组) */
export function liberties(board: Board, group: readonly number[]): number[] {
  const table = neighborTable(board.size);
  const seen = new Uint8Array(board.cells.length);
  const out: number[] = [];
  for (const s of group) {
    for (const n of table[s]) {
      if (board.cells[n] === EMPTY && !seen[n]) {
        seen[n] = 1;
        out.push(n);
      }
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

/** 某一方在盘上的子数 */
export function stoneCount(board: Board, color: Color): number {
  let n = 0;
  for (let i = 0; i < board.cells.length; i++) if (board.cells[i] === color) n++;
  return n;
}

/** 盘上所有空点 */
export function emptyPoints(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.cells.length; i++) if (board.cells[i] === EMPTY) out.push(i);
  return out;
}

// ---------------------------------------------------------------------------
// 盘面指纹:超劫历史与测试都靠它
// ---------------------------------------------------------------------------

const HASH_CHARS = [".", "X", "O"];

/**
 * 盘面指纹。`turn` 不传就是「只看棋子摆位」的位置超劫指纹;
 * 传了轮到谁走就是「连轮次一起看」的状态超劫指纹。
 * 本作超劫用的是不带 turn 的那一种(位置超劫)。
 */
export function positionHash(board: Board, turn?: Color): string {
  let s = `${board.size}:`;
  for (let i = 0; i < board.cells.length; i++) s += HASH_CHARS[board.cells[i]];
  return turn === undefined ? s : `${s}@${turn}`;
}

// ---------------------------------------------------------------------------
// 文本盘面:关卡表、测试与调试都用这个格式
// `.` 空点、`X` 黑(鸭梨)、`O` 白(康康)
// ---------------------------------------------------------------------------

export function parseRows(rows: readonly string[]): Board {
  const cleaned = rows.map((r) => r.replace(/\s+/g, ""));
  const size = cleaned.length;
  const board = createBoard(size);
  for (let y = 0; y < size; y++) {
    const row = cleaned[y] ?? "";
    for (let x = 0; x < size; x++) {
      const ch = row[x] ?? ".";
      board.cells[pointOf(size, x, y)] = ch === "X" || ch === "x" ? BLACK : ch === "O" || ch === "o" ? WHITE : EMPTY;
    }
  }
  return board;
}

export function formatRows(board: Board): string[] {
  const out: string[] = [];
  for (let y = 0; y < board.size; y++) {
    let row = "";
    for (let x = 0; x < board.size; x++) row += HASH_CHARS[board.cells[pointOf(board.size, x, y)]];
    out.push(row);
  }
  return out;
}

/** 坐标名:列用 A..T(跳过容易看错的 I),行从下往上数,和棋谱习惯一致 */
const COLUMN_LETTERS = "ABCDEFGHJKLMNOPQRST";

export function coordLabel(size: number, pt: number): string {
  const { x, y } = xy(size, pt);
  return `${COLUMN_LETTERS[x] ?? "?"}${size - y}`;
}

/**
 * 星位。9 路四个小目加天元,13 / 19 路按常见摆法。
 * 让子也摆在这些点上。
 */
export function starPoints(size: number): number[] {
  const table: Record<number, Array<[number, number]>> = {
    9: [
      [2, 2],
      [6, 2],
      [2, 6],
      [6, 6],
      [4, 4]
    ],
    13: [
      [3, 3],
      [9, 3],
      [3, 9],
      [9, 9],
      [6, 6]
    ],
    19: [
      [3, 3],
      [9, 3],
      [15, 3],
      [3, 9],
      [9, 9],
      [15, 9],
      [3, 15],
      [9, 15],
      [15, 15]
    ]
  };
  return (table[size] ?? []).map(([x, y]) => pointOf(size, x, y));
}

/**
 * 让 n 子摆在哪几个点上(角上先摆,再摆边)。
 * 9 路支持让 2 / 3 子,13 / 19 路最多让 4 子,超出就夹到上限。
 */
export function handicapPoints(size: number, n: number): number[] {
  if (!Number.isFinite(n) || n < 2) return [];
  const stars = starPoints(size);
  // 角上四个点的顺序:右上、左下、右下、左上,和习惯的让子顺序一致
  const corners: Record<number, number[]> = {
    9: [pointOf(9, 6, 2), pointOf(9, 2, 6), pointOf(9, 6, 6), pointOf(9, 2, 2)],
    13: [pointOf(13, 9, 3), pointOf(13, 3, 9), pointOf(13, 9, 9), pointOf(13, 3, 3)],
    19: [pointOf(19, 15, 3), pointOf(19, 3, 15), pointOf(19, 15, 15), pointOf(19, 3, 3)]
  };
  const order = corners[size] ?? stars;
  return order.slice(0, Math.min(Math.floor(n), 4));
}
