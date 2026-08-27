/**
 * 翻翻暗棋 · 棋盘与洗子。
 *
 * 4 行 × 8 列共 32 格，两色各 16 枚，开局全部盖着。
 * 这一层只管「棋盘长什么样、子怎么摆」，规则在 `rules.ts`。
 */

export const ROWS = 4;
export const COLS = 8;
export const CELLS = ROWS * COLS;

export type Color = "red" | "blue";

/** 棋子种类。名字沿用大家熟悉的中国象棋兵种，但这一款是「翻翻暗棋」玩法 */
export type Kind = "general" | "guard" | "elephant" | "chariot" | "horse" | "cannon" | "soldier";

export const KINDS: readonly Kind[] = ["general", "guard", "elephant", "chariot", "horse", "cannon", "soldier"];

/** 相克次序：将 > 士 > 象 > 车 > 马 > 炮 > 兵 */
export const RANK: Record<Kind, number> = {
  general: 7,
  guard: 6,
  elephant: 5,
  chariot: 4,
  horse: 3,
  cannon: 2,
  soldier: 1,
};

/** 每色各有几枚 */
export const COUNT: Record<Kind, number> = {
  general: 1,
  guard: 2,
  elephant: 2,
  chariot: 2,
  horse: 2,
  cannon: 2,
  soldier: 5,
};

export const RED_LABEL: Record<Kind, string> = {
  general: "帅",
  guard: "仕",
  elephant: "相",
  chariot: "俥",
  horse: "傌",
  cannon: "炮",
  soldier: "兵",
};

export const BLUE_LABEL: Record<Kind, string> = {
  general: "将",
  guard: "士",
  elephant: "象",
  chariot: "車",
  horse: "馬",
  cannon: "砲",
  soldier: "卒",
};

export function labelOf(color: Color, kind: Kind): string {
  return color === "red" ? RED_LABEL[kind] : BLUE_LABEL[kind];
}

export interface Piece {
  color: Color;
  kind: Kind;
  /** 还盖着（谁都看不见是什么） */
  covered: boolean;
}

/** 一格：null 表示空格（棋子已经去休息了或者走开了） */
export type Cell = Piece | null;

export function rowOf(i: number): number {
  return Math.floor(i / COLS);
}

export function colOf(i: number): number {
  return i % COLS;
}

export function indexOf(r: number, c: number): number {
  return r * COLS + c;
}

export function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 上下左右四个邻格（越界的不给） */
export function neighbors(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  const out: number[] = [];
  if (onBoard(r - 1, c)) out.push(indexOf(r - 1, c));
  if (onBoard(r + 1, c)) out.push(indexOf(r + 1, c));
  if (onBoard(r, c - 1)) out.push(indexOf(r, c - 1));
  if (onBoard(r, c + 1)) out.push(indexOf(r, c + 1));
  return out;
}

/** 同一行或同一列（炮要用） */
export function sameLine(a: number, b: number): boolean {
  return rowOf(a) === rowOf(b) || colOf(a) === colOf(b);
}

/** a 与 b 之间（不含两端）的格子下标，必须同行或同列 */
export function between(a: number, b: number): number[] {
  if (a === b) return [];
  const out: number[] = [];
  if (rowOf(a) === rowOf(b)) {
    const r = rowOf(a);
    const lo = Math.min(colOf(a), colOf(b));
    const hi = Math.max(colOf(a), colOf(b));
    for (let c = lo + 1; c < hi; c++) out.push(indexOf(r, c));
    return out;
  }
  if (colOf(a) === colOf(b)) {
    const c = colOf(a);
    const lo = Math.min(rowOf(a), rowOf(b));
    const hi = Math.max(rowOf(a), rowOf(b));
    for (let r = lo + 1; r < hi; r++) out.push(indexOf(r, c));
    return out;
  }
  return out;
}

/** 32 枚棋子（还没洗） */
export function fullSet(): Piece[] {
  const out: Piece[] = [];
  for (const color of ["red", "blue"] as Color[]) {
    for (const kind of KINDS) {
      for (let i = 0; i < COUNT[kind]; i++) out.push({ color, kind, covered: true });
    }
  }
  return out;
}

/** 固定 seed 的随机数，保证同一关每次开出来一样 */
export function rand01(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i + 5, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** 洗子发盘：32 枚全部盖着铺满 4×8 */
export function dealCovered(seed: number): Cell[] {
  const deck = fullSet();
  // Fisher–Yates，随机源是固定 seed
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand01(seed, i) * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  return deck;
}

export function cloneCells(cells: readonly Cell[]): Cell[] {
  return cells.map((c) => (c ? { ...c } : null));
}
