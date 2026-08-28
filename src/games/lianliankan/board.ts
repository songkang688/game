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

/** 收拢时哪一格搬到了哪一格（1.2 靠它做滑动动画） */
export interface TileMove {
  from: Pt;
  to: Pt;
}

/** 一条线（一行或一列）上的格子按顺序收拢到 lane 的前面，返回搬家清单 */
function packLane(b: BoardState, lane: Pt[], startAt = 0): TileMove[] {
  const filled: Array<{ at: Pt; v: number }> = [];
  for (const [r, c] of lane) {
    if (b.grid[r][c] >= 0) filled.push({ at: [r, c], v: b.grid[r][c] });
  }
  for (const [r, c] of lane) b.grid[r][c] = -1;
  const moves: TileMove[] = [];
  filled.forEach((t, i) => {
    const to = lane[startAt + i];
    b.grid[to[0]][to[1]] = t.v;
    if (to[0] !== t.at[0] || to[1] !== t.at[1]) moves.push({ from: t.at, to });
  });
  return moves;
}

/**
 * 收拢：消掉一对之后剩下的图案往指定方向靠拢。
 * 1.2 补上「向中间」，并把搬家清单返回出去，好让 UI 一格一格滑过去而不是瞬移。
 */
export function applyGravity(b: BoardState, gravity: Gravity): TileMove[] {
  if (gravity === "none") return [];
  const moves: TileMove[] = [];
  if (gravity === "down" || gravity === "up") {
    for (let c = 1; c <= b.cols; c++) {
      const lane: Pt[] = [];
      if (gravity === "down") for (let r = b.rows; r >= 1; r--) lane.push([r, c]);
      else for (let r = 1; r <= b.rows; r++) lane.push([r, c]);
      moves.push(...packLane(b, lane));
    }
    return moves;
  }
  for (let r = 1; r <= b.rows; r++) {
    const lane: Pt[] = [];
    if (gravity === "right") for (let c = b.cols; c >= 1; c--) lane.push([r, c]);
    else for (let c = 1; c <= b.cols; c++) lane.push([r, c]);
    if (gravity === "center") {
      // 向中间：整行的图案挤成一段，居中摆放（多出来的一格靠左）
      let n = 0;
      for (let c = 1; c <= b.cols; c++) if (b.grid[r][c] >= 0) n++;
      moves.push(...packLane(b, lane, Math.floor((b.cols - n) / 2)));
    } else {
      moves.push(...packLane(b, lane));
    }
  }
  return moves;
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

/** 洗牌上限：洗满这么多次还是死局，就改用「保证可解的构造式重排」 */
export const SHUFFLE_TRIES = 50;

export interface ShuffleReport {
  /** 洗完之后场上一定至少有一对能连（空盘也算 ok） */
  ok: boolean;
  /** 随机洗了几次 */
  tries: number;
  /** 是不是动用了构造式重排 */
  constructed: boolean;
}

function collectTiles(b: BoardState): { tiles: Pt[]; values: number[] } {
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
  return { tiles, values };
}

/**
 * 构造式重排：不靠运气，直接算出一种「一定有得连」的摆法。
 *
 * 关键在于「哪两格连得上」只跟**哪些格子有人**有关，跟上面画的什么图案无关。
 * 所以先在现有的占位里找一对连得上的坐标，把同一种图案摆到这两格，
 * 剩下的随便填——这样摆出来的局面必然至少有一步可走。
 */
export function constructSolvable(b: BoardState, rand: () => number, maxTurns = 2): boolean {
  const { tiles, values } = collectTiles(b);
  if (tiles.length === 0) return true;
  let spot: [Pt, Pt] | null = null;
  for (let i = 0; i < tiles.length && !spot; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (findPath(b, tiles[i], tiles[j], maxTurns)) {
        spot = [tiles[i], tiles[j]];
        break;
      }
    }
  }
  // 连占位本身都两两不通，那是格子摆法的问题，换图案也救不回来
  if (!spot) return false;

  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let pick = -1;
  for (const [v, n] of count) if (n >= 2 && (pick < 0 || v < pick)) pick = v;
  if (pick < 0) return false;
  count.set(pick, (count.get(pick) as number) - 2);

  const rest: number[] = [];
  for (const [v, n] of count) for (let i = 0; i < n; i++) rest.push(v);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  const taken = new Set([`${spot[0][0]},${spot[0][1]}`, `${spot[1][0]},${spot[1][1]}`]);
  let ri = 0;
  for (const [r, c] of tiles) {
    b.grid[r][c] = taken.has(`${r},${c}`) ? pick : rest[ri++];
  }
  return anyMove(b, maxTurns) !== null;
}

/**
 * 公平洗牌：随机洗，每洗一次都校验「场上还有得连」，不满足就重洗；
 * 洗满 50 次仍然是死局才改用构造式重排。绝不会把孩子扔在一个走不动的盘面上。
 */
export function fairShuffle(
  b: BoardState,
  rand: () => number,
  maxTurns = 2,
  tries = SHUFFLE_TRIES
): ShuffleReport {
  const { tiles, values } = collectTiles(b);
  if (tiles.length === 0) return { ok: true, tries: 0, constructed: false };
  const limit = Math.max(0, tries);
  for (let n = 1; n <= limit; n++) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    tiles.forEach(([r, c], i) => {
      b.grid[r][c] = values[i];
    });
    if (anyMove(b, maxTurns)) return { ok: true, tries: n, constructed: false };
  }
  return { ok: constructSolvable(b, rand, maxTurns), tries: limit, constructed: true };
}

/** 洗牌：走公平洗牌那一套，洗完一定还有得连 */
export function shuffleBoard(b: BoardState, rand: () => number, maxTurns = 2, tries = SHUFFLE_TRIES): boolean {
  return fairShuffle(b, rand, maxTurns, tries).ok;
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
// （面具的脸由 art.ts 的 maskFaceSvg() 自绘;1.1 的 emoji 面具常量已随 SVG 化退役）
// ---------------------------------------------------------------------------

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
