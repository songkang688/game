/**
 * 星星合成 · 四档假人(纯函数,不碰 DOM)。
 *
 * | 档 | 行为 |
 * | --- | --- |
 * | 菜鸟 | 在能动的方向里随便挑一个 |
 * | 普通 | 贪心:选本步得分最高的方向 |
 * | 高手 | 一层前瞻,按「空格数 + 单调性 + 平滑度 + 蛇形位置」加权评估 |
 * | 地狱 | 期望最大搜索 2–3 层,把新块随机落在哪儿也一并算进去 |
 *
 * 搜索跑在一份「指数盘面」上:0 是空格,-1 是障碍花,k ≥ 1 表示数字 2^k。
 * 这样合并就是 k+1,评估里的 log2 直接读出来,而且整份盘面装得进一条 Int32Array,
 * 递归时来回复用同几条缓冲,不产生垃圾 —— 地狱档一步要展开上千个局面,
 * 用二维数组加 slice 会慢到没法在单测里跑完 188 关。
 */
import { BLOCK, DIRS, emptyCells, type Board, type Dir } from "./board";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export const AI_TIER_BLURBS: Record<AiTier, string> = {
  rookie: "随便挑一个方向,想到哪儿滑到哪儿",
  normal: "只看这一步哪个方向合得多",
  pro: "会把大数字压在角落里,盘面排得很整齐",
  hell: "往后想两三步,连新块会落在哪儿都算过了"
};

// ---------------------------------------------------------------------------
// 指数盘面
// ---------------------------------------------------------------------------

/** 障碍花在指数盘面里的记号 */
const CODE_BLOCK = -1;

/** 二维盘面 → 指数盘面 */
export function toCodes(board: Board): Int32Array {
  const size = board.length;
  const out = new Int32Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r][c];
      out[r * size + c] = v === BLOCK ? CODE_BLOCK : v > 0 ? Math.round(Math.log2(v)) : 0;
    }
  }
  return out;
}

const idxCache = new Map<string, Int32Array>();

/** 「第 line 条线的第 k 格」在指数盘面里的下标(四个方向统一成往 k 小的方向滑) */
function dirIndex(size: number, dir: Dir): Int32Array {
  const key = `${size}:${dir}`;
  const hit = idxCache.get(key);
  if (hit) return hit;
  const table = new Int32Array(size * size);
  for (let line = 0; line < size; line++) {
    for (let k = 0; k < size; k++) {
      let r: number;
      let c: number;
      if (dir === "left") {
        r = line;
        c = k;
      } else if (dir === "right") {
        r = line;
        c = size - 1 - k;
      } else if (dir === "up") {
        r = k;
        c = line;
      } else {
        r = size - 1 - k;
        c = line;
      }
      table[line * size + k] = r * size + c;
    }
  }
  idxCache.set(key, table);
  return table;
}

const weightCache = new Map<number, Float64Array>();

/** 蛇形位置权重:左上角起、一行一折,越靠近起点权重越高 */
function snakeWeights(size: number): Float64Array {
  const hit = weightCache.get(size);
  if (hit) return hit;
  const w = new Float64Array(size * size);
  const total = size * size;
  let i = 0;
  for (let r = 0; r < size; r++) {
    for (let k = 0; k < size; k++) {
      const c = r % 2 === 0 ? k : size - 1 - k;
      w[r * size + c] = (total - i) / total;
      i += 1;
    }
  }
  weightCache.set(size, w);
  return w;
}

const gather = new Int32Array(16);

/**
 * 指数盘面滑一次,结果写进 out。
 * 返回本次合并的得分;**没动返回 -1**(和「动了但一次也没合」的 0 区分开)。
 * 障碍花(-1)把一条线切成几段,每段各自滑各自合。
 */
function slideCodes(src: Int32Array, size: number, dir: Dir, out: Int32Array): number {
  const idx = dirIndex(size, dir);
  out.set(src);
  let moved = false;
  let score = 0;
  for (let line = 0; line < size; line++) {
    const base = line * size;
    let segStart = 0;
    for (let i = 0; i <= size; i++) {
      const code = i < size ? src[idx[base + i]] : CODE_BLOCK;
      if (i < size && code !== CODE_BLOCK) continue;
      let cnt = 0;
      for (let j = segStart; j < i; j++) {
        const v = src[idx[base + j]];
        if (v > 0) gather[cnt++] = v;
      }
      let write = segStart;
      let k = 0;
      while (k < cnt) {
        let put = gather[k];
        // 合出来的新块这一回合就封住了,k 直接跳过两块
        if (k + 1 < cnt && gather[k + 1] === put) {
          put += 1;
          score += 2 ** put;
          k += 2;
        } else {
          k += 1;
        }
        const at = idx[base + write];
        if (out[at] !== put) {
          out[at] = put;
          moved = true;
        }
        write += 1;
      }
      for (let j = write; j < i; j++) {
        const at = idx[base + j];
        if (out[at] !== 0) {
          out[at] = 0;
          moved = true;
        }
      }
      segStart = i + 1;
    }
  }
  return moved ? score : -1;
}

// ---------------------------------------------------------------------------
// 评估函数
// ---------------------------------------------------------------------------

/** 评估函数各项的权重,单测拿它钉住配方 */
export const EVAL_WEIGHTS = {
  empty: 2.7,
  monotonicity: 1.5,
  smoothness: 0.2,
  snake: 0.4,
  corner: 4
};

/** 空格数(障碍花不算空格) */
export function emptyCount(board: Board): number {
  return emptyCells(board).length;
}

/**
 * 平滑度:相邻两块的数字差得越少越好。返回值 ≤ 0,越接近 0 越平滑。
 * 空格跳过 —— 隔着空格的两块迟早要撞上,差距一样得算。
 */
export function smoothness(board: Board): number {
  return smoothCodes(toCodes(board), board.length);
}

function smoothCodes(g: Int32Array, size: number): number {
  let total = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const here = g[r * size + c];
      if (here <= 0) continue;
      for (let d = 0; d < 2; d++) {
        const dr = d === 0 ? 0 : 1;
        const dc = d === 0 ? 1 : 0;
        let rr = r + dr;
        let cc = c + dc;
        while (rr < size && cc < size && g[rr * size + cc] === 0) {
          rr += dr;
          cc += dc;
        }
        if (rr >= size || cc >= size) continue;
        const nb = g[rr * size + cc];
        if (nb <= 0) continue;
        total -= Math.abs(here - nb);
      }
    }
  }
  return total;
}

/**
 * 单调性:一行(一列)的数字最好一路变大或者一路变小,别忽大忽小。
 * 返回值 ≤ 0,越接近 0 越单调。
 */
export function monotonicity(board: Board): number {
  return monoCodes(toCodes(board), board.length);
}

function monoCodes(g: Int32Array, size: number): number {
  let up = 0;
  let down = 0;
  let leftward = 0;
  let rightward = 0;

  for (let c = 0; c < size; c++) {
    let current = 0;
    let next = 1;
    while (next < size) {
      while (next < size && g[next * size + c] <= 0) next += 1;
      if (next >= size) next -= 1;
      const a = Math.max(0, g[current * size + c]);
      const b = Math.max(0, g[next * size + c]);
      if (a > b) up += b - a;
      else if (b > a) down += a - b;
      current = next;
      next += 1;
    }
  }
  for (let r = 0; r < size; r++) {
    let current = 0;
    let next = 1;
    while (next < size) {
      while (next < size && g[r * size + next] <= 0) next += 1;
      if (next >= size) next -= 1;
      const a = Math.max(0, g[r * size + current]);
      const b = Math.max(0, g[r * size + next]);
      if (a > b) leftward += b - a;
      else if (b > a) rightward += a - b;
      current = next;
      next += 1;
    }
  }
  return Math.max(up, down) + Math.max(leftward, rightward);
}

/** 蛇形位置分:大数字越靠近左上角越高 */
export function snakeScore(board: Board): number {
  return snakeCodes(toCodes(board), board.length);
}

function snakeCodes(g: Int32Array, size: number): number {
  const w = snakeWeights(size);
  let total = 0;
  for (let i = 0; i < g.length; i++) {
    if (g[i] > 0) total += w[i] * g[i];
  }
  return total;
}

function evalCodes(g: Int32Array, size: number): number {
  let empty = 0;
  let best = 0;
  for (let i = 0; i < g.length; i++) {
    const v = g[i];
    if (v === 0) empty += 1;
    else if (v > best) best = v;
  }
  const inCorner = best > 0 && g[0] === best;
  return (
    EVAL_WEIGHTS.empty * empty +
    EVAL_WEIGHTS.monotonicity * monoCodes(g, size) +
    EVAL_WEIGHTS.smoothness * smoothCodes(g, size) +
    EVAL_WEIGHTS.snake * snakeCodes(g, size) +
    (inCorner ? EVAL_WEIGHTS.corner : 0)
  );
}

/** 盘面好不好:越大越好。纯函数,同一个盘面永远算出同一个数 */
export function evalBoard(board: Board): number {
  return evalCodes(toCodes(board), board.length);
}

// ---------------------------------------------------------------------------
// 期望最大搜索(地狱档)
// ---------------------------------------------------------------------------

/** 一层「新块落在哪儿」最多铺开几个空格,超过就均匀抽样,免得搜索炸开 */
export const CHANCE_SAMPLE = 4;

/** 走不动的死路要狠狠扣分,否则搜索会觉得「反正都一样」 */
const DEAD_END = -1000;

const pool: Int32Array[] = [];

function scratchAt(level: number, size: number): Int32Array {
  const need = size * size;
  const have = pool[level];
  if (have && have.length === need) return have;
  const made = new Int32Array(need);
  pool[level] = made;
  return made;
}

/** 抽样出来的空格下标(按递归层各存一份,免得每个结点都新建数组) */
const spotPool: Int32Array[] = [];

function spotsAt(level: number): Int32Array {
  const have = spotPool[level];
  if (have) return have;
  const made = new Int32Array(CHANCE_SAMPLE);
  spotPool[level] = made;
  return made;
}

function chanceCodes(g: Int32Array, size: number, depth: number, level: number): number {
  let empty = 0;
  for (let i = 0; i < g.length; i++) if (g[i] === 0) empty += 1;
  if (empty === 0) return evalCodes(g, size);

  const spots = spotsAt(level);
  let n = 0;
  if (empty <= CHANCE_SAMPLE) {
    for (let i = 0; i < g.length; i++) if (g[i] === 0) spots[n++] = i;
  } else {
    // 均匀抽样而不是随机抽样:同一个盘面每次搜同一批格子,结果才复现得出来
    let seen = 0;
    let want = 0;
    let nextAt = 0;
    for (let i = 0; i < g.length && n < CHANCE_SAMPLE; i++) {
      if (g[i] !== 0) continue;
      if (seen === nextAt) {
        spots[n++] = i;
        want += 1;
        nextAt = Math.floor((want * empty) / CHANCE_SAMPLE);
      }
      seen += 1;
    }
  }

  let total = 0;
  for (let k = 0; k < n; k++) {
    const at = spots[k];
    g[at] = 1;
    total += 0.9 * maxCodes(g, size, depth, level);
    g[at] = 2;
    total += 0.1 * maxCodes(g, size, depth, level);
    g[at] = 0;
  }
  return total / n;
}

function maxCodes(g: Int32Array, size: number, depth: number, level: number): number {
  if (depth <= 0) return evalCodes(g, size);
  const out = scratchAt(level, size);
  let best = -Infinity;
  for (let i = 0; i < 4; i++) {
    if (slideCodes(g, size, DIRS[i], out) < 0) continue;
    const v = chanceCodes(out, size, depth - 1, level + 1);
    if (v > best) best = v;
  }
  return best === -Infinity ? evalCodes(g, size) + DEAD_END : best;
}

function emptyCodes(g: Int32Array): number {
  let n = 0;
  for (let i = 0; i < g.length; i++) if (g[i] === 0) n += 1;
  return n;
}

/** 地狱档的搜索层数:空格少的时候多想一层,反正分支也少 */
export function searchDepth(board: Board): number {
  return emptyCount(board) <= 3 ? 3 : 2;
}

// ---------------------------------------------------------------------------
// 挑方向
// ---------------------------------------------------------------------------

/**
 * 按档位挑一个方向;一个方向都动不了就返回 null。
 * `depthOverride` 只给关卡可达成性验证用:多想几层就能证明这一关真有走得通的路。
 */
export function chooseMove(
  board: Board,
  tier: AiTier,
  rand: () => number,
  depthOverride?: number
): Dir | null {
  return chooseCodes(toCodes(board), board.length, tier, rand, depthOverride);
}

function chooseCodes(
  codes: Int32Array,
  size: number,
  tier: AiTier,
  rand: () => number,
  depthOverride?: number
): Dir | null {
  const out = scratchAt(0, size);
  const legal: Dir[] = [];
  const gained: number[] = [];
  for (const d of DIRS) {
    const s = slideCodes(codes, size, d, out);
    if (s >= 0) {
      legal.push(d);
      gained.push(s);
    }
  }
  if (legal.length === 0) return null;

  if (tier === "rookie") {
    return legal[Math.min(legal.length - 1, Math.floor(rand() * legal.length))];
  }

  if (tier === "normal") {
    let best = legal[0];
    let bestScore = -1;
    for (let i = 0; i < legal.length; i++) {
      if (gained[i] > bestScore) {
        bestScore = gained[i];
        best = legal[i];
      }
    }
    return best;
  }

  const depth = depthOverride ?? (tier === "hell" ? (emptyCodes(codes) <= 3 ? 3 : 2) : 0);
  let best = legal[0];
  let bestValue = -Infinity;
  for (const d of legal) {
    if (slideCodes(codes, size, d, out) < 0) continue;
    const value = depth > 0 ? chanceCodes(out, size, depth - 1, 1) : evalCodes(out, size);
    if (value > bestValue) {
      bestValue = value;
      best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 跑一整局:关卡可达成性验证与「地狱比菜鸟快」的断言都靠它
// ---------------------------------------------------------------------------

export interface RunOptions {
  board: Board;
  /** 要合出来的数字;0 表示不设目标,一直玩到动不了 */
  target: number;
  tier: AiTier;
  /** 生成新块用的随机源 */
  rand: () => number;
  maxSteps: number;
  /** 固定搜索层数(只给关卡验证用,平时让档位自己决定) */
  depth?: number;
}

export interface RunResult {
  steps: number;
  reached: boolean;
  stuck: boolean;
  score: number;
  best: number;
  board: Board;
}

/** 指数盘面 → 二维盘面 */
function fromCodes(g: Int32Array, size: number): Board {
  const out: Board = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const v = g[r * size + c];
      row.push(v === CODE_BLOCK ? BLOCK : v === 0 ? 0 : 2 ** v);
    }
    out.push(row);
  }
  return out;
}

function bestCode(g: Int32Array): number {
  let best = 0;
  for (let i = 0; i < g.length; i++) if (g[i] > best) best = g[i];
  return best;
}

/**
 * 让某一档假人从给定开局一路走到目标 / 走不动 / 用光步数。
 * 整局跑在指数盘面上:188 关战役验证要走上万步,二维数组来回 clone 太贵。
 */
export function simulateRun(opts: RunOptions): RunResult {
  const size = opts.board.length;
  const codes = toCodes(opts.board);
  const buf = new Int32Array(size * size);
  const targetCode = opts.target > 0 ? Math.round(Math.log2(opts.target)) : 0;
  let score = 0;
  let steps = 0;

  const done = (reached: boolean, stuck: boolean): RunResult => {
    const bc = bestCode(codes);
    return { steps, reached, stuck, score, best: bc === 0 ? 0 : 2 ** bc, board: fromCodes(codes, size) };
  };

  if (targetCode > 0 && bestCode(codes) >= targetCode) return done(true, false);

  while (steps < opts.maxSteps) {
    const dir = chooseCodes(codes, size, opts.tier, opts.rand, opts.depth);
    if (!dir) return done(false, true);
    const gained = slideCodes(codes, size, dir, buf);
    if (gained < 0) return done(false, true);
    codes.set(buf);
    score += gained;
    // 动了才生成新块:2 占九成、4 占一成
    let empty = 0;
    for (let i = 0; i < codes.length; i++) if (codes[i] === 0) empty += 1;
    if (empty > 0) {
      let pick = Math.min(empty - 1, Math.floor(opts.rand() * empty));
      for (let i = 0; i < codes.length; i++) {
        if (codes[i] !== 0) continue;
        if (pick === 0) {
          codes[i] = opts.rand() < 0.9 ? 1 : 2;
          break;
        }
        pick -= 1;
      }
    }
    steps += 1;
    if (targetCode > 0 && bestCode(codes) >= targetCode) return done(true, false);
  }
  return done(false, false);
}
