// 果果合成 · 四档假人 + 无头对局。
//
// 假人只做一件事:决定这一颗往哪儿投。四档从「随手一丢」一路到「先在脑子里
// 把这一颗落完再决定」,固定 seed 下地狱档的分数会明显高过菜鸟档(写成断言)。
// 同一套决策函数被对战人机、双人同屏的电脑座位和无头冒烟测试共用。
import { goalMet, type StackLevel } from "./levels";
import {
  biggestLevel,
  chainMerges,
  clampDropX,
  dropFruit,
  nextFruit,
  radiusOf,
} from "./merge";
import {
  allSettled,
  clamp,
  createWorld,
  heightMap,
  inGrace,
  overLine,
  stackTop,
  substep,
  type World,
} from "./physics";

export type AiLevel = 1 | 2 | 3 | 4;

export const AI_LABEL: Record<AiLevel, string> = {
  1: "菜鸟",
  2: "普通",
  3: "高手",
  4: "地狱",
};

/** 一次落子最多算多少个子步(约 3.3 秒):再堆不稳也不能把一帧算死 */
const SETTLE_STEPS = 400;

/** 地狱档试探的落点个数 */
const CANDIDATES = 9;

function hash(a: number, b: number): number {
  let h = (Math.round(a) * 374761393 + Math.round(b) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 复制一份世界用来做推演:动画一律关掉,合成瞬时完成 */
export function cloneWorld(w: World): World {
  return {
    ...w,
    box: { ...w.box },
    tuning: { ...w.tuning },
    fruits: w.fruits.map((f) => ({ ...f })),
    merges: [],
    events: [],
    pullMs: 0,
    popMs: 0,
  };
}

/** 让世界自己跑到全部停稳(或者跑够 SETTLE_STEPS),中间随时结算合成 */
export function settleWorld(w: World, maxSteps = SETTLE_STEPS): number {
  let steps = 0;
  while (steps < maxSteps) {
    substep(w);
    chainMerges(w);
    steps++;
    if (allSettled(w) && !w.fruits.some(inGrace)) break;
  }
  return steps;
}

/** 高度图里最低洼的那一段的中心 x */
export function lowestColumnX(w: World, cols = 9): number {
  const map = heightMap(w, cols);
  let best = 0;
  for (let i = 1; i < map.length; i++) {
    if (map[i] > map[best]) best = i;
  }
  const step = w.box.w / map.length;
  return step * (best + 0.5);
}

/** 场上和这一级一样、而且头顶没被压住的果子里最靠上的那颗 */
export function bestMatchX(w: World, level: number): number | null {
  let pick: { x: number; y: number } | null = null;
  for (const f of w.fruits) {
    if (f.level !== level) continue;
    const covered = w.fruits.some(
      (o) => o !== f && o.y < f.y - f.r * 0.4 && Math.abs(o.x - f.x) < (o.r + f.r) * 0.85
    );
    if (covered) continue;
    if (!pick || f.y < pick.y) pick = { x: f.x, y: f.y };
  }
  return pick ? pick.x : null;
}

/** 把一个候选落点推演一遍,给它打分:分数越高越值得投 */
export function scoreCandidate(w: World, level: number, x: number): number {
  const sim = cloneWorld(w);
  const beforeScore = sim.score;
  const beforeChain = sim.bestChain;
  const beforeCount = sim.fruits.length;
  dropFruit(sim, level, x);
  settleWorld(sim, 260);
  if (overLine(sim)) return -1e6;
  const gained = sim.score - beforeScore;
  const chained = sim.bestChain - beforeChain;
  const merged = beforeCount + 1 - sim.fruits.length;
  const height = sim.box.h - stackTop(sim);
  const room = stackTop(sim) - sim.lineY;
  return gained * 4 + chained * 30 + merged * 18 - height * 0.35 + Math.min(0, room) * 2.5;
}

/**
 * 这一颗投在哪儿。
 * 1 菜鸟:随手一丢;2 普通:对准同级果子;3 高手:找低洼处并顺手对同级;
 * 4 地狱:每个候选落点都先在脑子里落一遍,挑净收益最大的那个。
 */
export function chooseDropX(w: World, level: number, skill: AiLevel, tick = 0): number {
  const r = radiusOf(level);
  const lo = r;
  const hi = Math.max(r, w.box.w - r);

  if (skill <= 1) {
    return clampDropX(w.box.w, level, lo + hash(tick, w.seed) * (hi - lo));
  }

  if (skill === 2) {
    const match = bestMatchX(w, level);
    const x = match ?? lo + hash(tick + 7, w.seed) * (hi - lo);
    return clampDropX(w.box.w, level, x);
  }

  if (skill === 3) {
    const match = bestMatchX(w, level);
    const low = lowestColumnX(w, 9);
    // 同级果子就在低洼附近才去对准它,否则先把坑填平,别把堆越垒越高
    const x = match !== null && Math.abs(match - low) < w.box.w * 0.34 ? match : low;
    return clampDropX(w.box.w, level, x);
  }

  let bestX = lowestColumnX(w, 9);
  let bestScore = -Infinity;
  for (let i = 0; i < CANDIDATES; i++) {
    const x = lo + ((hi - lo) * i) / Math.max(1, CANDIDATES - 1);
    const s = scoreCandidate(w, level, x);
    if (s > bestScore) {
      bestScore = s;
      bestX = x;
    }
  }
  return clampDropX(w.box.w, level, bestX);
}

// ---------------------------------------------------------------------------
// 无头对局(冒烟测试与假人强弱对比共用)
// ---------------------------------------------------------------------------

export interface HeadlessOptions {
  maxDrops?: number;
  /** 覆盖关卡自带的 seed */
  seed?: number;
  /** 每颗最多算多少子步 */
  settleSteps?: number;
}

export interface HeadlessResult {
  world: World;
  score: number;
  bestLevel: number;
  bestChain: number;
  drops: number;
  /** 有静止的果子越线了 */
  over: boolean;
  /** 达成关卡目标 */
  won: boolean;
}

/** 让某一档假人把一关从头打到尾(纯逻辑,不碰 DOM) */
export function runHeadless(lv: StackLevel, skill: AiLevel, opts: HeadlessOptions = {}): HeadlessResult {
  const seed = opts.seed ?? lv.seed;
  const maxDrops = Math.min(opts.maxDrops ?? lv.drops, lv.drops);
  const world = createWorld({
    box: lv.box,
    lineY: lv.lineY,
    seed,
    tuning: lv.tuning,
    pullMs: 0,
    popMs: 0,
  });

  let over = false;
  let won = false;
  let i = 0;
  for (; i < maxDrops && !over && !won; i++) {
    const level = clamp(nextFruit(seed, i, lv.maxDrop, lv.minDrop), 0, lv.maxDrop);
    const x = chooseDropX(world, level, skill, i);
    dropFruit(world, level, x);
    settleWorld(world, opts.settleSteps ?? SETTLE_STEPS);
    if (goalMet(lv.goal, world)) won = true;
    else if (overLine(world)) over = true;
  }

  return {
    world,
    score: world.score,
    bestLevel: Math.max(world.bestLevel, biggestLevel(world)),
    bestChain: world.bestChain,
    drops: i,
    over,
    won,
  };
}
