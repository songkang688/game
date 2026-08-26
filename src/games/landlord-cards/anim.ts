// 朵朵抢地主 —— 出牌动画的状态机(1.2 新增)。
//
// 牌不许「瞬间出现在桌上」:每一手都要从手牌位置飞到出牌区,180–240ms,带一点点旋转。
// 这里只算数,不碰 DOM,所以「飞多久、飞到哪、转多少度」都能被单测钉死;
// `prefers-reduced-motion` 时长换成一段短淡入,但走的是同一个状态机、同一套回调时序。

/** 规格下限:再快就看不清牌是从哪儿飞出去的 */
export const FLY_MIN_MS = 180;
/** 规格上限:再慢孩子就等得不耐烦 */
export const FLY_MAX_MS = 240;
/** 正常飞牌时长 */
export const FLY_MS = 210;
/** 减弱动效时的短淡入时长 */
export const FLY_REDUCED_MS = 90;
/** 手牌重排(出完牌之后剩下的牌合拢)的滑动时长 */
export const REARRANGE_MS = 160;
/** 飞牌时最多歪这么多度 */
export const FLY_SPIN_DEG = 14;

export function flyDuration(reduced: boolean): number {
  return reduced ? FLY_REDUCED_MS : FLY_MS;
}

export type FlyPhase = "idle" | "flying" | "landed";

export interface FlyState {
  phase: FlyPhase;
  /** 已经飞了多少毫秒 */
  elapsed: number;
  duration: number;
  reduced: boolean;
}

export function startFly(reduced = false): FlyState {
  return { phase: "flying", elapsed: 0, duration: flyDuration(reduced), reduced };
}

/** 推进 dt 毫秒;飞满时长就落地 */
export function stepFly(state: FlyState, dt: number): FlyState {
  if (state.phase !== "flying") return state;
  const elapsed = Math.min(state.duration, state.elapsed + Math.max(0, dt));
  return { ...state, elapsed, phase: elapsed >= state.duration ? "landed" : "flying" };
}

/** 0..1 的进度 */
export function flyProgress(state: FlyState): number {
  if (state.duration <= 0) return 1;
  return Math.max(0, Math.min(1, state.elapsed / state.duration));
}

/** 先快后慢:牌飞出去干脆,落桌时收得住 */
export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

export interface Point {
  x: number;
  y: number;
}

export interface FlyFrame {
  x: number;
  y: number;
  rot: number;
  scale: number;
  opacity: number;
}

/**
 * 某一帧牌该画在哪。
 * 正常档:沿着起点到终点走一条略带上抛的弧线,同时从起始角度转到 0 度;
 * 减弱动效档:不位移、只做淡入,但进度、回调时序与正常档完全一致。
 */
export function flyFrame(from: Point, to: Point, startRot: number, state: FlyState): FlyFrame {
  const p = easeOutCubic(flyProgress(state));
  if (state.reduced) {
    return { x: to.x, y: to.y, rot: 0, scale: 1, opacity: p };
  }
  const spin = Math.max(-FLY_SPIN_DEG, Math.min(FLY_SPIN_DEG, startRot));
  // 抛物线拱起来一点点:中途最高,落点回到 0
  const arc = -Math.sin(Math.PI * p) * 18;
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p + arc,
    rot: spin * (1 - p),
    scale: 1 - 0.12 * Math.sin(Math.PI * p),
    opacity: 1,
  };
}

/** 时长是不是落在规格区间里(单测直接用它守住 180–240ms) */
export function inSpec(ms: number): boolean {
  return ms >= FLY_MIN_MS && ms <= FLY_MAX_MS;
}
