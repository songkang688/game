/**
 * 扫雷花园 · 竞速假人（四档）。
 *
 * 假人不是对手也不会捣乱，它只是在**同一张图**上和你比谁先扫完。
 * 踩到刺种它不会出局，只会蹲下来看那朵花歇一会儿——所以档位差别最后都体现在用时上。
 *
 * | 档 | 本事 |
 * | 菜鸟 | 闭着眼点未开的格 |
 * | 普通 | 只点平凡规则能确定安全的格，推不出来才随手点一个 |
 * | 高手 | 「数字 − 旗数」推导 + 会插旗，还会用全局剩余数 |
 * | 地狱 | 直接用约束求解器，会插旗会和弦，几乎不踩刺种 |
 */
import {
  FLAG,
  HIDDEN,
  OPEN,
  boardFromMines,
  canChord,
  chord,
  floodOpen,
  neighborTable,
  toggleFlag,
  won,
  type Board
} from "./board";
import { KNOWN_MINE, KNOWN_OPEN, UNKNOWN, buildConstraints, deduce, deduceSimple } from "./solver";

export type AiTier = "rookie" | "normal" | "expert" | "master";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "master"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  expert: "高手",
  master: "地狱"
};

export const AI_TIER_HINTS: Record<AiTier, string> = {
  rookie: "随手乱点，经常踩到刺种，蹲那儿发呆的时间比扫地还长。",
  normal: "只翻它算得准的格，算不出来就碰运气。",
  expert: "会数「数字减旗数」，也会插旗，稳得多。",
  master: "会和弦、会全盘约束求解，基本不踩刺种，跑得飞快。"
};

/** 每走一步花多少毫秒（档位越高手越快） */
export const AI_MOVE_MS: Record<AiTier, number> = {
  rookie: 820,
  normal: 660,
  expert: 500,
  master: 340
};

/** 踩到刺种就停下来看那朵花，歇这么久再接着扫 */
export const AI_HIT_PENALTY_MS = 6000;

/** 一局最多走这么多步，免得菜鸟档在极端图上无限磨 */
export const AI_MOVE_CAP = 4000;

export interface AiMove {
  kind: "open" | "flag" | "chord";
  index: number;
}

export interface Ai {
  tier: AiTier;
  /** 假人自己那份视图（刺种分布和玩家那张图一模一样，但翻开状态各是各的） */
  board: Board;
  /** 记在心里的刺种：算出来了但还没插旗 */
  mem: Uint8Array;
  moves: number;
  hits: number;
  /** 累计用时（毫秒），含踩到刺种的发呆时间 */
  ms: number;
  done: boolean;
  /** 推理攒下来还没执行的结论 */
  pendingSafe: number[];
  pendingMines: number[];
}

export function createAi(w: number, h: number, mine: Uint8Array, tier: AiTier): Ai {
  return {
    tier,
    board: boardFromMines(w, h, Uint8Array.from(mine)),
    mem: new Uint8Array(w * h),
    moves: 0,
    hits: 0,
    ms: 0,
    done: false,
    pendingSafe: [],
    pendingMines: []
  };
}

/** 假人眼里的世界：0 未知 / 1 已翻开 / 2 确认是刺种（插了旗的和记在心里的都算） */
export function aiKnown(ai: Ai): Uint8Array {
  const known = new Uint8Array(ai.board.state.length);
  for (let i = 0; i < known.length; i++) {
    if (ai.board.state[i] === OPEN) known[i] = KNOWN_OPEN;
    else if (ai.board.state[i] === FLAG || ai.mem[i]) known[i] = KNOWN_MINE;
    else known[i] = UNKNOWN;
  }
  return known;
}

/** 只有平凡规则的一轮推理：菜鸟之上、普通那一档的全部本事 */
function deduceTrivial(ai: Ai, known: Uint8Array): { safe: number[]; mines: number[] } {
  const cons = buildConstraints(ai.board.w, ai.board.h, ai.board.hint, known);
  const safe: number[] = [];
  const mines: number[] = [];
  for (const c of cons) {
    if (c.need <= 0) safe.push(...c.cells);
    else if (c.need === c.cells.length) mines.push(...c.cells);
  }
  return { safe: [...new Set(safe)], mines: [...new Set(mines)] };
}

function hiddenCells(ai: Ai): number[] {
  const out: number[] = [];
  for (let i = 0; i < ai.board.state.length; i++) {
    if (ai.board.state[i] === HIDDEN) out.push(i);
  }
  return out;
}

/** 前沿优先的随机：挨着已翻开区域的未开格更可能有戏，实在没有才乱点 */
function randomPick(ai: Ai, rand: () => number): number {
  const hidden = hiddenCells(ai);
  if (hidden.length === 0) return -1;
  if (ai.tier === "rookie") return hidden[Math.floor(rand() * hidden.length)];
  const table = neighborTable(ai.board.w, ai.board.h);
  const edge = hidden.filter((i) => table[i].some((nb) => ai.board.state[nb] === OPEN));
  const pool = edge.length > 0 ? edge : hidden;
  return pool[Math.floor(rand() * pool.length)];
}

function refill(ai: Ai): void {
  const known = aiKnown(ai);
  const total = ai.board.mines;
  let res: { safe: number[]; mines: number[] };
  if (ai.tier === "normal") res = deduceTrivial(ai, known);
  else if (ai.tier === "expert") res = deduceSimple(ai.board.w, ai.board.h, ai.board.hint, known, total);
  else res = deduce(ai.board.w, ai.board.h, ai.board.hint, known, total);
  ai.pendingSafe = res.safe.filter((i) => ai.board.state[i] === HIDDEN);
  ai.pendingMines = res.mines.filter((i) => ai.board.state[i] === HIDDEN && !ai.mem[i]);
}

/** 想好下一步走哪儿（不落子，界面可以拿它画个提示） */
export function aiPlan(ai: Ai, rand: () => number): AiMove | null {
  if (ai.done) return null;
  if (ai.tier === "rookie") {
    const i = randomPick(ai, rand);
    return i < 0 ? null : { kind: "open", index: i };
  }

  // 地狱档先看能不能和弦：一次翻开一圈，最划算
  if (ai.tier === "master") {
    for (let i = 0; i < ai.board.state.length; i++) {
      if (canChord(ai.board, i)) return { kind: "chord", index: i };
    }
  }

  ai.pendingSafe = ai.pendingSafe.filter((i) => ai.board.state[i] === HIDDEN);
  ai.pendingMines = ai.pendingMines.filter((i) => ai.board.state[i] === HIDDEN && !ai.mem[i]);
  if (ai.pendingSafe.length === 0 && ai.pendingMines.length === 0) refill(ai);

  // 高手和地狱都会插旗；地狱插旗是为了接着和弦，所以插旗排在翻开前面
  if (ai.tier !== "normal" && ai.pendingMines.length > 0) {
    return { kind: "flag", index: ai.pendingMines[0] };
  }
  if (ai.pendingSafe.length > 0) return { kind: "open", index: ai.pendingSafe[0] };
  if (ai.tier === "normal" && ai.pendingMines.length > 0) {
    // 普通档不插旗，只把结论记在心里，下一步再算
    for (const i of ai.pendingMines) ai.mem[i] = 1;
    ai.pendingMines = [];
    const again = deduceTrivial(ai, aiKnown(ai)).safe.filter((i) => ai.board.state[i] === HIDDEN);
    if (again.length > 0) return { kind: "open", index: again[0] };
  }
  const i = randomPick(ai, rand);
  return i < 0 ? null : { kind: "open", index: i };
}

export interface AiStepResult {
  move: AiMove | null;
  /** 这一步踩到了刺种 */
  hit: boolean;
  /** 这一步花掉的毫秒（含发呆） */
  ms: number;
  /** 本次翻开的格子（界面照着画） */
  opened: number[];
}

/**
 * 真的走一步。
 * 踩到刺种不算出局：那一颗当场开花，假人插上旗、歇 `AI_HIT_PENALTY_MS` 再接着扫。
 */
export function aiStep(ai: Ai, rand: () => number): AiStepResult {
  if (ai.done) return { move: null, hit: false, ms: 0, opened: [] };
  const move = aiPlan(ai, rand);
  if (!move) {
    ai.done = true;
    return { move: null, hit: false, ms: 0, opened: [] };
  }
  ai.moves++;
  let ms = AI_MOVE_MS[ai.tier];
  let hit = false;
  let opened: number[] = [];

  if (move.kind === "flag") {
    toggleFlag(ai.board, move.index);
    ai.mem[move.index] = 1;
  } else {
    const r = move.kind === "chord" ? chord(ai.board, move.index) : floodOpen(ai.board, move.index);
    opened = r.opened;
    if (r.hit) {
      hit = true;
      ai.hits++;
      ms += AI_HIT_PENALTY_MS;
      // 学乖了：那一格插上旗，别再踩第二次
      ai.board.state[r.hitAt] = FLAG;
      ai.mem[r.hitAt] = 1;
      opened = r.opened.filter((i) => i !== r.hitAt);
    }
  }

  ai.ms += ms;
  if (won(ai.board) || ai.moves >= AI_MOVE_CAP) ai.done = true;
  return { move, hit, ms, opened };
}

/**
 * 假人的第一下：和玩家点在同一格（同一张图、同一个起点，比的就是之后的本事）。
 * 返回它这一下花掉的毫秒。
 */
export function aiFirstOpen(ai: Ai, index: number): number {
  const r = floodOpen(ai.board, index);
  ai.moves++;
  let ms = AI_MOVE_MS[ai.tier];
  if (r.hit) {
    ai.hits++;
    ms += AI_HIT_PENALTY_MS;
    ai.board.state[r.hitAt] = FLAG;
    ai.mem[r.hitAt] = 1;
  }
  ai.ms += ms;
  if (won(ai.board)) ai.done = true;
  return ms;
}

/** 假人扫完了百分之多少（界面上那根进度条） */
export function aiProgress(ai: Ai): number {
  let opened = 0;
  let totalSafe = 0;
  for (let i = 0; i < ai.board.state.length; i++) {
    if (ai.board.mine[i]) continue;
    totalSafe++;
    if (ai.board.state[i] === OPEN) opened++;
  }
  return totalSafe === 0 ? 1 : opened / totalSafe;
}

export interface AiRunResult {
  tier: AiTier;
  /** 扫完（或走到步数上限）用了多少毫秒 */
  ms: number;
  moves: number;
  hits: number;
  cleared: boolean;
}

/** 确定性随机：同一个 seed 同一档，跑出来的用时一模一样 */
function makeRand(seed: number): () => number {
  let a = (seed >>> 0) || 0x2545f491;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 把一整局跑完（测试与难度体检用；界面走 `aiStep` 一步一步演） */
export function simulateAi(
  w: number,
  h: number,
  mine: Uint8Array,
  firstClick: number,
  tier: AiTier,
  seed: number
): AiRunResult {
  const ai = createAi(w, h, mine, tier);
  const rand = makeRand(seed);
  aiFirstOpen(ai, firstClick);
  while (!ai.done) aiStep(ai, rand);
  return { tier, ms: ai.ms, moves: ai.moves, hits: ai.hits, cleared: won(ai.board) };
}
