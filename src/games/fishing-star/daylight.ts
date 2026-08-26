// 钓鱼小达人 · 无尽「钓到天黑」的时段模型(纯函数)。
//
// 一局无尽被切成 晨 → 昼 → 黄昏 → 夜 四段,时间自己往前走:
//  - 天色、水色一段比一段暗(2D 侧视图直接换配色,不做真 3D);
//  - 鱼群跟着换班:清晨浅滩的小鱼最闹腾,入夜以后深水的传说鱼才肯上浮;
//  - 计分看**总重量**,不看条数 —— 天黑前多拉两条大的,比狂抛小鱼划算。
//
// 全部权重都是「基础权重 × 时段偏好」,没有随机数、没有时钟,
// 随机源仍旧由调用方给,所以同一串随机数在同一时段抽出同一条鱼。

import { ENDLESS_MS, FISH, clamp, fishWeightAt, tierIndexOf, type Fish } from "./logic";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export const DAY_PHASES: DayPhase[] = ["dawn", "day", "dusk", "night"];

export interface PhaseInfo {
  key: DayPhase;
  name: string;
  emoji: string;
  /** 天空色(画布上半部分) */
  sky: string;
  /** 水色叠加(画布下半部分,越晚越暗) */
  tint: string;
  /** 这一段整体的稀有度加权 */
  luck: number;
  /** 这一段鱼群最爱待的水层(0..4) */
  favor: number;
  tip: string;
}

export const PHASE_INFO: Record<DayPhase, PhaseInfo> = {
  dawn: {
    key: "dawn",
    name: "清晨",
    emoji: "🌅",
    sky: "#ffe6cf",
    tint: "rgba(255,214,170,0.10)",
    luck: -0.2,
    favor: 0,
    tip: "晨雾还没散,浅滩的小鱼成群,先把手感热起来。",
  },
  day: {
    key: "day",
    name: "白天",
    emoji: "☀️",
    sky: "#d9f0ff",
    tint: "rgba(255,255,255,0.06)",
    luck: 0,
    favor: 1.5,
    tip: "日头正高,水草层最热闹,中等深度收益最稳。",
  },
  dusk: {
    key: "dusk",
    name: "黄昏",
    emoji: "🌇",
    sky: "#ffd2b0",
    tint: "rgba(255,150,110,0.12)",
    luck: 0.25,
    favor: 2.5,
    tip: "霞光压在水面上,湖心的大鱼开始活动了。",
  },
  night: {
    key: "night",
    name: "夜晚",
    emoji: "🌙",
    sky: "#2f3f66",
    tint: "rgba(30,50,100,0.28)",
    luck: 0.6,
    favor: 4,
    tip: "天黑了,深潭和海沟的传说鱼上浮 —— 抛远一点。",
  },
};

/** 一局里第几段(时间超界就夹到首尾) */
export function phaseAt(elapsedMs: number, totalMs: number = ENDLESS_MS): DayPhase {
  const total = totalMs > 0 ? totalMs : ENDLESS_MS;
  const t = clamp(Number.isFinite(elapsedMs) ? elapsedMs : 0, 0, total);
  const i = Math.min(DAY_PHASES.length - 1, Math.floor((t / total) * DAY_PHASES.length));
  return DAY_PHASES[i];
}

/** 这一段自己走了多少(0..1),给天色渐变用 */
export function phaseProgress(elapsedMs: number, totalMs: number = ENDLESS_MS): number {
  const total = totalMs > 0 ? totalMs : ENDLESS_MS;
  const seg = total / DAY_PHASES.length;
  const t = clamp(Number.isFinite(elapsedMs) ? elapsedMs : 0, 0, total);
  return clamp((t % seg) / seg, 0, 1);
}

/** 距离天黑还有多久(毫秒) */
export function untilNightMs(elapsedMs: number, totalMs: number = ENDLESS_MS): number {
  const total = totalMs > 0 ? totalMs : ENDLESS_MS;
  const nightAt = (total / DAY_PHASES.length) * (DAY_PHASES.length - 1);
  return Math.max(0, nightAt - Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));
}

/**
 * 时段对某一条鱼的偏好倍率(恒大于 0)。
 * 两件事:住得离「今天这个点最热闹的水层」越近越愿意来;越晚,稀有的越愿意来。
 */
export function phaseBias(fish: Fish, phase: DayPhase): number {
  const info = PHASE_INFO[phase];
  const gap = Math.abs(fish.layer - info.favor);
  const near = 1 / (1 + 0.5 * gap);
  const rare = Math.max(0.15, 1 + info.luck * (fish.rarity - 1) * 0.45);
  return Math.round(near * rare * 1000) / 1000;
}

/** 时段修正后的咬钩权重 */
export function phaseWeightAt(fish: Fish, depth: number, phase: DayPhase, luck = 0): number {
  return fishWeightAt(fish, depth, luck) * phaseBias(fish, phase);
}

/** 按时段抽一条咬钩的鱼(权重恒大于 0,永远抽得到) */
export function pickFishAtPhase(
  depth: number,
  rand: () => number,
  phase: DayPhase,
  luck = 0,
  pool: Fish[] = FISH
): Fish {
  const weights = pool.map((f) => phaseWeightAt(f, depth, phase, luck));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[0];
  let roll = clamp(rand(), 0, 0.999999) * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** 这个深度、这个时段,四档稀有度各占多少(和为 1;测试与图鉴提示都用它) */
export function tierOdds(depth: number, phase: DayPhase, luck = 0, pool: Fish[] = FISH): number[] {
  const odds = [0, 0, 0, 0];
  let total = 0;
  for (const fish of pool) {
    const w = phaseWeightAt(fish, depth, phase, luck);
    odds[tierIndexOf(fish.rarity)] += w;
    total += w;
  }
  if (total <= 0) return odds;
  return odds.map((v) => Math.round((v / total) * 10000) / 10000);
}

/** 无尽成绩的称号(按总重量,只夸不损) */
export function weightRank(kg: number): string {
  const w = Math.max(0, Number.isFinite(kg) ? kg : 0);
  if (w >= 60) return "满桶而归";
  if (w >= 40) return "深夜好手";
  if (w >= 25) return "老练钓手";
  if (w >= 12) return "熟练钓手";
  if (w >= 4) return "入门钓手";
  return "初次下竿";
}

/** 结算时那一句鼓励(钓到 0 条也只夸,不批评) */
export function endlessLine(kg: number, count: number): string {
  if (count <= 0) return "天黑得真快。下一局早点抛第一竿,水面一亮就有鱼。";
  if (kg < 4) return "水桶里有货了!下一局试试把钩子抛远一点,深处的鱼更压秤。";
  if (kg < 25) return "手感很稳。天黑以后大鱼才上来,留点力气给夜里那几竿。";
  return "满满一桶!这片水域今天归你了。";
}
