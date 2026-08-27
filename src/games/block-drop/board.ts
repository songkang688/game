/**
 * 方块叠叠乐 · 场地(纯函数)。
 * 场地是一个二维数组,0 表示空格,其他数字表示某种颜色的砖。
 * 可见区 10 列 × 20 行,上面再留 2 行缓冲给刚出生的块。
 */
import { cellsFor, type Cell, type PieceId, type Rot } from "./pieces";

export const COLS = 10;
/** 可见行数 */
export const VISIBLE_ROWS = 20;
/** 顶上给新块留的缓冲行 */
export const BUFFER_ROWS = 2;
export const ROWS = VISIBLE_ROWS + BUFFER_ROWS;
/** 垃圾行用的颜色编号,和七种块区分开 */
export const GARBAGE_CELL = 8;

export type Board = number[][];

export function createBoard(rows = ROWS, cols = COLS): Board {
  const out: Board = [];
  for (let r = 0; r < rows; r++) out.push(new Array<number>(cols).fill(0));
  return out;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** 把方框坐标换成场地坐标 */
export function absCells(cells: readonly Cell[], x: number, y: number): Cell[] {
  return cells.map((c) => ({ x: c.x + x, y: c.y + y }));
}

/**
 * 会不会撞:出左右边界、掉出底、或者压到已有的砖都算撞。
 * 顶上的缓冲行是允许的,所以 y 为负只在超出缓冲区时才算撞。
 */
export function collides(board: Board, cells: readonly Cell[], x: number, y: number): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? COLS;
  for (const c of cells) {
    const cx = c.x + x;
    const cy = c.y + y;
    if (cx < 0 || cx >= cols) return true;
    if (cy >= rows) return true;
    if (cy < 0) continue; // 还在缓冲区上方,先不判
    if (board[cy][cx] !== 0) return true;
  }
  return false;
}

/** 把块钉进场地,返回新场地(不改原来的) */
export function lockPiece(board: Board, cells: readonly Cell[], x: number, y: number, color: number): Board {
  const out = cloneBoard(board);
  for (const c of cells) {
    const cx = c.x + x;
    const cy = c.y + y;
    if (cy < 0 || cy >= out.length || cx < 0 || cx >= out[0].length) continue;
    out[cy][cx] = color;
  }
  return out;
}

/** 硬降落点:一直往下挪到再挪就撞为止 */
export function dropPosition(board: Board, cells: readonly Cell[], x: number, y: number): number {
  let ny = y;
  let guard = 0;
  while (!collides(board, cells, x, ny + 1) && guard < board.length + 8) {
    ny += 1;
    guard += 1;
  }
  return ny;
}

/** 这一行满了没有 */
export function rowFull(board: Board, r: number): boolean {
  const row = board[r];
  if (!row) return false;
  return row.every((v) => v !== 0);
}

/** 现在有哪几行是满的(从上往下的下标) */
export function fullRows(board: Board): number[] {
  const out: number[] = [];
  for (let r = 0; r < board.length; r++) if (rowFull(board, r)) out.push(r);
  return out;
}

export interface ClearResult {
  board: Board;
  /** 被消掉的行下标 */
  rows: number[];
  count: number;
}

/**
 * 消行:满的那几行拿掉,上面的整体塌下来,顶上补空行。
 * 一次消好几行也保持从上到下的相对顺序。
 */
export function clearLines(board: Board): ClearResult {
  const rows = fullRows(board);
  if (rows.length === 0) return { board: cloneBoard(board), rows, count: 0 };
  const cols = board[0]?.length ?? COLS;
  const keep = board.filter((_, r) => !rows.includes(r)).map((row) => [...row]);
  const out: Board = [];
  for (let i = 0; i < rows.length; i++) out.push(new Array<number>(cols).fill(0));
  out.push(...keep);
  return { board: out, rows, count: rows.length };
}

/**
 * 垃圾行:从底下升起来,每一条都留一个洞,同一波的洞在同一列。
 */
export function addGarbage(board: Board, lines: number, holeCol: number): Board {
  const n = Math.max(0, Math.round(lines));
  if (n === 0) return cloneBoard(board);
  const cols = board[0]?.length ?? COLS;
  const hole = ((Math.round(holeCol) % cols) + cols) % cols;
  const rest = cloneBoard(board).slice(n);
  const rows: Board = [];
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(cols).fill(GARBAGE_CELL);
    row[hole] = 0;
    rows.push(row);
  }
  return [...rest, ...rows];
}

/** 新块一出生就被占住 → 这一局结束 */
export function isTopOut(board: Board, id: PieceId, rot: Rot, x: number, y: number): boolean {
  return collides(board, cellsFor(id, rot), x, y);
}

/** 每一列的高度(从底往上数到最高的那块砖) */
export function columnHeights(board: Board): number[] {
  const rows = board.length;
  const cols = board[0]?.length ?? COLS;
  const out = new Array<number>(cols).fill(0);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (board[r][c] !== 0) {
        out[c] = rows - r;
        break;
      }
    }
  }
  return out;
}

/** 有砖压着的空格 = 洞,洞越少越好 */
export function countHoles(board: Board): number {
  const rows = board.length;
  const cols = board[0]?.length ?? COLS;
  let holes = 0;
  for (let c = 0; c < cols; c++) {
    let seen = false;
    for (let r = 0; r < rows; r++) {
      if (board[r][c] !== 0) seen = true;
      else if (seen) holes += 1;
    }
  }
  return holes;
}

/** 相邻列的高度差之和,越平越好铺 */
export function bumpiness(board: Board): number {
  const h = columnHeights(board);
  let out = 0;
  for (let i = 1; i < h.length; i++) out += Math.abs(h[i] - h[i - 1]);
  return out;
}

/** 每一列比两边矮多少 —— 井越深越适合插长条 */
export function wellDepths(board: Board): number[] {
  const h = columnHeights(board);
  return h.map((v, i) => {
    const left = i === 0 ? Number.POSITIVE_INFINITY : h[i - 1];
    const right = i === h.length - 1 ? Number.POSITIVE_INFINITY : h[i + 1];
    const side = Math.min(left, right);
    return Number.isFinite(side) ? Math.max(0, side - v) : Math.max(0, (i === 0 ? h[1] ?? 0 : h[h.length - 2] ?? 0) - v);
  });
}

/** 最高的那一列有多高 */
export function maxHeight(board: Board): number {
  return columnHeights(board).reduce((a, b) => Math.max(a, b), 0);
}

/** 场上一共多少块砖 */
export function filledCount(board: Board): number {
  let n = 0;
  for (const row of board) for (const v of row) if (v !== 0) n += 1;
  return n;
}

/**
 * 从「每行缺哪几列」的写法造一块场地,写关卡初始堆形很方便。
 * rows 是从底往上数的,rows[0] 是最底下那一行。
 */
export function buildBoard(rows: readonly (readonly number[])[], height = ROWS, cols = COLS): Board {
  const board = createBoard(height, cols);
  rows.forEach((missing, i) => {
    const r = height - 1 - i;
    if (r < 0) return;
    for (let c = 0; c < cols; c++) board[r][c] = missing.includes(c) ? 0 : GARBAGE_CELL;
  });
  return board;
}
