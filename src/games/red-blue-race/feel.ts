/**
 * 红蓝赛跑 · 1.2 手感与结算(纯函数,不碰 DOM)。
 *
 * 四件小事,单独拎出来是为了能写测试:
 *  1. 跑步动画随速度变频(跑得越快腿摆得越快,两头都有夹子,不会快到抽搐);
 *  2. 冲线慢镜 300ms + 彩带条数;
 *  3. `prefers-reduced-motion` 下关掉速度线抖动与彩带;
 *  4. 自建浮层(对战场 / 无尽)与平台走同一把尺的 **400ms 结算冷静期**
 *     ——胜负一出孩子手还在连点,浮层刚弹出的一小会儿不吃点击。
 */
import { CLICK_GUARD_MS, isGuardedClick } from "../../ui/dialogs";

/** 结算浮层冷静期:直接沿用平台常量,别在这儿另起一套 */
export const SETTLE_GUARD_MS = CLICK_GUARD_MS;

/** 浮层弹出 shownAtMs 之后,nowMs 这一下点击算不算数 */
export function settleClickAccepted(shownAtMs: number, nowMs: number): boolean {
  return !isGuardedClick(shownAtMs, nowMs);
}

/** 冲线慢镜时长:够看清冲线,又不至于让人等 */
export const FINISH_SLOWMO_MS = 300;

/** 冲线彩带条数(减弱动效时是 0) */
export const CONFETTI_PIECES = 14;

/** 跑步动画最快的循环周期(毫秒) */
export const RUN_CYCLE_MIN_MS = 220;
/** 站着不动时的循环周期(毫秒) */
export const RUN_CYCLE_MAX_MS = 720;

/**
 * 速度比(0 = 没在跑,1 = 跑满)换成跑步动画的循环周期:越快周期越短。
 * 超出 0..1 的值一律夹回去,NaN 当 0。
 */
export function runCycleMs(speedRatio: number): number {
  const r = Number.isFinite(speedRatio) ? Math.max(0, Math.min(1, speedRatio)) : 0;
  return RUN_CYCLE_MAX_MS - (RUN_CYCLE_MAX_MS - RUN_CYCLE_MIN_MS) * r;
}

/** 当前速度相对本关满速的比例(给 `runCycleMs` 用) */
export function speedRatio(current: number, full: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(full) || full <= 0) return 0;
  return Math.max(0, Math.min(1, current / full));
}

/** 减弱动效时:彩带 0 条、速度线不抖 */
export function confettiCount(reducedMotion: boolean): number {
  return reducedMotion ? 0 : CONFETTI_PIECES;
}

/** 速度线要不要动(减弱动效下一律不动) */
export function speedLinesAnimated(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/** 读一次系统的「减弱动效」偏好;拿不到就当没开 */
export function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return !!mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
