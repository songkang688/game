// 彩虹跑跑 · 日夜与天气光照(1.2 第 9 步新增)
//
// 无尽模式跑得越远,天色越往前走:晨光 → 白昼 → 黄昏 → 夜色,循环一圈再从晨光开始。
// 雾色、地面网格亮度、远景层色温都跟着走;偶尔下一场雨,地面多几条反光。
//
// 这里只算「该用什么颜色、什么亮度」,一笔都不画。理由有两个:
//  1. 纯函数好单测——天色是距离的函数,跑到同一个位置永远是同一个颜色;
//  2. 天色和主题世界是两回事——世界给底色,天色只在底色上调一调,
//     所以十二个世界配四种天色不会有一种撞成看不清的组合。
//
// 全部是 Canvas 渐变能表达的东西,不加任何贴图。

import { mixHex } from "./view3d";

/**
 * 跑多远算一整圈日夜。
 *
 * 这个数是照着实际跑得动的距离定的,不是随手拍的:无尽模式六档难度到 4000 米封顶,
 * 速度在 250–500 之间。一圈 9000 米摊成四档,一档 2250 米,
 * 按平均速度大约六到九秒——慢到看得出是在「变天」,又不会在一趟里把晨昏昼夜闪过好几遍。
 * 跑到夜色得有点本事,这也是它该有的分量。
 *
 * 还要躲开换世界那条线:世界每 1600 米换一次,2250 与 1600 只在 72000 米上对齐一次,
 * 所以「换世界」和「换天色」实际上永远不会挤在同一米发生。
 */
export const DAY_CYCLE_METERS = 9000;

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export type Weather = "clear" | "rain";

export interface PhaseAnchor {
  phase: DayPhase;
  name: string;
  emoji: string;
  /** 这一档在一圈里从哪个位置开始(0..1) */
  at: number;
  /** 天空与雾往这个色调混 */
  tint: string;
  /** 混多少:0 是原样,1 是整个盖掉 */
  mix: number;
  /** 地面网格线的亮度 */
  gridAlpha: number;
  /** 远景视差层的色温混合量 */
  layerMix: number;
  /** 远端雾的浓度倍率 */
  fogScale: number;
}

/**
 * 四档天色的锚点。相邻两档之间线性过渡,所以画面永远在慢慢变,
 * 不会跑过某一米的时候「啪」地换一张皮。
 */
export const PHASE_ANCHORS: readonly PhaseAnchor[] = [
  {
    phase: "dawn",
    name: "晨光",
    emoji: "🌅",
    at: 0,
    tint: "#ffd2ac",
    mix: 0.3,
    gridAlpha: 0.42,
    layerMix: 0.26,
    fogScale: 1.06,
  },
  {
    phase: "day",
    name: "白昼",
    emoji: "☀️",
    at: 0.25,
    tint: "#ffffff",
    mix: 0.06,
    gridAlpha: 0.52,
    layerMix: 0.12,
    fogScale: 0.88,
  },
  {
    phase: "dusk",
    name: "黄昏",
    emoji: "🌇",
    at: 0.5,
    tint: "#ff9a72",
    mix: 0.34,
    gridAlpha: 0.38,
    layerMix: 0.32,
    fogScale: 1.12,
  },
  {
    phase: "night",
    name: "夜色",
    emoji: "🌙",
    at: 0.75,
    tint: "#2b3054",
    mix: 0.46,
    gridAlpha: 0.3,
    layerMix: 0.44,
    fogScale: 1.28,
  },
];

/** 跑到 meters 米时落在一圈日夜的哪个位置(永远是 [0, 1))。 */
export function cycleT(meters: number): number {
  if (!Number.isFinite(meters)) return 0;
  const t = (meters % DAY_CYCLE_METERS) / DAY_CYCLE_METERS;
  return t < 0 ? t + 1 : t;
}

/** 这一米属于哪一档天色。 */
export function phaseAt(meters: number): DayPhase {
  const t = cycleT(meters);
  let out = PHASE_ANCHORS[0];
  for (const a of PHASE_ANCHORS) {
    if (t >= a.at) out = a;
  }
  return out.phase;
}

/* ------------------------------------------------------------------ */
/* 天气                                                                */
/* ------------------------------------------------------------------ */

/**
 * 每跑这么远来一场雨。
 * 故意比一圈日夜短:雨和天色各走各的周期,所以「黄昏的雨」和「夜里的雨」
 * 都碰得上,不会每次下雨都是同一个天色。跑一趟三四千米大概率能遇上一场。
 */
export const RAIN_PERIOD = 5200;
/** 一场雨下多远(占一个周期的三成上下)。 */
export const RAIN_SPAN = 1500;
/** 雨的进场与退场各留这么长一段,免得反光条突然冒出来。 */
export const RAIN_FADE = 420;

function rainPos(meters: number): number {
  if (!Number.isFinite(meters)) return 0;
  const m = meters % RAIN_PERIOD;
  return m < 0 ? m + RAIN_PERIOD : m;
}

/** 这一米下不下雨。 */
export function weatherAt(meters: number): Weather {
  return rainPos(meters) >= RAIN_PERIOD - RAIN_SPAN ? "rain" : "clear";
}

/** 一整圈里下雨的路占几成。 */
export function rainFraction(): number {
  return RAIN_SPAN / RAIN_PERIOD;
}

/** 雨天地面反光条的强度(0 = 晴天,1 = 下得最大的时候)。 */
export function rainSheen(meters: number): number {
  const into = rainPos(meters) - (RAIN_PERIOD - RAIN_SPAN);
  if (into < 0) return 0;
  const out = RAIN_SPAN - into;
  const ramp = Math.min(into, out) / RAIN_FADE;
  return Math.max(0, Math.min(1, ramp));
}

/* ------------------------------------------------------------------ */
/* 光照                                                                */
/* ------------------------------------------------------------------ */

export interface Lighting {
  phase: DayPhase;
  name: string;
  emoji: string;
  tint: string;
  mix: number;
  gridAlpha: number;
  layerMix: number;
  fogScale: number;
  weather: Weather;
  /** 雨天地面反光条的强度 */
  sheen: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 跑到 meters 米时的光照。
 * 相邻两档锚点之间线性过渡,跨过 0.75 → 1.0 那一段会绕回第一档,
 * 所以整整一圈下来是接得上的:`lightingAt(m)` 与 `lightingAt(m + DAY_CYCLE_METERS)` 完全一样。
 */
export function lightingAt(meters: number): Lighting {
  const t = cycleT(meters);
  const n = PHASE_ANCHORS.length;
  let i = 0;
  for (let k = 0; k < n; k++) {
    if (t >= PHASE_ANCHORS[k].at) i = k;
  }
  const from = PHASE_ANCHORS[i];
  const to = PHASE_ANCHORS[(i + 1) % n];
  const span = (i + 1 < n ? to.at : 1) - from.at;
  const k = span > 0 ? Math.max(0, Math.min(1, (t - from.at) / span)) : 0;
  const weather = weatherAt(meters);
  const sheen = rainSheen(meters);
  // 下雨天整体压暗一点、雾更厚一点,网格线的高光反而更亮(地面是湿的)
  const wet = sheen * 0.35;
  return {
    phase: from.phase,
    name: from.name,
    emoji: from.emoji,
    tint: mixHex(from.tint, to.tint, k),
    mix: Math.min(1, lerp(from.mix, to.mix, k) + wet * 0.3),
    gridAlpha: Math.min(1, lerp(from.gridAlpha, to.gridAlpha, k) + sheen * 0.12),
    layerMix: Math.min(1, lerp(from.layerMix, to.layerMix, k) + wet * 0.2),
    fogScale: lerp(from.fogScale, to.fogScale, k) + wet * 0.5,
    weather,
    sheen,
  };
}

/** 战役用固定的白昼光照:188 关的看头是关卡本身,不该被天色搅乱。 */
export const STATIC_DAY: Lighting = {
  phase: "day",
  name: "白昼",
  emoji: "☀️",
  tint: "#ffffff",
  mix: 0.06,
  gridAlpha: 0.52,
  layerMix: 0.12,
  fogScale: 0.88,
  weather: "clear",
  sheen: 0,
};

/** HUD 上那一小行:「🌇 黄昏 · 小雨」 */
export function lightingLabel(light: Lighting): string {
  return `${light.emoji} ${light.name}${light.weather === "rain" ? " · 小雨" : ""}`;
}

/** 把主题色按当前天色调一调(天空、雾、车道都用这一条)。 */
export function shade(base: string, light: Lighting): string {
  return mixHex(base, light.tint, light.mix);
}
