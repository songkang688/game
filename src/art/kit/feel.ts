/**
 * 1.4 手感套件（`src/art/kit/feel.ts`）· 工序 D 的唯一入口
 *
 * 一个事件 → 一次 `feedback(tier, io)`：音 + 粒子 + 抖 + 停 + 闪 + 弹，按 small / medium / large
 * 三档成比例出力，全仓 76 款共用同一份数值，脚步不会比 BOSS 倒下还响。
 *
 * - 震屏：`Trauma` 累加 0..1、按真实时间线性衰减，位移 ∝ value²，用 t 采样正弦混频（不逐帧 random，
 *   那样是嗡嗡的电视雪花）；`applyCameraShake` 只动 ctx 的相机变换，实体坐标一个不碰。
 * - 顿帧：`HitStop` 用真实毫秒倒计时（timeScale=0.05 时照样结束），新 trigger 覆盖旧的还原时刻；
 *   `stepFeel` 把真实 dt 换成游戏 dt 并顺手推进 trauma。
 * - 弹：`squashStretch`（体积守恒 sx·sy=1，中段过冲）、`ease.*`、DOM 用 `popElement`（CSS 类驱动）。
 * - reduced（prefers-reduced-motion，值请用 `engine/view25d` 的 `prefersReducedMotion()`）：
 *   不加 trauma、不顿帧、不白闪、粒子折半由调用方淡出、pop 形变归零，音效照播。
 *
 * 纯逻辑：不查全局 DOM、不建 canvas、模块加载零副作用；`popElement` 只碰调用方递进来的那个元素。
 */

import type { SoundName } from "../../engine/types";

type Ctx = CanvasRenderingContext2D;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// ---------------------------------------------------------------------------
// 分档
// ---------------------------------------------------------------------------

export type FeelTier = "small" | "medium" | "large";

export interface FeelPreset {
  /** 加到 Trauma 的量 */
  trauma: number;
  /** 顿帧时长（真实毫秒），0 = 不顿 */
  hitStopMs: number;
  /** 顿帧期间的 timeScale */
  slow: number;
  /** 粒子数建议 */
  particles: number;
  /** 白闪时长（毫秒），0 = 不闪 */
  flashMs: number;
  /** squash/stretch 幅度 */
  pop: number;
  /** 建议音效名；`feedback` 的 `io.sound` 可覆盖 */
  sound?: SoundName;
}

/**
 * 三档预设。每个数值都满足 small ≤ medium ≤ large。
 * small 不顿帧（slow 只为结构完整）；large 的 slow 比 medium 略高：110ms 长停里世界仍微微在动，
 * 读作「慢镜」而不是「卡死」。
 */
export const FEEL_TIERS: Readonly<Record<FeelTier, FeelPreset>> = Object.freeze({
  small: Object.freeze<FeelPreset>({ trauma: 0.15, hitStopMs: 0, slow: 0.05, particles: 4, flashMs: 0, pop: 0.15, sound: "tap" }),
  medium: Object.freeze<FeelPreset>({ trauma: 0.4, hitStopMs: 50, slow: 0.06, particles: 10, flashMs: 0, pop: 0.25, sound: "pop" }),
  large: Object.freeze<FeelPreset>({ trauma: 0.8, hitStopMs: 110, slow: 0.12, particles: 28, flashMs: 60, pop: 0.35, sound: "win" })
});

// ---------------------------------------------------------------------------
// 震屏：trauma² 衰减
// ---------------------------------------------------------------------------

/** trauma 每秒衰减量缺省值（满值 1 约 0.8 秒抖完） */
export const TRAUMA_DECAY_PER_SEC = 1.2;
/** 满 trauma 时的最大位移（当前 ctx 用户空间单位，通常即 CSS 像素） */
export const SHAKE_MAX_PX: Readonly<{ x: number; y: number }> = Object.freeze({ x: 10, y: 8 });
/** 满 trauma 时的最大滚转（弧度，≈2.3°；给孩子看，压得比成人游戏低） */
export const SHAKE_MAX_ROT = 0.04;

/** 两路不可公约频率的正弦叠加，|值| ≤ 1；同一 (t, seed) 恒得同一结果 */
function wobble(t: number, seed: number): number {
  return 0.6 * Math.sin(t * 31 + seed) + 0.4 * Math.sin(t * 57 + seed * 2.3);
}

export class Trauma {
  private v = 0;
  private readonly decay: number;

  constructor(opts?: { decayPerSec?: number }) {
    const d = opts?.decayPerSec;
    this.decay = fin(d) && d > 0 ? d : TRAUMA_DECAY_PER_SEC;
  }

  /** 0..1 */
  get value(): number {
    return this.v;
  }

  /** 累加并钳到 [0,1]；后来的冲击叠上去，不重置 */
  add(amount: number): void {
    if (!fin(amount)) return;
    this.v = clamp01(this.v + amount);
  }

  /** 按真实时间（秒）线性衰减到 0；脏值 / 负值不动 */
  step(dtSec: number): void {
    if (!fin(dtSec) || dtSec <= 0 || this.v <= 0) return;
    this.v = Math.max(0, this.v - this.decay * dtSec);
  }

  /** 立刻归零（重开关卡 / destroy 时用） */
  reset(): void {
    this.v = 0;
  }

  /** 位移按 value² 缩放；用 t 采样正弦混频，禁止每帧 random */
  offset(
    tSec: number,
    maxPx: { x: number; y: number } = SHAKE_MAX_PX,
    maxRot: number = SHAKE_MAX_ROT
  ): { dx: number; dy: number; rot: number } {
    if (this.v <= 0) return { dx: 0, dy: 0, rot: 0 };
    const t = fin(tSec) ? tSec : 0;
    const k = this.v * this.v;
    const mx = fin(maxPx?.x) ? maxPx.x : SHAKE_MAX_PX.x;
    const my = fin(maxPx?.y) ? maxPx.y : SHAKE_MAX_PX.y;
    const mr = fin(maxRot) ? maxRot : SHAKE_MAX_ROT;
    return {
      dx: mx * k * wobble(t, 0.7),
      dy: my * k * wobble(t, 2.9),
      rot: mr * k * wobble(t, 5.3)
    };
  }
}

// ---------------------------------------------------------------------------
// 顿帧：真实时间还原
// ---------------------------------------------------------------------------

/** `trigger` 不传 slow 时的 timeScale */
export const HIT_STOP_SLOW = 0.05;

export class HitStop {
  private leftMs = 0;
  private scale = 1;

  get active(): boolean {
    return this.leftMs > 0;
  }

  /** 新调用覆盖旧调用的还原时刻（以最后一次的结束时刻为准）；时长非正 / 脏值忽略 */
  trigger(durationMs: number, slow: number = HIT_STOP_SLOW): void {
    if (!fin(durationMs) || durationMs <= 0) return;
    this.leftMs = durationMs;
    this.scale = fin(slow) ? clamp01(slow) : HIT_STOP_SLOW;
  }

  /** 用真实毫秒推进，返回当前 timeScale（1 = 正常） */
  step(realDtMs: number): number {
    if (this.leftMs <= 0) return 1;
    if (fin(realDtMs) && realDtMs > 0) this.leftMs = Math.max(0, this.leftMs - realDtMs);
    return this.leftMs > 0 ? this.scale : 1;
  }

  /** 立刻解除（重开关卡 / destroy 时用） */
  reset(): void {
    this.leftMs = 0;
  }
}

// ---------------------------------------------------------------------------
// 一个事件 → 一次反馈
// ---------------------------------------------------------------------------

export interface FeelIO {
  reduced: boolean;
  trauma?: Trauma;
  hitStop?: HitStop;
  play?: (s: SoundName) => void;
  burst?: (count: number) => void;
  flash?: (ms: number) => void;
  /** reduced 时仍调一次但 amount=0：画布侧形变归零，DOM 侧 `popElement(el, reduced)` 走 `.feel-pop-flat` */
  pop?: (amount: number) => void;
  /** 覆盖档位建议音效；null = 这次不出声 */
  sound?: SoundName | null;
}

/** 一个事件只调一次；reduced=true 时：不加 trauma、不触发 hitStop、不 flash、粒子数折半且由调用方做淡出。音效照播。 */
export function feedback(tier: FeelTier, io: FeelIO): void {
  const p = FEEL_TIERS[tier] ?? FEEL_TIERS.small;
  const reduced = io.reduced === true;
  const sound = io.sound === undefined ? p.sound : io.sound;
  if (sound && io.play) io.play(sound);
  if (!reduced) {
    io.trauma?.add(p.trauma);
    if (p.hitStopMs > 0) io.hitStop?.trigger(p.hitStopMs, p.slow);
  }
  const n = reduced ? Math.floor(p.particles / 2) : p.particles;
  if (n > 0) io.burst?.(n);
  if (!reduced && p.flashMs > 0) io.flash?.(p.flashMs);
  io.pop?.(reduced ? 0 : p.pop);
}

// ---------------------------------------------------------------------------
// 相机震动
// ---------------------------------------------------------------------------

/** 画布中心换算到当前用户空间（只认缩放 + 平移的变换；拿不到画布就当原点） */
function defaultCenter(ctx: Ctx): { x: number; y: number } {
  const c = (ctx as { canvas?: { width?: number; height?: number } }).canvas;
  if (!c || !fin(c.width) || !fin(c.height) || c.width <= 0 || c.height <= 0) return { x: 0, y: 0 };
  let x = c.width / 2;
  let y = c.height / 2;
  try {
    const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
    if (m && fin(m.a) && fin(m.d) && m.a !== 0 && m.d !== 0 && m.b === 0 && m.c === 0) {
      x = (x - m.e) / m.a;
      y = (y - m.f) / m.d;
    }
  } catch {
    /* 拿不到变换就按设备像素中心 */
  }
  return { x, y };
}

/**
 * 只对 ctx 做 translate/rotate（围绕画布中心），不改任何实体坐标；reduced 为真或 trauma=0 时不做任何变换。调用方负责 save/restore。
 * maxPx / center 都是**当前用户空间**单位：先 setTransform 缩放过的画布，传世界坐标里的中心与幅度。
 */
export function applyCameraShake(
  ctx: Ctx,
  tr: Trauma,
  tSec: number,
  opts?: { reduced?: boolean; maxPx?: { x: number; y: number }; maxRot?: number; center?: { x: number; y: number } }
): void {
  if (opts?.reduced === true || !tr || !(tr.value > 0)) return;
  const { dx, dy, rot } = tr.offset(tSec, opts?.maxPx, opts?.maxRot);
  const given = opts?.center;
  const c = given && fin(given.x) && fin(given.y) ? { x: given.x, y: given.y } : defaultCenter(ctx);
  ctx.translate(c.x + dx, c.y + dy);
  if (rot !== 0) ctx.rotate(rot);
  if (c.x !== 0 || c.y !== 0) ctx.translate(-c.x, -c.y);
}

// ---------------------------------------------------------------------------
// 缓动与形变
// ---------------------------------------------------------------------------

/** 进度夹取：NaN / ±∞ 当 1（宁可直接到终态，也不卡在半路） */
function clampT(t: number): number {
  return fin(t) ? clamp01(t) : 1;
}

const BACK_S = 1.70158;
const ELASTIC_C = (2 * Math.PI) / 3;

export const ease = Object.freeze({
  outQuad(t: number): number {
    const k = clampT(t);
    return 1 - (1 - k) * (1 - k);
  },
  outCubic(t: number): number {
    const k = clampT(t);
    return 1 - Math.pow(1 - k, 3);
  },
  inOutQuad(t: number): number {
    const k = clampT(t);
    return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  },
  /** 过冲，"弹"：s 越大冲得越远（缺省 1.70158 ≈ 冲过 10%） */
  outBack(t: number, s: number = BACK_S): number {
    const k = clampT(t);
    if (k === 0) return 0;
    if (k === 1) return 1;
    const c = fin(s) ? s : BACK_S;
    const m = k - 1;
    return 1 + (c + 1) * m * m * m + c * m * m;
  },
  /** 弹性：冲过头再来回晃几下 */
  outElastic(t: number): number {
    const k = clampT(t);
    if (k === 0) return 0;
    if (k === 1) return 1;
    return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * ELASTIC_C) + 1;
  }
});

/** squashStretch 缺省幅度（= medium 档 pop） */
export const SQUASH_DEFAULT = 0.25;
/** 回弹曲线的过冲系数：≈ 冲过 19%，比 UI 的 outBack 更果冻 */
const SQUASH_BACK_S = 2.5;

/** phase01 ∈ [0,1]：0 为事件瞬间（横拉竖压），1 回到 1:1；中段带过冲。体积守恒：sx*sy≈1。 */
export function squashStretch(phase01: number, amount: number = SQUASH_DEFAULT): { sx: number; sy: number } {
  const a = fin(amount) ? Math.min(0.6, Math.max(0, amount)) : SQUASH_DEFAULT;
  const k = clampT(phase01);
  if (k === 1 || a === 0) return { sx: 1, sy: 1 };
  const sx = 1 + a * (1 - ease.outBack(k, SQUASH_BACK_S));
  return { sx, sy: 1 / sx };
}

// ---------------------------------------------------------------------------
// DOM 弹一下
// ---------------------------------------------------------------------------

/** `.feel-pop` 动画时长，与 styles.css 的 `@keyframes feel-pop` 对账 */
export const FEEL_POP_MS = 280;
/** reduced 时 `.feel-pop-flat` 高亮停留时长 */
export const FEEL_POP_FLAT_MS = 240;
/** animationend 没来（元素被隐藏 / 动画被样式关掉）时的兜底摘类余量 */
const POP_FALLBACK_SLACK_MS = 120;

interface PopState {
  timer: ReturnType<typeof setTimeout> | null;
  onEnd: ((e: Event) => void) | null;
}

const popStates = new WeakMap<HTMLElement, PopState>();

function clearPop(el: HTMLElement, st: PopState): void {
  if (st.timer !== null) clearTimeout(st.timer);
  if (st.onEnd) el.removeEventListener("animationend", st.onEnd);
  st.timer = null;
  st.onEnd = null;
}

/** 给 DOM 元素加 .feel-pop 类并在动画结束后移除；reduced 为真时只切换一次颜色高亮类 .feel-pop-flat。 */
export function popElement(el: HTMLElement, reduced: boolean): void {
  if (!el || !el.classList) return;
  let st = popStates.get(el);
  if (!st) {
    st = { timer: null, onEnd: null };
    popStates.set(el, st);
  }
  clearPop(el, st);
  const state = st;
  const cls = reduced ? "feel-pop-flat" : "feel-pop";
  el.classList.remove("feel-pop", "feel-pop-flat");
  if (!reduced) void el.offsetWidth; // 强制回流：连点时动画从头再播
  el.classList.add(cls);
  const done = (): void => {
    clearPop(el, state);
    el.classList.remove(cls);
  };
  if (!reduced) {
    state.onEnd = (e: Event) => {
      const ev = e as Partial<AnimationEvent> | undefined;
      if (ev?.target && ev.target !== el) return;
      if (typeof ev?.animationName === "string" && ev.animationName !== "feel-pop") return;
      done();
    };
    el.addEventListener("animationend", state.onEnd);
  }
  state.timer = setTimeout(done, reduced ? FEEL_POP_FLAT_MS : FEEL_POP_MS + POP_FALLBACK_SLACK_MS);
}

// ---------------------------------------------------------------------------
// 游戏循环
// ---------------------------------------------------------------------------

/** 给游戏循环用：把真实 dt 换成游戏 dt（乘 hitStop 的 timeScale），顺手推进 trauma。 */
export function stepFeel(realDtMs: number, parts: { trauma?: Trauma; hitStop?: HitStop }): number {
  const dt = fin(realDtMs) && realDtMs > 0 ? realDtMs : 0;
  parts.trauma?.step(dt / 1000);
  const scale = parts.hitStop ? parts.hitStop.step(dt) : 1;
  return dt * scale;
}
