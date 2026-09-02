/**
 * 共享美术套件 · 体积感(1.3 视觉升级)。
 *
 * `ballGradient`:三停径向渐变(受光 → 主体 → 背光),光源统一左上 45°;
 * `softShadow`:椭圆落影 —— 2.5D 的纵深全靠影子讲出来。
 * 只接受传进来的 2d 画笔,自己不摸 DOM。
 */
import { shade } from "./palette";

/** 三停渐变的默认停点:顶光 +25% → 主体 → 背光 -15%(和各家规格表一致) */
export const BALL_STOPS = { light: 25, dark: -15 } as const;

/**
 * 以 (x, y) 为球心、r 为半径的三停径向渐变。
 * 高光中心往左上偏 0.35r(45° 光),让纯色圆一秒变球。
 */
export function ballGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  stops: { light: number; dark: number } = BALL_STOPS
): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.12, x, y, r);
  g.addColorStop(0, shade(color, stops.light));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, stops.dark));
  return g;
}

/**
 * 柔和椭圆落影:填一个半透明深色椭圆。
 * `scale` 给「悬空物越低影子越大」的 2.5D 用;画完自己恢复画笔状态。
 */
export function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.12,
  scale = 1,
  color = "rgba(70,90,120,1)"
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx * scale), Math.max(0, ry * scale), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
