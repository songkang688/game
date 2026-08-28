/**
 * 共享美术套件 · 嘉年华靶摊工具（1.3 视觉升级 · 第 14 步 A 档新增）。
 *
 * `volume.ts` 的 `ballGradient` 把高光锁在 (-0.35r, -0.35r)、背光 -15%;
 * 靶摊规格要的是**高光偏 (-0.35r, -0.4r)、边缘 -18%、暖棕落影**这一档。
 * 按「kit 已有文件只 import 不改」的纪律,这里新开一个模块组合 `palette.shade`
 * 把这一档补齐,不动别人的文件。纯绘制函数,零 DOM。
 */
import { shade } from "./palette";

/** 三停停靠点:0 = 高光 / 0.55 = 主体 / 1 = 边缘 */
export const CARNIVAL_STOPS = [0, 0.55, 1] as const;
/** 高光相对主色提亮(%) */
export const CARNIVAL_LIGHTEN = 25;
/** 边缘相对主色压暗(%) */
export const CARNIVAL_DARKEN = -18;
/** 高光圆心相对球心的偏移(半径倍数):左上光,竖向压得更低一点 */
export const CARNIVAL_HIGHLIGHT = { x: -0.35, y: -0.4 } as const;
/** 靶摊统一暖棕落影色 */
export const CARNIVAL_SHADOW = "rgba(93,64,55,.18)";

/**
 * 靶摊档三停径向渐变:高光偏 (-0.35r, -0.4r),停 0 / 0.55 / 1 取 +25% / 主体 / -18%。
 * r ≤ 0 或非有限时退化为原色字符串,照样能 fill,不抛。
 */
export function carnivalBallGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  base: string
): CanvasGradient | string {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return base;
  const grad = ctx.createRadialGradient(
    x + CARNIVAL_HIGHLIGHT.x * r,
    y + CARNIVAL_HIGHLIGHT.y * r,
    r * 0.08,
    x,
    y,
    r
  );
  grad.addColorStop(CARNIVAL_STOPS[0], shade(base, CARNIVAL_LIGHTEN));
  grad.addColorStop(CARNIVAL_STOPS[1], base);
  grad.addColorStop(CARNIVAL_STOPS[2], shade(base, CARNIVAL_DARKEN));
  return grad;
}

/**
 * 暖棕椭圆落影:色值本身带 18% 透明,直接一笔 fill。
 * rx / ry ≤ 0 或非有限时不画,不抛。
 */
export function carnivalShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string = CARNIVAL_SHADOW
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(rx > 0) || !(ry > 0)) return;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
