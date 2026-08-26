// 果果合成 · 11 级合成链与合成动画状态机。
//
// 果子名字全部原创:籽 → 莓 → 柑 → 桃 → 梨 → 苹 → 橙 → 柚 → 瓜 → 玉瓜 → 团圆瓜。
// 同级两颗碰在一起就升一级,新果出现在两心中点;合成完可能立刻再触发下一节,
// 所以连锁是一节一节播出来的,不是一瞬间跳完。
import { mulberry32 } from "../level99";
import {
  GRACE_MS,
  addFruit,
  clamp,
  hypot,
  pushEvent,
  type Fruit,
  type MergeAnim,
  type World,
} from "./physics";

export interface FruitKind {
  /** 原创果名 */
  name: string;
  emoji: string;
  r: number;
  /** 果肉主色 */
  color: string;
  /** 深一点的描边色 */
  edge: string;
  /** 合成出这一级的基础分 */
  base: number;
}

/** 11 级合成链;下标就是等级 */
export const CHAIN: readonly FruitKind[] = [
  { name: "籽", emoji: "🌱", r: 9, color: "#d8b48c", edge: "#b08a63", base: 0 },
  { name: "莓", emoji: "🍓", r: 11, color: "#f4839e", edge: "#cf5d7a", base: 3 },
  { name: "柑", emoji: "🍊", r: 13.5, color: "#f7b267", edge: "#d18b3c", base: 6 },
  { name: "桃", emoji: "🍑", r: 16.5, color: "#f9a7b0", edge: "#d47b88", base: 10 },
  { name: "梨", emoji: "🍐", r: 20, color: "#cbe08a", edge: "#9fb65c", base: 15 },
  { name: "苹", emoji: "🍎", r: 24, color: "#ef6e6e", edge: "#c44a4a", base: 21 },
  { name: "橙", emoji: "🍊", r: 29, color: "#f79a3e", edge: "#cd7519", base: 28 },
  { name: "柚", emoji: "🍈", r: 35, color: "#f6d365", edge: "#c9a733", base: 36 },
  { name: "瓜", emoji: "🍏", r: 42, color: "#8ccf98", edge: "#5da56c", base: 45 },
  { name: "玉瓜", emoji: "🥝", r: 50, color: "#a8dcc0", edge: "#6faa8c", base: 55 },
  { name: "团圆瓜", emoji: "🍉", r: 60, color: "#77be6e", edge: "#4c8a47", base: 66 },
];

/** 链条最高一级 */
export const TOP_LEVEL = CHAIN.length - 1;

/**
 * 最高级两颗相碰怎么办。选 "clear":两颗一起散成星星并给一笔大分,
 * 这样满屏团圆瓜不会把容器彻底堵死;选 "merge" 就是合成一颗团圆瓜留在场上。
 */
export const TOP_RULE: "clear" | "merge" = "clear";

/** 两颗团圆瓜相碰的加分 */
export const TOP_CLEAR_SCORE = 200;

/** 圆心距小于两半径之和加上这一点点余量,就算碰上了 */
export const MERGE_SLOP = 1.5;

/** 投放点的默认高度:在警戒线上方,刚投下时不会被判越线 */
export const DROP_Y = 34;

/** 投放序列的权重:小果多、大果少 */
const DROP_WEIGHTS = [40, 30, 18, 9, 3];

export function radiusOf(level: number): number {
  return CHAIN[clamp(Math.round(level), 0, TOP_LEVEL)].r;
}

export function nameOf(level: number): string {
  return CHAIN[clamp(Math.round(level), 0, TOP_LEVEL)].name;
}

/**
 * 合成得分:等级越高基数越大,同一次连锁里越靠后加成越多。
 * chain 从 1 起算(第一节没有额外加成)。
 */
export function scoreFor(level: number, chain = 1): number {
  const lv = clamp(Math.round(level), 0, TOP_LEVEL);
  const base = CHAIN[lv].base;
  const n = Math.max(1, Math.round(chain));
  return Math.floor(base * (1 + 0.5 * (n - 1)));
}

/**
 * 第 i 颗要投的果子等级:同一个 seed 永远给出同一串,回放才复现得了。
 * maxLevel / minLevel 圈定本关允许出现的投放等级区间,越靠下的等级出得越多。
 */
export function nextFruit(seed: number, i: number, maxLevel: number, minLevel = 0): number {
  const lo = clamp(Math.floor(minLevel), 0, TOP_LEVEL);
  const hi = clamp(Math.floor(maxLevel), lo, TOP_LEVEL);
  const cap = Math.min(hi - lo, DROP_WEIGHTS.length - 1);
  const rand = mulberry32(((seed >>> 0) + Math.round(i) * 0x9e3779b1) >>> 0)();
  let total = 0;
  for (let k = 0; k <= cap; k++) total += DROP_WEIGHTS[k];
  let acc = rand * total;
  for (let k = 0; k <= cap; k++) {
    acc -= DROP_WEIGHTS[k];
    if (acc < 0) return lo + k;
  }
  return lo + cap;
}

/** 预览接下来 count 颗的等级 */
export function previewFruits(
  seed: number,
  from: number,
  count: number,
  maxLevel: number,
  minLevel = 0
): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(nextFruit(seed, from + k, maxLevel, minLevel));
  return out;
}

/** 把投放点的 x 夹进容器,保证整颗果子都在墙内 */
export function clampDropX(boxW: number, level: number, x: number): number {
  const r = radiusOf(level);
  return clamp(x, r, Math.max(r, boxW - r));
}

/** 投下一颗:落点已经夹好,带宽限期与轻微的下坠初速 */
export function dropFruit(world: World, level: number, x: number): Fruit {
  const lv = clamp(Math.round(level), 0, TOP_LEVEL);
  const r = radiusOf(lv);
  const fruit = addFruit(world, {
    level: lv,
    x: clampDropX(world.box.w, lv, x),
    y: Math.max(DROP_Y, r + 4),
    r,
    vy: 30,
    chain: 0,
    graceMs: GRACE_MS,
  });
  world.drops++;
  pushEvent(world, { kind: "drop", level: lv, chain: 0, x: fruit.x, y: fruit.y, score: 0 });
  return fruit;
}

// ---------------------------------------------------------------------------
// 合成
// ---------------------------------------------------------------------------

function makeAnim(world: World, a: Fruit, b: Fruit): MergeAnim {
  const top = a.level >= TOP_LEVEL;
  const totalMass = a.mass + b.mass;
  return {
    level: top && TOP_RULE === "clear" ? -1 : Math.min(TOP_LEVEL, a.level + 1),
    fromLevel: a.level,
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    vx: (a.vx * a.mass + b.vx * b.mass) / totalMass,
    vy: (a.vy * a.mass + b.vy * b.mass) / totalMass,
    chain: Math.max(a.chain, b.chain) + 1,
    t: 0,
    pull: Math.max(0, world.pullMs),
    pop: Math.max(0, world.popMs),
    spawned: false,
  };
}

/** 吸合结束:该弹出新果了(或者按最高级规则散成星星) */
export function spawnFromAnim(world: World, anim: MergeAnim): Fruit | null {
  if (anim.spawned) return null;
  anim.spawned = true;
  world.bestChain = Math.max(world.bestChain, anim.chain);

  if (anim.level < 0) {
    world.score += TOP_CLEAR_SCORE;
    pushEvent(world, {
      kind: "top",
      level: TOP_LEVEL,
      chain: anim.chain,
      x: anim.x,
      y: anim.y,
      score: TOP_CLEAR_SCORE,
    });
    return null;
  }

  const gained = scoreFor(anim.level, anim.chain);
  world.score += gained;
  const fruit = addFruit(world, {
    level: anim.level,
    x: anim.x,
    y: anim.y,
    r: radiusOf(anim.level),
    vx: anim.vx,
    vy: anim.vy,
    chain: anim.chain,
    // 合成出来的果子也给一小段宽限:它刚出生就贴着警戒线时不该立刻判输
    graceMs: GRACE_MS * 0.6,
    popMs: anim.pop,
  });
  pushEvent(world, {
    kind: anim.level >= TOP_LEVEL ? "top" : "merge",
    level: anim.level,
    chain: anim.chain,
    x: anim.x,
    y: anim.y,
    score: gained,
  });
  return fruit;
}

/**
 * 扫一遍同级相碰:每颗果子这一轮最多参与一次合成。
 * 两颗被摘走后先进吸合动画(`world.merges`),动画跑完才弹出新果;
 * `world.pullMs <= 0` 时退化成瞬时合成,给测试和无头模拟用。
 */
export function tryMerge(world: World): MergeAnim[] {
  const list = world.fruits;
  const used = new Set<number>();
  const started: MergeAnim[] = [];

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (used.has(a.id)) continue;
    for (let k = i + 1; k < list.length; k++) {
      const b = list[k];
      if (used.has(b.id)) continue;
      if (a.level !== b.level) continue;
      if (a.level >= TOP_LEVEL && TOP_RULE !== "clear" && TOP_RULE !== "merge") continue;
      if (hypot(b.x - a.x, b.y - a.y) > a.r + b.r + MERGE_SLOP) continue;
      used.add(a.id);
      used.add(b.id);
      started.push(makeAnim(world, a, b));
      break;
    }
  }

  if (started.length === 0) return started;
  world.fruits = list.filter((f) => !used.has(f.id));

  if (world.pullMs <= 0) {
    for (const anim of started) spawnFromAnim(world, anim);
  } else {
    world.merges.push(...started);
  }
  return started;
}

export interface ChainResult {
  merges: MergeAnim[];
  /** 这一串里最深的那一节 */
  chain: number;
  /** 这一串一共加了多少分 */
  score: number;
}

/**
 * 把当前能连的全部连完(瞬时,不播动画)。
 * 无头模拟、假人评估和单测都用它;界面上走的是 `tryMerge` + `stepMerges` 的动画版本。
 */
export function chainMerges(world: World): ChainResult {
  const keepPull = world.pullMs;
  const keepPop = world.popMs;
  world.pullMs = 0;
  world.popMs = 0;
  const before = world.score;
  const all: MergeAnim[] = [];
  let chain = 0;
  for (let guard = 0; guard < 64; guard++) {
    const step = tryMerge(world);
    if (step.length === 0) break;
    all.push(...step);
    for (const m of step) chain = Math.max(chain, m.chain);
  }
  world.pullMs = keepPull;
  world.popMs = keepPop;
  return { merges: all, chain, score: world.score - before };
}

/** 推进吸合动画;返回这一帧真正弹出来的新果 */
export function stepMerges(world: World, dtMs: number): Fruit[] {
  if (world.merges.length === 0) return [];
  const born: Fruit[] = [];
  const dt = Math.max(0, dtMs);
  for (const anim of world.merges) {
    anim.t += dt;
    if (!anim.spawned && anim.t >= anim.pull) {
      const fruit = spawnFromAnim(world, anim);
      if (fruit) born.push(fruit);
    }
  }
  world.merges = world.merges.filter((a) => a.t < a.pull + a.pop);
  return born;
}

/** 还有吸合动画在播 */
export function mergeBusy(world: World): boolean {
  return world.merges.length > 0;
}

/** 吸合进度 0..1:两颗果子朝中点靠拢并缩小 */
export function pullProgress(anim: MergeAnim): number {
  if (anim.pull <= 0) return 1;
  return clamp(anim.t / anim.pull, 0, 1);
}

/** 新果弹出的缩放:0.55 弹到 1.12 再回落到 1 */
export function popScale(msLeft: number, popMs: number): number {
  if (popMs <= 0 || msLeft <= 0) return 1;
  const p = clamp(1 - msLeft / popMs, 0, 1);
  return 0.55 + 0.57 * Math.sin((p * Math.PI) / 2) * (1 + 0.16 * (1 - p));
}

/** 场上这一等级还有几颗(假人和提示用) */
export function countLevel(world: World, level: number): number {
  let n = 0;
  for (const f of world.fruits) if (f.level === level) n++;
  return n;
}

/** 场上最大的那颗果子的等级 */
export function biggestLevel(world: World): number {
  let best = -1;
  for (const f of world.fruits) best = Math.max(best, f.level);
  return best;
}
