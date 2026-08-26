/**
 * 跳跳台 · 蓄力与飞行的纯数学。
 *
 * 这一份不认识 DOM、不认识台面,只回答四个问题:
 *  1. 按住多久 = 多大力度(`powerFromHold`);
 *  2. 这么大的力度能跳多远、多高、飞多久(`jumpDistance` / `jumpApex` / `flightTime`);
 *  3. 从哪儿起跳、朝哪个方向,最后落在哪一点(`landPoint`,飞行途中的位置是 `flightPoint`);
 *  4. 一次落地能拿几分(`score`)。
 *
 * 所有映射都严格单调:蓄得越久,跳得越远、越高、飞得越久。反函数 `powerForDistance`
 * 是精确解,生成器靠它把「所需力度」直接构造进 [REACH_MIN, REACH_MAX]。
 */

/** 蓄满力所需的按住时长(毫秒)。按住超过这个时长力度封顶,不会溢出 */
export const MAX_HOLD = 900;

/** power = 0 时的水平射程(世界单位) */
export const MIN_DIST = 60;
/** power = 1 时的水平射程(世界单位) */
export const MAX_DIST = 260;
/** 射程跨度,反函数要用 */
export const DIST_SPAN = MAX_DIST - MIN_DIST;

/** power = 0 / 1 时抛物线的最高点(世界单位) */
export const MIN_APEX = 26;
export const MAX_APEX = 100;

/** power = 0 / 1 时的飞行时长(秒) */
export const MIN_FLIGHT = 0.42;
export const MAX_FLIGHT = 0.7;

/** 完美圈半径:落点离台心比这还近就算完美 */
export const PERFECT_R = 12;

/** 生成器必须保证「所需力度」落在这个区间里,两头都留得出手 */
export const REACH_MIN = 0.2;
export const REACH_MAX = 0.9;

/** 站住一座台的基础分 */
export const BASE_SCORE = 2;
/** 连击倍数封顶,免得后期分数爆掉 */
export const COMBO_CAP = 10;

const TAU = Math.PI * 2;

export interface Point {
  /** 横向(左右) */
  x: number;
  /** 前进方向(往画面深处) */
  z: number;
}

/** 夹到 [0, 1] */
export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 夹到 [lo, hi] */
export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 蓄力时长 → 力度。线性映射 `clamp(ms / MAX_HOLD, 0, 1)`:
 * 孩子按「一下、两下」数着按就能学会,而 t² 在低力度段太钝,不好教。
 */
export function powerFromHold(ms: number): number {
  return clamp01(ms / MAX_HOLD);
}

/** 力度 → 水平射程(线性、严格单调) */
export function jumpDistance(power: number): number {
  return MIN_DIST + DIST_SPAN * clamp01(power);
}

/** 射程 → 力度(jumpDistance 的精确反函数) */
export function powerForDistance(dist: number): number {
  return clamp01((dist - MIN_DIST) / DIST_SPAN);
}

/** 力度 → 抛物线最高点 */
export function jumpApex(power: number): number {
  return MIN_APEX + (MAX_APEX - MIN_APEX) * clamp01(power);
}

/** 力度 → 飞行时长(秒) */
export function flightTime(power: number): number {
  return MIN_FLIGHT + (MAX_FLIGHT - MIN_FLIGHT) * clamp01(power);
}

/** 从 a 指向 b 的偏航角:0 表示笔直往前,正数偏右 */
export function yawTo(a: Point, b: Point): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** 两点距离 */
export function dist2d(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** 起跳点 + 力度 + 方向 → 落点(纯函数) */
export function landPoint(p0: Point, power: number, yaw: number): Point {
  const d = jumpDistance(power);
  return { x: p0.x + Math.sin(yaw) * d, z: p0.z + Math.cos(yaw) * d };
}

/**
 * 飞行途中的位置:u 是飞行进度 0→1。
 * 水平匀速往前,垂直是 `4 * apex * u * (1 - u)` —— 一条真正的抛物线,起落点高度都是 0。
 */
export function flightPoint(
  p0: Point,
  power: number,
  yaw: number,
  u: number
): { x: number; z: number; y: number } {
  const t = clamp01(u);
  const d = jumpDistance(power) * t;
  return {
    x: p0.x + Math.sin(yaw) * d,
    z: p0.z + Math.cos(yaw) * d,
    y: 4 * jumpApex(power) * t * (1 - t),
  };
}

/** 连击倍数:第 1 连是 1 倍,之后每多一连多 1 倍,最多 COMBO_CAP 倍 */
export function comboMultiplier(combo: number): number {
  if (!Number.isFinite(combo)) return 1;
  return Math.max(1, Math.min(COMBO_CAP, Math.floor(combo)));
}

/**
 * 一次落地的得分:踩中圆心按连击翻倍,只是站住就拿基础分。
 * `combo` 传的是这一跳之后的连击数(完美时已经 +1 过了)。
 */
export function score(combo: number, perfect: boolean): number {
  return perfect ? BASE_SCORE * comboMultiplier(combo) : BASE_SCORE;
}

/** 一个角度归一到 [0, 2π) —— 移动台算相位用 */
export function wrapPhase(v: number): number {
  const m = v % TAU;
  return m < 0 ? m + TAU : m;
}
