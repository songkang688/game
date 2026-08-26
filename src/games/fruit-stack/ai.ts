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

/** 高手档 / 地狱档试探的落点个数 */
const CANDIDATES: Record<3 | 4, number> = { 3: 9, 4: 9 };

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

/** 高度图里最低洼的那一段的中心 x;一样低的时候挑靠中间的那一段,别老往墙角塞 */
export function lowestColumnX(w: World, cols = 9): number {
  const map = heightMap(w, cols);
  let deepest = map[0];
  for (const v of map) deepest = Math.max(deepest, v);
  const mid = (map.length - 1) / 2;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < map.length; i++) {
    if (map[i] < deepest - 0.5) continue;
    const gap = Math.abs(i - mid);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
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

/**
 * 给一盆已经停稳的果子打分:合成得越多、堆得越平越低、剩下的散果越少,分越高。
 * y 轴朝下,所以高度图的数值越大表示堆得越低。
 */
export function evaluateBowl(w: World): number {
  const map = heightMap(w, 9);
  let sum = 0;
  let top = w.box.h;
  for (const v of map) {
    sum += v;
    top = Math.min(top, v);
  }
  const mean = sum / map.length;
  // 离警戒线还剩多少:留得越多越安全,超过 140 就不用再加分了
  const room = Math.min(top - w.lineY, 140);
  return mean * 0.9 + room * 1.4 - w.fruits.length * 3.5;
}

/**
 * 整齐度 0..1:大果子沉在盆底、小果子浮在上面才好接着合。
 * 按等级加权取平均高度,越接近 1 表示越「重的在下面」。
 */
export function tidiness(w: World): number {
  if (w.fruits.length === 0) return 1;
  let num = 0;
  let den = 0;
  for (const f of w.fruits) {
    const weight = f.level + 1;
    num += weight * (f.y / w.box.h);
    den += weight;
  }
  return num / den;
}

/** 把一个候选落点推演一遍,给它打分:分数越高越值得投 */
export function scoreCandidate(w: World, level: number, x: number, nextLevel = -1): number {
  const sim = cloneWorld(w);
  const beforeScore = sim.score;
  const beforeCount = sim.fruits.length;
  dropFruit(sim, level, x);
  settleWorld(sim, 260);
  if (overLine(sim)) return -1e6;
  const gained = sim.score - beforeScore;
  const merged = beforeCount + 1 - sim.fruits.length;
  // 往链条上游爬一级远比把盆铺平值钱:关卡目标基本都是「合出第 N 级」,
  // 只顾铺平的假人会一直在低级果子里打转,反而比闷头对同级的普通档还慢。
  let value =
    gained * 2.2 +
    merged * 18 +
    biggestLevel(sim) * 26 +
    tidiness(sim) * 160 +
    evaluateBowl(sim) * 0.6;

  // 地狱档的第二眼:知道下一颗是什么,就顺手把它也摆一遍,挑不会把自己堵死的那条路
  if (nextLevel >= 0) {
    let best = -Infinity;
    for (let i = 0; i < 5; i++) {
      const r = radiusOf(nextLevel);
      const nx = r + ((sim.box.w - 2 * r) * i) / 4;
      const deep = cloneWorld(sim);
      const c0 = deep.fruits.length;
      const s0 = deep.score;
      dropFruit(deep, nextLevel, nx);
      settleWorld(deep, 200);
      if (overLine(deep)) continue;
      const v =
        (deep.score - s0) * 2.2 +
        (c0 + 1 - deep.fruits.length) * 18 +
        biggestLevel(deep) * 26 +
        tidiness(deep) * 160 +
        evaluateBowl(deep) * 0.6;
      if (v > best) best = v;
    }
    if (best > -Infinity) value += best * 0.5;
  }
  return value;
}

/**
 * 这一颗投在哪儿。
 * 1 菜鸟:随手一丢;2 普通:对准同级果子,没有同级就随手丢;
 * 3 高手:五个落点各在脑子里落一遍,挑落完最舒服的那个;
 * 4 地狱:落点撒到九个,而且连下一颗一起算。
 *
 * 三档和四档共用同一套推演,差别只在撒得密不密、看不看下一颗——
 * 所以「越高档越强」不是靠调参碰运气,是结构上就成立的。
 */
export function chooseDropX(w: World, level: number, skill: AiLevel, tick = 0, nextLevel = -1): number {
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

  const n = CANDIDATES[skill === 3 ? 3 : 4];
  const peek = skill >= 4 ? nextLevel : -1;
  const match = bestMatchX(w, level);
  const spots: number[] = [];
  for (let i = 0; i < n; i++) spots.push(lo + ((hi - lo) * i) / Math.max(1, n - 1));
  // 平局的时候要有个说得过去的偏好:先看同级果子的正上方,再由中间往两边试。
  // 不排这一下,一排落点分数相同时永远取到第一个,假人会把果子全堆在左墙根。
  const mid = (lo + hi) / 2;
  spots.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  if (match !== null) spots.unshift(clamp(match, lo, hi));

  let bestX = lowestColumnX(w, 9);
  let bestScore = -Infinity;
  for (const x of spots) {
    const s = scoreCandidate(w, level, x, peek);
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
    const peek = i + 1 < maxDrops ? nextFruit(seed, i + 1, lv.maxDrop, lv.minDrop) : -1;
    const x = chooseDropX(world, level, skill, i, skill >= 4 ? peek : -1);
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
