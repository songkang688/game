/**
 * 共享美术套件 · 泡泡薄膜(1.3 视觉升级)。
 *
 * 三层拼出一颗「真的泡泡」:
 *   1. `bubbleFilm` 薄膜主体 —— 径向渐变,中心近乎透明、边缘吃 tint,
 *      泡里裹着的东西照样看得清;
 *   2. `bubbleGloss` 上光 —— 顶部月牙高光(可随 `sheenAngle` 缓缓旋转,
 *      2400ms 一圈,linear;reduced 给 0 就是静止月牙)+ 底部 1px 彩虹缘;
 *   3. 彩虹缘在半径 < `BUBBLE_RIM_MIN_R` 时**自动省略**——小屏小泡上那一圈
 *      只会糊成杂色,不如不画。
 *
 * 裹着东西的泡泡按「膜 → 泡内物 → 光」三段画:先 `bubbleFilm`,再画泡内物,
 * 最后 `bubbleGloss`,薄膜永远不遮内容物。只接受传进来的 2d 画笔,不摸 DOM。
 *
 * 窗口 6 另有 CSS 皮肤：`bubbleSkin(baseHex)` 返回 background / boxShadow。
 */

import { shade } from "./palette";

/** 彩虹缘只在半径不小于这个值时出现(px) */
export const BUBBLE_RIM_MIN_R = 6;

/** 月牙高光旋转一圈的时长(毫秒,linear) */
export const SHEEN_PERIOD_MS = 2400;

/** 彩虹缘 / 彩虹描边的五色(粉彩档,细到不喧宾) */
export const RAINBOW = ["#FF9FBE", "#FFD678", "#9BE8B0", "#9BD9F5", "#C9A8F0"] as const;

/** 底部彩虹缘要不要画:半径 < 6px 一律省略 */
export function rimVisible(r: number): boolean {
  return r >= BUBBLE_RIM_MIN_R;
}

/** 这一毫秒月牙转到哪个角(弧度);reduced 恒 0(静止月牙) */
export function sheenAngle(ms: number, reduced: boolean): number {
  if (reduced) return 0;
  const k = (((ms % SHEEN_PERIOD_MS) + SHEEN_PERIOD_MS) % SHEEN_PERIOD_MS) / SHEEN_PERIOD_MS;
  return k * Math.PI * 2;
}

/**
 * 薄膜主体:中心近透明 → 边缘吃 tint 的径向渐变。
 * tint 直接收 rgba 字符串(各游戏的配色板 token)。
 */
export function bubbleFilm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tint: string
): void {
  if (r <= 0) return;
  ctx.save();
  const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  grad.addColorStop(0, "rgba(255,255,255,.16)");
  grad.addColorStop(0.7, "rgba(255,255,255,.06)");
  grad.addColorStop(1, tint);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 上光:顶部月牙高光(左上 45° 起位,`angle` 是 `sheenAngle` 的输出)
 * + 底部 1px 彩虹缘(`rimVisible` 说了算)。
 */
export function bubbleGloss(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number
): void {
  if (r <= 0) return;
  ctx.save();
  // 月牙高光:从左上 45° 出发,随 angle 缓缓巡回
  const base = -Math.PI * 0.75 + angle;
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.68, base - 0.5, base + 0.5);
  ctx.stroke();
  // 底部彩虹缘:1px、五段接力,只铺在下缘 40°–140°;小泡自动省略
  if (rimVisible(r)) {
    const from = Math.PI * (40 / 180);
    const span = Math.PI * (100 / 180) / RAINBOW.length;
    ctx.lineWidth = 1;
    for (let i = 0; i < RAINBOW.length; i++) {
      ctx.strokeStyle = RAINBOW[i];
      ctx.beginPath();
      ctx.arc(x, y, r - 1, from + i * span, from + (i + 1) * span);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 主高光斑圆心(窗口 6 CSS 皮肤) */
export const BUBBLE_HIGHLIGHT_X = "30%";
export const BUBBLE_HIGHLIGHT_Y = "24%";
export const BUBBLE_LIGHTEN = 10;
export const BUBBLE_DARKEN = -12;
export const BUBBLE_INNER_ARC = "inset 0 -2px 4px rgba(255,255,255,.2)";
export const BUBBLE_CRESCENT_MIN_PX = 32;

export interface BubbleSkinStyle {
  background: string;
  boxShadow: string;
}

export function bubbleHighlight(): string {
  return `radial-gradient(circle at ${BUBBLE_HIGHLIGHT_X} ${BUBBLE_HIGHLIGHT_Y}, rgba(255,255,255,.8), transparent 40%)`;
}

export function bubbleBody(base: string): string {
  return `radial-gradient(circle at 50% 46%, ${shade(base, BUBBLE_LIGHTEN)}, ${shade(base, BUBBLE_DARKEN)} 94%)`;
}

export function bubbleCrescentVisible(sizePx: number): boolean {
  return sizePx >= BUBBLE_CRESCENT_MIN_PX;
}

function paintBubbleSkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tint: string,
  opts: { sheenMs?: number; reduced?: boolean } = {}
): void {
  bubbleFilm(ctx, x, y, r, tint);
  bubbleGloss(ctx, x, y, r, sheenAngle(opts.sheenMs ?? 0, opts.reduced ?? false));
}

function cssBubbleSkin(base: string): BubbleSkinStyle {
  return {
    background: `${bubbleHighlight()}, ${bubbleBody(base)}`,
    boxShadow: BUBBLE_INNER_ARC
  };
}

/** 画布版：膜 + 光。CSS 版：传入底色 hex，返回 background / boxShadow。 */
export function bubbleSkin(base: string): BubbleSkinStyle;
export function bubbleSkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tint: string,
  opts?: { sheenMs?: number; reduced?: boolean }
): void;
export function bubbleSkin(
  a: string | CanvasRenderingContext2D,
  x?: number,
  y?: number,
  r?: number,
  tint?: string,
  opts?: { sheenMs?: number; reduced?: boolean }
): BubbleSkinStyle | void {
  if (typeof a === "string") return cssBubbleSkin(a);
  paintBubbleSkin(a, x ?? 0, y ?? 0, r ?? 0, tint ?? "#ffffff", opts);
}
