// 钓鱼小达人 · 1.3 视觉层（22 步 B 档）。
//
// 这里全是「皮」：配色 token / 动效时序 / 图层序 / 纯映射函数 / FX 粒子池。
// 不含任何玩法判定，不读写存档；上钩窗口、张力、游动演算一概**只读映射**：
// 涟漪加密只看「现在是不是上钩窗口」这一个布尔值，窗口多长、何时开由 index.ts
// 的既有判定说了算；钓竿弯曲量只是把既有力度 0..1 线性搬到弧度上，逐点一致。

import { clamp } from "./logic";
import { tailWagPhase } from "../../art/kit/fishArt";

// ---------------------------------------------------------------------------
// 四·补一 配色板（token 名与色值逐字对照规格表）
// ---------------------------------------------------------------------------

export const FSH_TOKENS = {
  /** 天空 */
  fshSkyTop: "#DFF2FF",
  /** 水面 → 深水渐变两端 */
  fshWaterHi: "#A8D8F0",
  fshWaterLo: "#4A7FA8",
  /** 波光高光带 */
  fshWave: "rgba(255,255,255,.35)",
  /** 岸边沙色 */
  fshShore: "#E8D5A8",
  /** 浮标红白双色 */
  fshBobberA: "#E85D75",
  fshBobberB: "#FFFFFF",
  /** 稀有鱼金鳞 / 金光描边 */
  fshRare: "#F0C25A",
  /** 水下落影统一色 */
  fshShadow: "rgba(40,70,100,.2)",
} as const;

// ---------------------------------------------------------------------------
// 四·补三 动效时序（毫秒写死，测试引用）
// ---------------------------------------------------------------------------

export const FSH_TIMING = {
  /** 波光带平移：两条各自的循环周期（常驻，linear，reduced 静止） */
  waveMsA: 5200,
  waveMsB: 6800,
  /** 气泡上浮一轮（常驻，linear，reduced 静止） */
  bubbleMs: 4000,
  /** 气泡上限 ≤ 6 颗 */
  bubbleMax: 6,
  /** 涟漪扩散（入水 / 上钩窗口，ease-out；reduced 静态圆环保留提示） */
  rippleMs: 600,
  /** 上钩窗口内涟漪加密倍数 */
  rippleDense: 2,
  /** 浮标点头：3px 下沉 160ms（ease-in；reduced 保留——它是功能提示） */
  bobberNodMs: 160,
  bobberNodPx: 3,
  /** 鱼跃出弧线（ease-out；reduced 瞬移展示） */
  leapMs: 240,
  /** 水花皇冠 5 瓣（ease-out；reduced 不生成） */
  splashMs: 320,
  splashDrops: 5,
  /** 稀有金光一闪（ease-out；reduced 静态金边） */
  rareFlashMs: 260,
} as const;

// ---------------------------------------------------------------------------
// 图层序（render 从底到顶；⑪ HUD 是 DOM，不进画布）
// ---------------------------------------------------------------------------

export const FSH_LAYER_ORDER = [
  "backdrop", // ① 天空 + 远山云
  "shore", // ② 岸与小人 / 小桶
  "deep", // ③ 深水渐变
  "shafts", // ④ 光柱
  "swimmers", // ⑤ 鱼群（深水先画、浅水后画）
  "lineUnder", // ⑥ 水下段钓线
  "surface", // ⑦ 水面波光 + 浪花边
  "lineAir", // ⑧ 空中段钓线 + 浮标
  "fx", // ⑨ 涟漪 / 水花 / 星屑
  "gauges", // ⑩ 力度条 / 刻度（功能件）
  "hud", // ⑪ HUD
] as const;

// ---------------------------------------------------------------------------
// 缓动
// ---------------------------------------------------------------------------

export function easeOutQuad(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x);
}

export function easeInQuad(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x;
}

// ---------------------------------------------------------------------------
// 钓线两段：空中段贝塞尔垂坠 + 入水点折射错位 + 水下段变淡
// ---------------------------------------------------------------------------

/** 入水点折射错位（像素） */
export const FSH_LINE_REFRACT_PX = 2;

/** 两段分界点 = 入水点（钩子正上方的水面）；水下段起笔向右错 2px */
export function lineSplit(hookPx: number, surfacePy: number): { entryX: number; entryY: number; underX: number } {
  return { entryX: hookPx, entryY: surfacePy, underX: hookPx + FSH_LINE_REFRACT_PX };
}

// ---------------------------------------------------------------------------
// 涟漪 / 浮标（上钩窗口只读映射）
// ---------------------------------------------------------------------------

/** 涟漪生成间隔：上钩窗口内加密 2 倍（只读窗口布尔，不改任何判定） */
export function rippleGapMs(inBiteWindow: boolean): number {
  return (FSH_TIMING.rippleMs * 1.5) / (inBiteWindow ? FSH_TIMING.rippleDense : 1);
}

/** 涟漪在寿命进度 t（0..1）的半径倍数与透明度（600ms ease-out） */
export function rippleRing(t: number): { k: number; alpha: number } {
  const s = easeOutQuad(t);
  return { k: 0.25 + 0.75 * s, alpha: 0.5 * (1 - s) };
}

/**
 * 浮标点头下沉量（像素）：只在上钩窗口非零；160ms ease-in 沉到 3px。
 * reduced 直接沉到位——点头是功能提示，减弱动效也不能丢。
 */
export function bobberDipPx(msInBite: number, inBiteWindow: boolean, reduced: boolean): number {
  if (!inBiteWindow) return 0;
  if (reduced) return FSH_TIMING.bobberNodPx;
  return FSH_TIMING.bobberNodPx * easeInQuad(msInBite / FSH_TIMING.bobberNodMs);
}

// ---------------------------------------------------------------------------
// 钓竿弯曲量（既有力度 0..1 的线性图形化，逐点一致）
// ---------------------------------------------------------------------------

/** 钓竿最大弯曲量（相对竿长的垂度系数） */
export const FSH_ROD_BEND_MAX = 0.22;

/** 力度 → 弯曲量：纯线性，bend/FSH_ROD_BEND_MAX === 力度本身 */
export function rodBendOf(power: number): number {
  return clamp(power, 0, 1) * FSH_ROD_BEND_MAX;
}

// ---------------------------------------------------------------------------
// 常驻水体动效（reduced 一律静止）
// ---------------------------------------------------------------------------

/** 波光带平移相位 0..1（linear 循环）；reduced 恒 0 = 静止 */
export function waveShift(ambientMs: number, periodMs: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(periodMs) || periodMs <= 0) return 0;
  const m = Number.isFinite(ambientMs) ? ambientMs : 0;
  return (((m % periodMs) + periodMs) % periodMs) / periodMs;
}

/** 摆尾相位接线：reduced 时归零（摆尾停），否则走 kit 的 x×0.05+speed×2 */
export function wagOf(px: number, speed: number, reduced: boolean): number {
  return reduced ? 0 : tailWagPhase(px, speed);
}

/**
 * 第 i 颗气泡此刻的状态（纯函数，无粒子状态）：
 * fx 是水平占位 0..1（调用方乘水域宽），rise 是上浮进度 0..1（reduced 定格）。
 */
export function bubbleAt(i: number, ambientMs: number, reduced: boolean): { fx: number; rise: number; r: number } {
  const n = FSH_TIMING.bubbleMax;
  const k = ((Math.round(i) % n) + n) % n;
  const m = Number.isFinite(ambientMs) ? ambientMs : 0;
  const rise = reduced ? 0.38 : (((m + k * 667) % FSH_TIMING.bubbleMs) + FSH_TIMING.bubbleMs) % FSH_TIMING.bubbleMs / FSH_TIMING.bubbleMs;
  return { fx: (k + 0.5) / n, rise, r: 1.2 + (k % 3) * 0.7 };
}

// ---------------------------------------------------------------------------
// 收获仪式（钓起：鱼跃弧线 / 水花皇冠 / 稀有金光）
// ---------------------------------------------------------------------------

/** 鱼跃弧线上进度 t 处的点；reduced 直接瞬移到终点（s=1） */
export function leapPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  t: number,
  reduced: boolean
): { x: number; y: number; s: number } {
  if (reduced) return { x: toX, y: toY, s: 1 };
  const s = easeOutQuad(t);
  const rise = Math.max(18, Math.abs(toX - fromX) * 0.35);
  return {
    x: fromX + (toX - fromX) * s,
    y: fromY + (toY - fromY) * s - Math.sin(Math.PI * s) * rise,
    s,
  };
}

/** 水花皇冠第 i 瓣在进度 t 的单位偏移与瓣径（调用方按水花大小缩放） */
export function splashDropAt(i: number, t: number): { dx: number; dy: number; r: number } {
  const n = FSH_TIMING.splashDrops;
  const k = ((Math.round(i) % n) + n) % n;
  const ang = -Math.PI / 2 + ((k - (n - 1) / 2) / (n - 1)) * (Math.PI * 0.72);
  const d = easeOutQuad(t);
  return { dx: Math.cos(ang) * d, dy: Math.sin(ang) * d, r: 0.3 * (1 - 0.6 * d) };
}

/** 稀有金光描边强度：260ms 从 0.9 淡出；reduced 给恒定静态金边 */
export function goldFlashAlpha(msSince: number, reduced: boolean): number {
  if (reduced) return 0.55;
  const t = clamp(msSince / FSH_TIMING.rareFlashMs, 0, 1);
  return 0.9 * (1 - easeOutQuad(t));
}

// ---------------------------------------------------------------------------
// FX 粒子池：涟漪 / 水花 / 鱼跃。全按外部传入的时间轴推进，destroy 一把清零。
// ---------------------------------------------------------------------------

export interface FshRipple {
  x: number;
  y: number;
  bornAt: number;
}

export interface FshSplash {
  x: number;
  y: number;
  bornAt: number;
}

export interface FshLeap {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  bornAt: number;
  rare: boolean;
  fishId: string;
  rarity: number;
}

export class FishingFx {
  ripples: FshRipple[] = [];
  splashes: FshSplash[] = [];
  leap: FshLeap | null = null;
  /** 上一次涟漪生成时刻（ambient 时间轴） */
  lastRippleAt = 0;

  spawnRipple(x: number, y: number, now: number): void {
    this.lastRippleAt = now;
    this.ripples.push({ x, y, bornAt: now });
    if (this.ripples.length > 8) this.ripples.shift();
  }

  spawnSplash(x: number, y: number, now: number): void {
    this.splashes.push({ x, y, bornAt: now });
    if (this.splashes.length > 3) this.splashes.shift();
  }

  startLeap(fromX: number, fromY: number, toX: number, toY: number, now: number, rare: boolean, fishId: string, rarity: number): void {
    this.leap = { fromX, fromY, toX, toY, bornAt: now, rare, fishId, rarity };
  }

  /** 清掉过期粒子（每帧调用一次） */
  prune(now: number): void {
    this.ripples = this.ripples.filter((r) => now - r.bornAt < FSH_TIMING.rippleMs);
    this.splashes = this.splashes.filter((s) => now - s.bornAt < FSH_TIMING.splashMs);
    if (this.leap && now - this.leap.bornAt >= FSH_TIMING.leapMs + FSH_TIMING.rareFlashMs) this.leap = null;
  }

  count(): number {
    return this.ripples.length + this.splashes.length + (this.leap ? 1 : 0);
  }

  /** destroy 归零：涟漪 / 水花 / 鱼跃 / 计时全清 */
  reset(): void {
    this.ripples.length = 0;
    this.splashes.length = 0;
    this.leap = null;
    this.lastRippleAt = 0;
  }
}
