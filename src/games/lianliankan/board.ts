/**
 * 连连看的棋盘逻辑（纯函数，不碰 DOM）。
 * 1.1 把 1.0 内联在 index.ts 里的连线 / 重力 / 洗牌抽了出来，
 * 好让第 100–188 关的「逐关可解性」能在单测里真跑一遍自动玩家。
 *
 * 棋盘四周留一圈空边（padding），所以内圈 rows×cols 的格子坐标是 1..rows / 1..cols。
 */
import type { Gravity } from "./levels";

export type Pt = [number, number];

export interface BoardState {
  rows: number;
  cols: number;
  /** 含空边的实际行列数 */
  R: number;
  C: number;
  /** grid[r][c] < 0 表示空 */
  grid: number[][];
}

export interface BoardSpec {
  rows: number;
  cols: number;
  kinds: number;
  gravity: Gravity;
  /** 连线最多能拐几次弯（1.0 一律是 2，1.1 的「一拐直通道」是 1） */
  maxTurns: number;
}

/** 按 1.0 的老规矩发牌：同一图案成对出现，铺满内圈后整体洗一次 */
export function createBoard(spec: BoardSpec, rand: () => number): BoardState {
  const R = spec.rows + 2;
  const C = spec.cols + 2;
  const grid: number[][] = Array.from({ length: R }, () => new Array<number>(C).fill(-1));
  const total = spec.rows * spec.cols;
  const bag: number[] = [];
  let k = 0;
  while (bag.length < total) {
    bag.push(k % spec.kinds, k % spec.kinds);
    k++;
  }
  bag.length = total;
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  let bi = 0;
  for (let r = 1; r <= spec.rows; r++) for (let c = 1; c <= spec.cols; c++) grid[r][c] = bag[bi++];
  return { rows: spec.rows, cols: spec.cols, R, C, grid };
}

export function isEmpty(b: BoardState, r: number, c: number): boolean {
  return b.grid[r][c] < 0;
}

/** a 与 b 之间是不是一条没被挡住的直线（同行或同列） */
export function clearLine(b: BoardState, a: Pt, z: Pt): boolean {
  if (a[0] === z[0]) {
    const [lo, hi] = a[1] < z[1] ? [a[1], z[1]] : [z[1], a[1]];
    for (let c = lo + 1; c < hi; c++) if (!isEmpty(b, a[0], c)) return false;
    return true;
  }
  if (a[1] === z[1]) {
    const [lo, hi] = a[0] < z[0] ? [a[0], z[0]] : [z[0], a[0]];
    for (let r = lo + 1; r < hi; r++) if (!isEmpty(b, r, a[1])) return false;
    return true;
  }
  return false;
}

/**
 * 找一条最多拐 maxTurns 次的连线；找不到返回 null。
 * maxTurns=0 只走直线，1 只允许一个拐角，2 是 1.0 的老规则。
 */
export function findPath(b: BoardState, a: Pt, z: Pt, maxTurns = 2): Pt[] | null {
  if ((a[0] === z[0] || a[1] === z[1]) && clearLine(b, a, z)) return [a, z];
  if (maxTurns < 1) return null;
  const c1: Pt = [a[0], z[1]];
  if (isEmpty(b, c1[0], c1[1]) && clearLine(b, a, c1) && clearLine(b, c1, z)) return [a, c1, z];
  const c2: Pt = [z[0], a[1]];
  if (isEmpty(b, c2[0], c2[1]) && clearLine(b, a, c2) && clearLine(b, c2, z)) return [a, c2, z];
  if (maxTurns < 2) return null;
  for (let r = 0; r < b.R; r++) {
    if (r === a[0] || r === z[0]) continue;
    const p1: Pt = [r, a[1]];
    const p2: Pt = [r, z[1]];
    if (isEmpty(b, p1[0], p1[1]) && isEmpty(b, p2[0], p2[1]) &&
        clearLine(b, a, p1) && clearLine(b, p1, p2) && clearLine(b, p2, z)) {
      return [a, p1, p2, z];
    }
  }
  for (let c = 0; c < b.C; c++) {
    if (c === a[1] || c === z[1]) continue;
    const p1: Pt = [a[0], c];
    const p2: Pt = [z[0], c];
    if (isEmpty(b, p1[0], p1[1]) && isEmpty(b, p2[0], p2[1]) &&
        clearLine(b, a, p1) && clearLine(b, p1, p2) && clearLine(b, p2, z)) {
      return [a, p1, p2, z];
    }
  }
  return null;
}

/** 棋盘上剩下的格子数 */
export function tilesLeft(b: BoardState): number {
  let n = 0;
  for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) if (b.grid[r][c] >= 0) n++;
  return n;
}

/** 按图案分组，便于只在同图案之间找连线 */
function groupByKind(b: BoardState): Map<number, Pt[]> {
  const map = new Map<number, Pt[]>();
  for (let r = 0; r < b.R; r++) {
    for (let c = 0; c < b.C; c++) {
      const v = b.grid[r][c];
      if (v < 0) continue;
      const list = map.get(v);
      if (list) list.push([r, c]);
      else map.set(v, [[r, c]]);
    }
  }
  return map;
}

/** 现在还有没有能连的一对；有就返回那一对 */
export function anyMove(b: BoardState, maxTurns = 2): [Pt, Pt] | null {
  for (const list of groupByKind(b).values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (findPath(b, list[i], list[j], maxTurns)) return [list[i], list[j]];
      }
    }
  }
  return null;
}

export function removePair(b: BoardState, a: Pt, z: Pt): void {
  b.grid[a[0]][a[1]] = -1;
  b.grid[z[0]][z[1]] = -1;
}

/** 四向重力：消掉一对之后，剩下的图案往指定方向靠拢 */
export function applyGravity(b: BoardState, gravity: Gravity): void {
  if (gravity === "none") return;
  if (gravity === "down" || gravity === "up") {
    for (let c = 1; c <= b.cols; c++) {
      const vals: number[] = [];
      if (gravity === "down") {
        for (let r = b.rows; r >= 1; r--) if (b.grid[r][c] >= 0) vals.push(b.grid[r][c]);
        for (let r = b.rows, i = 0; r >= 1; r--, i++) b.grid[r][c] = i < vals.length ? vals[i] : -1;
      } else {
        for (let r = 1; r <= b.rows; r++) if (b.grid[r][c] >= 0) vals.push(b.grid[r][c]);
        for (let r = 1, i = 0; r <= b.rows; r++, i++) b.grid[r][c] = i < vals.length ? vals[i] : -1;
      }
    }
    return;
  }
  for (let r = 1; r <= b.rows; r++) {
    const vals: number[] = [];
    if (gravity === "left") {
      for (let c = 1; c <= b.cols; c++) if (b.grid[r][c] >= 0) vals.push(b.grid[r][c]);
      for (let c = 1, i = 0; c <= b.cols; c++, i++) b.grid[r][c] = i < vals.length ? vals[i] : -1;
    } else {
      for (let c = b.cols; c >= 1; c--) if (b.grid[r][c] >= 0) vals.push(b.grid[r][c]);
      for (let c = b.cols, i = 0; c >= 1; c--, i++) b.grid[r][c] = i < vals.length ? vals[i] : -1;
    }
  }
}

/** 风车旋转：整块内圈顺时针转 90°（只对正方形棋盘有意义） */
export function rotateBoard(b: BoardState): boolean {
  if (b.rows !== b.cols) return false;
  const n = b.rows;
  const next: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) next[i][j] = b.grid[n - j][i + 1];
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b.grid[i + 1][j + 1] = next[i][j];
  return true;
}

/** 洗牌：原地打乱剩下的图案，尽量洗出至少一步可走的局面 */
export function shuffleBoard(b: BoardState, rand: () => number, maxTurns = 2, tries = 40): boolean {
  const tiles: Pt[] = [];
  const values: number[] = [];
  for (let r = 0; r < b.R; r++) {
    for (let c = 0; c < b.C; c++) {
      if (b.grid[r][c] >= 0) {
        tiles.push([r, c]);
        values.push(b.grid[r][c]);
      }
    }
  }
  for (let guard = 0; guard < Math.max(1, tries); guard++) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    tiles.forEach(([r, c], i) => { b.grid[r][c] = values[i]; });
    if (anyMove(b, maxTurns)) return true;
  }
  return tilesLeft(b) === 0;
}

export interface SolveResult {
  cleared: boolean;
  moves: number;
  shufflesUsed: number;
  rotations: number;
  left: number;
}

export interface SolveOptions {
  /** 手上有几次洗牌（含自动洗牌） */
  shuffles: number;
  /** 连不动时的自动重排不计次（1.1 新场馆的规矩） */
  autoShuffleFree?: boolean;
  /** 自动重排的次数上限：超过它就认定这关是在原地打转 */
  autoShuffleCap?: number;
  /** 每走几步转一次棋盘（旋转章用，0 = 不转） */
  rotateEveryMoves?: number;
}

/**
 * 自动玩家：一直挑「找得到连线的一对」消掉，连不动就洗牌。
 * 全清返回 cleared=true——这就是第 100–188 关的可解性证明。
 */
export function solveBoard(spec: BoardSpec, rand: () => number, opts: SolveOptions): SolveResult {
  const board = createBoard(spec, rand);
  let shufflesUsed = 0;
  let moves = 0;
  let rotations = 0;
  const rotateEvery = opts.rotateEveryMoves ?? 0;
  const cap = opts.autoShuffleFree ? opts.autoShuffleCap ?? 200 : opts.shuffles;
  // 开局连不动就先免费洗一次，和真机行为保持一致
  if (!anyMove(board, spec.maxTurns)) shuffleBoard(board, rand, spec.maxTurns);
  while (tilesLeft(board) > 0) {
    const pair = anyMove(board, spec.maxTurns);
    if (!pair) {
      if (shufflesUsed >= cap) break;
      shufflesUsed++;
      shuffleBoard(board, rand, spec.maxTurns);
      continue;
    }
    removePair(board, pair[0], pair[1]);
    applyGravity(board, spec.gravity);
    moves++;
    if (rotateEvery > 0 && moves % rotateEvery === 0 && tilesLeft(board) > 0) {
      if (rotateBoard(board)) rotations++;
    }
  }
  return { cleared: tilesLeft(board) === 0, moves, shufflesUsed, rotations, left: tilesLeft(board) };
}

// ---------------------------------------------------------------------------
// 1.1 机制：图案会伪装
// ---------------------------------------------------------------------------

/** 伪装用的面具（棋盘上任何一套主题图案里都没有它，不会认错） */
export const MASK_FACE = "❓";

/**
 * 随机把一部分还在场上的格子盖上面具。
 * 只影响「看得见什么」，不影响哪两个能连——所以伪装永远不会把关卡变成死局。
 */
export function pickMasked(b: BoardState, ratio: number, rand: () => number): Set<string> {
  const out = new Set<string>();
  if (!(ratio > 0)) return out;
  const tiles: Pt[] = [];
  for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) if (b.grid[r][c] >= 0) tiles.push([r, c]);
  const want = Math.min(tiles.length, Math.round(tiles.length * Math.min(1, ratio)));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  for (let i = 0; i < want; i++) out.add(`${tiles[i][0]},${tiles[i][1]}`);
  return out;
}

export function maskKey(r: number, c: number): string {
  return `${r},${c}`;
}
