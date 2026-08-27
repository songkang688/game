/**
 * 共享美术套件 · 地板倒影(1.3 视觉升级 · 第 15 步 C 档新增)。
 *
 * 光亮的地板(保龄球道油区、碰碰车场地)要把「亮」讲出来,靠的是两样:
 * 物体脚下的**镜面倒影椭圆**,和球滚过时拉出来的**竖向倒影拉丝**。
 * 按「kit 已有文件只 import 不改」的纪律,这里新开一个模块,只组合
 * `palette.withAlpha` 取色,不动别人的文件。纯绘制函数,零 DOM;
 * 非法入参一律「不画、不抛」——绘制层不许炸。
 */
import { withAlpha } from "./palette";

/** 倒影默认透明度:比落影浅,像「照出来的」而不是「压出来的」 */
export const MIRROR_ALPHA = 0.22;

/** 拉丝默认透明度(渐隐的起点) */
export const STREAK_ALPHA = 0.3;

/**
 * 镜面倒影椭圆:在光亮地板上,物体正下方照出一个同色的淡椭圆。
 * `color` 传 #RGB / #RRGGBB;rx / ry ≤ 0 或坐标非有限时不画。
 */
export function mirrorEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number = MIRROR_ALPHA
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(rx > 0) || !(ry > 0)) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(color, a);
  ctx.fill();
  ctx.restore();
}

/**
 * 倒影拉丝:从 (x, y) 往 +len 方向(len 为正朝下、为负朝上)拉一条
 * 渐隐的细竖条 —— 球滚过油区时地板上跟着走的那道反光。
 * `len` / `w` 非法时不画。
 */
export function reflectStreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  color: string,
  alpha: number = STREAK_ALPHA
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(len) || len === 0 || !(w > 0)) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + len);
  grad.addColorStop(0, withAlpha(color, a));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  const top = Math.min(y, y + len);
  ctx.fillRect(x - w / 2, top, w, Math.abs(len));
  ctx.restore();
}
