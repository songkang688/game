/**
 * 星星合成 · 棋盘规则(全部纯函数,不碰 DOM,可以在单测里随便跑)。
 *
 * 经典滑动合成的四条硬规则,这里一条不改:
 *  1. 一次滑动把所有方块沿方向推到不能再推;
 *  2. 相同数字相撞合并一次,得分加上新块的数字;
 *  3. 一次滑动里**新合成的块不能在同一回合再次合并**;
 *  4. 合并顺序沿移动方向从前往后(`2 2 2 2` 向左 → `4 4`,`4 2 2` 向左 → `4 4`)。
 *
 * 变体只加了一种格子:障碍花。它既不能移动也不能被滑进去,
 * 于是一行会被障碍花切成几段,每一段各自独立地滑与合。
 */

/** 空格 */
export const EMPTY = 0;
/** 障碍花:滑不进去也推不动,把一行切成几段 */
export const BLOCK = -1;

/** 棋盘是正方形的二维数组,`board[r][c]` 是第 r 行第 c 列 */
export type Board = number[][];

/** 四个方向 */
export type Dir = "left" | "right" | "up" | "down";

/** 遍历用的固定方向顺序(AI 的平局判定靠它保持确定性) */
export const DIRS: readonly Dir[] = ["left", "up", "right", "down"];

export const DIR_LABELS: Record<Dir, string> = {
  left: "左",
  right: "右",
  up: "上",
  down: "下"
};

/** 新块是 2 的概率,剩下的是 4(经典比例) */
export const SPAWN_TWO_RATE = 0.9;

// ---------------------------------------------------------------------------
// 确定性随机:同一个 seed 永远给出同一串数,关卡与对战才复现得出来
// ---------------------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 棋盘工具
// ---------------------------------------------------------------------------

export function createBoard(size: number): Board {
  const n = Math.max(2, Math.round(size));
  return Array.from({ length: n }, () => new Array<number>(n).fill(EMPTY));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function boardSize(board: Board): number {
  return board.length;
}

/** 从一串数字造盘面,长度不够补空格,方便测试里写死局面 */
export function boardFrom(rows: readonly (readonly number[])[]): Board {
  const n = Math.max(rows.length, ...rows.map((r) => r.length));
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => rows[r]?.[c] ?? EMPTY)
  );
}

/** 所有空格的坐标(障碍花不算空格) */
export function emptyCells(board: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === EMPTY) out.push([r, c]);
    }
  }
  return out;
}

/** 盘面上最大的数字(全空返回 0) */
export function maxTile(board: Board): number {
  let best = 0;
  for (const row of board) for (const v of row) if (v > best) best = v;
  return best;
}

/** 盘面上有没有这个数字 */
export function hasTile(board: Board, n: number): boolean {
  for (const row of board) for (const v of row) if (v === n) return true;
  return false;
}

/** 盘面上所有数字之和(不含障碍花) */
export function boardSum(board: Board): number {
  let s = 0;
  for (const row of board) for (const v of row) if (v > 0) s += v;
  return s;
}

/**
 * 蛇形遍历顺序:左上角起,一行一折。
 * 关卡开局的阶梯按这条蛇摆,AI 的位置权重也认这条蛇,两边说的是同一件事。
 */
export function snakeOrder(size: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let k = 0; k < size; k++) {
      out.push([r, r % 2 === 0 ? k : size - 1 - k]);
    }
  }
  return out;
}

export function sameBoard(a: Board, b: Board): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 单行滑动:整套规则的核心,四个方向都是把它转一转再调一次
// ---------------------------------------------------------------------------

/** 一块方块这一次滑动的行程;`mergedInto` 是 0 表示这一块没参与合并 */
export interface SlidePath {
  from: number;
  to: number;
  value: number;
  mergedInto: number;
}

export interface SlideResult {
  row: number[];
  moved: boolean;
  score: number;
  merges: number;
  /** 给动画用的行程表,顺序与合并顺序一致 */
  paths: SlidePath[];
}

/**
 * 把一行往下标小的方向滑(也就是「向左」)。
 * 障碍花把这一行切成几段,每段各自滑各自合,谁也越不过障碍花。
 */
export function slideRow(row: readonly number[]): SlideResult {
  const n = row.length;
  const out = row.slice();
  const paths: SlidePath[] = [];
  let score = 0;
  let merges = 0;

  const runSegment = (from: number, to: number): void => {
    const items: Array<{ v: number; at: number }> = [];
    for (let i = from; i < to; i++) if (row[i] > 0) items.push({ v: row[i], at: i });
    let write = from;
    let k = 0;
    while (k < items.length) {
      const cur = items[k];
      const next = items[k + 1];
      // 合并只发生在「相邻的两块」之间,合出来的新块这一回合就封住了,
      // 所以 k 直接跳过两块,不会出现 8 4 2 2 一路合成 16 的错误连锁
      if (next && next.v === cur.v) {
        const made = cur.v * 2;
        out[write] = made;
        score += made;
        merges += 1;
        paths.push({ from: cur.at, to: write, value: cur.v, mergedInto: made });
        paths.push({ from: next.at, to: write, value: next.v, mergedInto: made });
        k += 2;
      } else {
        out[write] = cur.v;
        paths.push({ from: cur.at, to: write, value: cur.v, mergedInto: 0 });
        k += 1;
      }
      write += 1;
    }
    for (let i = write; i < to; i++) out[i] = EMPTY;
  };

  let segStart = 0;
  for (let i = 0; i <= n; i++) {
    if (i === n || row[i] === BLOCK) {
      runSegment(segStart, i);
      segStart = i + 1;
    }
  }

  let moved = false;
  for (let i = 0; i < n; i++) {
    if (out[i] !== row[i]) {
      moved = true;
      break;
    }
  }
  return { row: out, moved, score, merges, paths };
}

// ---------------------------------------------------------------------------
// 四向滑动
// ---------------------------------------------------------------------------

/** 一块方块在盘面上的行程,给滑行 tween 用 */
export interface TilePath {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  value: number;
  /** 合并后的新数字;0 表示这一块只是滑了一段,没有合并 */
  mergedInto: number;
}

export interface MoveResult {
  board: Board;
  moved: boolean;
  score: number;
  merges: number;
  paths: TilePath[];
}

/** 某个方向上第 i 条线的第 k 格坐标(把四个方向统一成「往下标小的方向滑」) */
function cellOf(dir: Dir, size: number, line: number, k: number): [number, number] {
  switch (dir) {
    case "left":
      return [line, k];
    case "right":
      return [line, size - 1 - k];
    case "up":
      return [k, line];
    default:
      return [size - 1 - k, line];
  }
}

/** 把整盘按某个方向滑一次。不改原盘,返回新盘 */
export function move(board: Board, dir: Dir): MoveResult {
  const size = board.length;
  const next = cloneBoard(board);
  const paths: TilePath[] = [];
  let moved = false;
  let score = 0;
  let merges = 0;

  for (let line = 0; line < size; line++) {
    const strip = new Array<number>(size);
    for (let k = 0; k < size; k++) {
      const [r, c] = cellOf(dir, size, line, k);
      strip[k] = board[r][c];
    }
    const res = slideRow(strip);
    for (let k = 0; k < size; k++) {
      const [r, c] = cellOf(dir, size, line, k);
      next[r][c] = res.row[k];
    }
    for (const p of res.paths) {
      const [fr, fc] = cellOf(dir, size, line, p.from);
      const [tr, tc] = cellOf(dir, size, line, p.to);
      paths.push({ fromRow: fr, fromCol: fc, toRow: tr, toCol: tc, value: p.value, mergedInto: p.mergedInto });
    }
    if (res.moved) moved = true;
    score += res.score;
    merges += res.merges;
  }

  return { board: next, moved, score, merges, paths };
}

/** 这个方向推得动吗 */
export function canMoveDir(board: Board, dir: Dir): boolean {
  return move(board, dir).moved;
}

/** 还有一个方向能动就没结束 */
export function canMove(board: Board): boolean {
  for (const d of DIRS) if (canMoveDir(board, d)) return true;
  return false;
}

/** 现在还能动的方向 */
export function legalDirs(board: Board): Dir[] {
  return DIRS.filter((d) => canMoveDir(board, d));
}

// ---------------------------------------------------------------------------
// 生成新块
// ---------------------------------------------------------------------------

export interface SpawnResult {
  board: Board;
  row: number;
  col: number;
  value: number;
}

/** 掷一次骰子决定新块是 2 还是 4 */
export function spawnValue(rand: () => number): number {
  return rand() < SPAWN_TWO_RATE ? 2 : 4;
}

/**
 * 在随机空格放一个新块。没有空格就返回 null。
 * 注意:调用方只在「这一步真的发生了移动」之后才调它 —— 没动就不生成是经典规则。
 */
export function spawn(board: Board, rand: () => number): SpawnResult | null {
  const cells = emptyCells(board);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.min(cells.length - 1, Math.floor(rand() * cells.length))];
  const value = spawnValue(rand);
  const next = cloneBoard(board);
  next[r][c] = value;
  return { board: next, row: r, col: c, value };
}

// ---------------------------------------------------------------------------
// 一整个回合:滑一次 + 动了才生成
// ---------------------------------------------------------------------------

export interface TurnResult {
  board: Board;
  moved: boolean;
  score: number;
  merges: number;
  paths: TilePath[];
  /** 这一步生成的新块;没动就没有新块 */
  spawned: SpawnResult | null;
}

/**
 * 走一个完整回合。界面和 AI 模拟共用这一份,规则只写一遍。
 * **没有发生移动就不生成新块**,这是经典规则里最容易写错的一条。
 */
export function playTurn(board: Board, dir: Dir, rand: () => number): TurnResult {
  const res = move(board, dir);
  if (!res.moved) {
    return { board, moved: false, score: 0, merges: 0, paths: [], spawned: null };
  }
  const born = spawn(res.board, rand);
  return {
    board: born ? born.board : res.board,
    moved: true,
    score: res.score,
    merges: res.merges,
    paths: res.paths,
    spawned: born
  };
}

// ---------------------------------------------------------------------------
// 障碍花
// ---------------------------------------------------------------------------

export interface HazardSpec {
  /** 要变成障碍花的格子,写成 `row * size + col` 的平铺下标 */
  blocks: readonly number[];
}

/** 把 spec 里的空格换成障碍花;已经有数字的格子跳过,免得把开局摆好的阶梯吃掉 */
export function applyHazards(board: Board, spec: HazardSpec): Board {
  const size = board.length;
  const next = cloneBoard(board);
  for (const idx of spec.blocks) {
    if (!Number.isFinite(idx)) continue;
    const i = Math.round(idx);
    if (i < 0 || i >= size * size) continue;
    const r = Math.floor(i / size);
    const c = i % size;
    if (next[r][c] === EMPTY) next[r][c] = BLOCK;
  }
  return next;
}

/**
 * 按 seed 挑 count 个障碍花的位置(平铺下标,升序去重)。
 * 只挑「不在第一行第一列」的格子:左上角是阶梯的家,堵在那儿会把开局直接摆死。
 */
export function hazardCells(size: number, count: number, seed: number): number[] {
  const want = Math.max(0, Math.round(count));
  if (want === 0) return [];
  const rand = rng(seed);
  const pool: number[] = [];
  for (let r = 1; r < size; r++) {
    for (let c = 1; c < size; c++) pool.push(r * size + c);
  }
  const picked = new Set<number>();
  let guard = 0;
  while (picked.size < Math.min(want, pool.length) && guard < 500) {
    guard += 1;
    picked.add(pool[Math.floor(rand() * pool.length)]);
  }
  return Array.from(picked).sort((a, b) => a - b);
}
