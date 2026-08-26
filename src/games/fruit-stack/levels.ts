// 果果合成 · 188 关关卡表(确定性:同一关每次的容器、警戒线与果子序列完全一样)。
//
// 八个主题章节合计 188 关,章节和交给 level99 的 assertTotal 兜底。
// 每一关只吐数据,不画一个像素,所以「目标够不够得着」「容器装不装得下最大的果子」
// 这类硬指标可以在单测里 188 关全量扫一遍。
import { TOTAL_LEVELS, chapterOf, chapterStart, type Chapter } from "../level99";
import { CHAIN, DROP_WEIGHTS, TOP_LEVEL } from "./merge";
import { DEFAULT_TUNING, clamp, type Box, type PhysicsTuning } from "./physics";

export const CHAPTERS: Chapter[] = [
  { name: "小籽", emoji: "🌱", color: "#eef6e2", desc: "只投前三级的小果子,先把两颗一样的碰到一起", size: 24 },
  { name: "浆果盆", emoji: "🍓", color: "#ffe6ee", desc: "链条放宽到第五级,学会给大果子留位置", size: 24 },
  { name: "警戒线", emoji: "📏", color: "#fff3d9", desc: "警戒线往下压,堆高之前先想清楚", size: 24 },
  { name: "连锁课", emoji: "🔗", color: "#e6f0ff", desc: "一次要连着合成三节,提前摆好同级果子", size: 24 },
  { name: "窄瓶", emoji: "🫙", color: "#e9f5f2", desc: "容器变窄,左右墙的反弹要算进去", size: 22 },
  { name: "弹力果", emoji: "🏀", color: "#f6ecff", desc: "果子更弹更爱滚,落点得提前半格", size: 22 },
  { name: "对盆教学", emoji: "🪞", color: "#e8f7ff", desc: "左右两个盆同时开,练分屏对战的节奏", size: 24 },
  { name: "团圆杯", emoji: "🍉", color: "#fdeadf", desc: "一上来就是大果子,目标是最大的那一颗", size: 24 },
];

export type GoalKind = "level" | "score" | "chain";

export interface Goal {
  kind: GoalKind;
  value: number;
}

export interface StackLevel {
  /** 0 基关号;对战场与无尽用 -1 */
  index: number;
  chapter: number;
  box: Box;
  /** 警戒线 y 坐标 */
  lineY: number;
  /** 投放序列的最低等级 */
  minDrop: number;
  /** 投放序列的最高等级 */
  maxDrop: number;
  goal: Goal;
  /** 本关最多能投几颗 */
  drops: number;
  tuning: PhysicsTuning;
  seed: number;
  hint: string;
  /** 分屏教学关:左右各一个盆 */
  split: boolean;
}

/**
 * 一颗果子平均顶多少个「最低等级当量」。
 * 能投的等级区间越宽,平均个头越大——所以这个数必须跟着本关的 minDrop/maxDrop 走,
 * 写死成五档的期望值会把只开放三档的前三章算得太宽裕。
 */
export function unitsPerDrop(minDrop: number, maxDrop: number): number {
  const cap = clamp(Math.floor(maxDrop - minDrop), 0, DROP_WEIGHTS.length - 1);
  let weight = 0;
  let units = 0;
  for (let k = 0; k <= cap; k++) {
    weight += DROP_WEIGHTS[k];
    units += DROP_WEIGHTS[k] * Math.pow(2, k);
  }
  return units / weight;
}

/** 边角料损耗:实战里总有半盆果子拼不成对,预算按一半算 */
export const WASTE = 0.5;

/** 本关的投放当量总预算(以最低等级果子为 1) */
export function dropBudget(lv: Pick<StackLevel, "drops" | "minDrop" | "maxDrop">): number {
  return lv.drops * unitsPerDrop(lv.minDrop, lv.maxDrop) * WASTE;
}

/** 合成出 goal 级需要多少当量 */
export function unitsNeeded(minDrop: number, goal: number): number {
  return Math.pow(2, Math.max(0, goal - minDrop));
}

/** 本关最多能刷出多少分的粗估:合成次数不会超过投放数,平均一笔按最低等级往上两级算 */
export function estimateScore(lv: Pick<StackLevel, "drops" | "minDrop">): number {
  const step = CHAIN[clamp(lv.minDrop + 2, 0, TOP_LEVEL)].base;
  return Math.round(Math.max(0, lv.drops - 1) * step * 0.6);
}

/**
 * 目标够不够得着(纯预算模型,不跑物理)。
 * 真正的「能不能打通」由 smoke.test.ts 拿物理回放去验,这一条只拦住离谱的关卡参数。
 */
export function goalFeasible(lv: StackLevel): boolean {
  if (lv.goal.kind === "level") {
    if (lv.goal.value <= lv.minDrop || lv.goal.value > TOP_LEVEL) return false;
    // 目标果子要塞得进容器
    if (CHAIN[lv.goal.value].r * 2 > lv.box.w) return false;
    return dropBudget(lv) >= unitsNeeded(lv.minDrop, lv.goal.value);
  }
  if (lv.goal.kind === "score") {
    return lv.goal.value > 0 && estimateScore(lv) >= lv.goal.value;
  }
  return lv.goal.value >= 2 && lv.goal.value <= 4 && lv.drops >= 12;
}

/** 关卡目标的一句话说明 */
export function goalText(goal: Goal): string {
  if (goal.kind === "level") return `合成出「${CHAIN[clamp(goal.value, 0, TOP_LEVEL)].name}」`;
  if (goal.kind === "score") return `拿到 ${goal.value} 分`;
  return `打出一次 ${goal.value} 连合成`;
}

/** 目标达成了没有 */
export function goalMet(goal: Goal, got: { bestLevel: number; score: number; bestChain: number }): boolean {
  if (goal.kind === "level") return got.bestLevel >= goal.value;
  if (goal.kind === "score") return got.score >= goal.value;
  return got.bestChain >= goal.value;
}

interface ChapterPlan {
  minDrop: number;
  maxDrop: number;
  boxW: (t: number) => number;
  boxH: number;
  lineY: (t: number) => number;
  restitution: (t: number) => number;
  drops: (t: number) => number;
  goal: (t: number, i: number) => Goal;
  split: boolean;
  hint: string;
}

/** t 是这一关在本章里的进度 0..1,用来做章节内的难度爬坡 */
const PLANS: ChapterPlan[] = [
  {
    minDrop: 0,
    maxDrop: 2,
    boxW: () => 272,
    boxH: 404,
    lineY: () => 96,
    restitution: () => 0.16,
    drops: (t) => Math.round(26 + t * 10),
    goal: () => ({ kind: "level", value: 3 }),
    split: false,
    hint: "同样的两颗碰在一起就会变大。先把小的放在两边,中间留给大的。",
  },
  {
    minDrop: 0,
    maxDrop: 3,
    boxW: () => 272,
    boxH: 404,
    lineY: () => 96,
    restitution: () => 0.16,
    drops: (t) => Math.round(32 + t * 14),
    goal: (t) => ({ kind: "level", value: t < 0.5 ? 4 : 5 }),
    split: false,
    hint: "链条放宽到第五级了。大果子占地方,别把它堆在正中间挡路。",
  },
  {
    minDrop: 0,
    maxDrop: 3,
    boxW: () => 272,
    boxH: 404,
    lineY: (t) => Math.round(88 - t * 16),
    restitution: () => 0.16,
    drops: (t) => Math.round(34 + t * 12),
    goal: (t) => ({ kind: "level", value: t < 0.6 ? 4 : 5 }),
    split: false,
    hint: "警戒线压下来了。只有停稳的果子越线才算,半空中的不算,所以先合小的再堆。",
  },
  {
    minDrop: 1,
    maxDrop: 3,
    boxW: () => 300,
    boxH: 430,
    lineY: () => 92,
    restitution: () => 0.18,
    drops: (t) => Math.round(26 + t * 10),
    goal: (t) => ({ kind: "chain", value: t < 0.55 ? 3 : 4 }),
    split: false,
    hint: "把两组同级果子并排摆好,中间补上第三颗,一次就能连着响三下。",
  },
  {
    minDrop: 1,
    maxDrop: 3,
    boxW: (t) => Math.round(252 - t * 36),
    boxH: 460,
    lineY: () => 92,
    restitution: () => 0.18,
    drops: (t) => Math.round(34 + t * 12),
    goal: (t) => ({ kind: "level", value: t < 0.5 ? 5 : 6 }),
    split: false,
    hint: "瓶子窄,果子会顺着墙滑下去。贴着墙投,让它自己滚到该去的位置。",
  },
  {
    minDrop: 1,
    maxDrop: 3,
    boxW: () => 300,
    boxH: 440,
    lineY: () => 92,
    restitution: (t) => 0.3 + t * 0.16,
    drops: (t) => Math.round(36 + t * 12),
    goal: (t) => ({ kind: "level", value: t < 0.5 ? 5 : 6 }),
    split: false,
    hint: "这一章的果子更弹更爱滚,落点要提前半格,等它自己停稳再投下一颗。",
  },
  {
    minDrop: 2,
    maxDrop: 4,
    boxW: () => 268,
    boxH: 430,
    lineY: () => 96,
    restitution: () => 0.2,
    drops: (t) => Math.round(30 + t * 10),
    goal: (t, i) =>
      i % 2 === 0
        ? { kind: "level", value: t < 0.5 ? 6 : 7 }
        : { kind: "score", value: Math.round((20 + t * 14) * 10) },
    split: true,
    hint: "左右两个盆一起看:自己这边稳住,再瞄一眼对面到了第几级。",
  },
  {
    minDrop: 5,
    maxDrop: 7,
    // 盆要宽到能并排放下两颗玉瓜(84×2×2 = 336),不然最后一步永远合不出团圆瓜
    boxW: () => 348,
    boxH: 470,
    lineY: () => 108,
    restitution: () => 0.2,
    drops: (t) => Math.round(26 + t * 12),
    goal: (t) => ({ kind: "level", value: t < 0.34 ? 8 : t < 0.7 ? 9 : 10 }),
    split: false,
    hint: "一上来就是大果子,盆里只装得下几颗。想清楚再放,团圆瓜就在眼前。",
  },
];

/** 本关在所属章节里的进度 0..1 */
export function chapterProgress(index: number): number {
  const ci = chapterOf(CHAPTERS, index);
  const size = Math.max(1, CHAPTERS[ci].size);
  return clamp((index - chapterStart(CHAPTERS, ci)) / Math.max(1, size - 1), 0, 1);
}

/** 造第 index 关(0 基) */
export function buildLevel(index: number): StackLevel {
  const idx = clamp(Math.round(index), 0, TOTAL_LEVELS - 1);
  const ci = chapterOf(CHAPTERS, idx);
  const plan = PLANS[clamp(ci, 0, PLANS.length - 1)];
  const t = chapterProgress(idx);
  const inCh = idx - chapterStart(CHAPTERS, ci);

  return {
    index: idx,
    chapter: ci,
    box: { w: plan.boxW(t), h: plan.boxH },
    lineY: plan.lineY(t),
    minDrop: plan.minDrop,
    maxDrop: plan.maxDrop,
    goal: plan.goal(t, inCh),
    drops: plan.drops(t),
    tuning: { ...DEFAULT_TUNING, restitution: plan.restitution(t) },
    seed: 4100 + idx * 37,
    hint: plan.hint,
    split: plan.split,
  };
}

/** 无尽:全链条开放,容器最大,唯一的敌人是自己堆的高度 */
export function buildEndless(): StackLevel {
  return {
    index: -1,
    chapter: 7,
    box: { w: 312, h: 452 },
    lineY: 100,
    minDrop: 0,
    maxDrop: 4,
    goal: { kind: "level", value: TOP_LEVEL },
    drops: 9999,
    tuning: { ...DEFAULT_TUNING },
    seed: 90210,
    hint: "没有关底,越大的果子越占地方。合成到团圆瓜也不会结束,继续往上堆。",
    split: false,
  };
}

/** 对战 / 双人同屏:两边同一个 seed、同一个盆,谁先合成目标级谁赢 */
export function buildVersus(round: number): StackLevel {
  const r = Math.max(1, Math.round(round));
  const step = (r - 1) % 4;
  return {
    index: -1,
    chapter: 6,
    box: { w: 262 - step * 8, h: 430 },
    lineY: 96,
    minDrop: step >= 2 ? 1 : 0,
    maxDrop: step >= 2 ? 3 : 2,
    goal: { kind: "level", value: 5 + Math.min(2, step) },
    drops: 9999,
    tuning: { ...DEFAULT_TUNING, restitution: 0.16 + step * 0.04 },
    seed: 7001 + r * 131,
    hint: "两个盆的果子序列一模一样,拼的是谁摆得更整齐。",
    split: true,
  };
}

/** 关卡一句话小结,给地图与关内提示条用 */
export function levelBrief(lv: StackLevel): string {
  return `${goalText(lv.goal)} · 最多 ${lv.drops} 颗`;
}
