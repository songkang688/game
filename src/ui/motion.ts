/**
 * 1.3 第 1 步 B · 壳层动效工具(纯逻辑、零 DOM 依赖,node 环境可测)。
 *
 * 首页 / 关卡壳 / 结算共用的时序常量全部集中在这里;
 * styles.css 里的关键帧用同名注释对账,谁改时长都要两头一起改:
 *
 *  - INTRO_HOLD_MS / INTRO_LEAVE_MS ←→ @keyframes intro-pop / intro-leave(入场卡)
 *  - STAR_BASE_MS / STAR_STEP_MS    ←→ .result-stars .star--on(星级逐颗点亮)
 *  - SCORE_ROLL_MS                  ←→ .result-score(结算分数滚动)
 *  - PRESS_POP_PEAK                 ←→ @keyframes press-pop(按压回弹,峰值 ≤ 1.08)
 *
 * reduced(prefers-reduced-motion)的口径:时序数组全 0、数字直接到终值、
 * 缩放恒为 1 —— 降级路径永远存在,绝不因为读不到偏好把画面闪起来。
 */
import { prefersReducedMotion, type MediaQueryLike } from "../engine";

// ---------------------------------------------------------------------------
// 时序常量(规格:入场卡 600ms 让位、星级 ~250ms 一颗、分数滚动 ≤ 800ms)
// ---------------------------------------------------------------------------

/** 入场卡停留时长:600ms 内自动让位 */
export const INTRO_HOLD_MS = 600;
/** 入场卡离场动画时长(reduced 时不播,直接摘掉) */
export const INTRO_LEAVE_MS = 240;
/** 第一颗星点亮的起始延迟(与 dialogs 的第一声金币音对齐) */
export const STAR_BASE_MS = 150;
/** 星级逐颗点亮的间隔 */
export const STAR_STEP_MS = 250;
/** 结算分数从 0 滚到实际值的时长(规格上限 800ms) */
export const SCORE_ROLL_MS = 800;
/** 按压回弹的缩放峰值(规格上限 1.08) */
export const PRESS_POP_PEAK = 1.08;

// ---------------------------------------------------------------------------
// 时序数组:星级点亮 / 列表入场的错峰延迟
// ---------------------------------------------------------------------------

/**
 * 生成 count 个错峰延迟(毫秒):[0, step, 2*step, …]。
 * reduced 时全 0(所有元素同时出现);count / stepMs 是脏值时不抛,收敛到安全值。
 */
export function staggerDelays(count: number, stepMs: number, reduced: boolean): number[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const step = Number.isFinite(stepMs) ? Math.max(0, stepMs) : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(reduced ? 0 : i * step);
  return out;
}

// ---------------------------------------------------------------------------
// 数字插值:结算分数滚动
// ---------------------------------------------------------------------------

export type Easing = (t: number) => number;

/** 分数滚动的缺省缓动:先快后慢,数字在结尾稳稳落住 */
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);

/** 进度夹取:t 夹到 [0,1];NaN / ±∞ 一律当 1(宁可直接到终值,也不卡在半路) */
function clampT(t: number): number {
  if (!Number.isFinite(t)) return 1;
  return Math.min(1, Math.max(0, t));
}

/**
 * 分数滚动插值:t ∈ [0,1] 时从 from 走到 to。
 * - t 越界夹住,t=0 精确取 from、t=1 精确取 to(不受缓动实现误差影响);
 * - from / to / t 是 NaN 也不返回 NaN;
 * - 缓动函数抛异常或算出脏值时退回线性,动画绝不把结算画面搞崩。
 */
export function tweenNumber(from: number, to: number, t: number, easing: Easing = easeOutCubic): number {
  const a = Number.isFinite(from) ? from : 0;
  const b = Number.isFinite(to) ? to : 0;
  const k = clampT(t);
  if (k === 0) return a;
  if (k === 1) return b;
  let eased: number;
  try {
    eased = typeof easing === "function" ? easing(k) : k;
  } catch {
    eased = k;
  }
  if (!Number.isFinite(eased)) eased = k;
  return a + (b - a) * eased;
}

// ---------------------------------------------------------------------------
// 按压回弹:欠阻尼弹簧曲线
// ---------------------------------------------------------------------------

/** 弹簧包络 e^(-4t)·sin(3πt) 的最大值,用来把峰值归一到 PRESS_POP_PEAK */
const SPRING_NORM = 0.561;

/**
 * 按压回弹曲线:t ∈ [0,1] → 缩放系数。
 * 首尾都是 1(目标值),中途先冲到峰值(≤ PRESS_POP_PEAK = 1.08)再带一点回落,
 * 像松手后的果冻。t 是脏值时返回 1,绝不输出 NaN 缩放。
 */
export function springScale(t: number): number {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (k === 0 || k === 1) return 1;
  const wobble = Math.exp(-4 * k) * Math.sin(3 * Math.PI * k);
  return 1 + ((PRESS_POP_PEAK - 1) * wobble) / SPRING_NORM;
}

// ---------------------------------------------------------------------------
// 减弱动效偏好
// ---------------------------------------------------------------------------

/**
 * 包一层 engine 的 prefersReducedMotion:壳层动效统一从这里问,
 * 单测可以注入 matchMedia 桩。读不到偏好一律当 false(动效照旧)。
 */
export function motionPref(mm?: MediaQueryLike | null): boolean {
  return prefersReducedMotion(mm);
}
