/**
 * 便便超人 · 自绘道具小画坊(1.3 窗口 7 第 1 轮视觉修复 C 档新增,纯绘制零判定)。
 *
 * A 档报告点名的三处「裸 emoji 当核心道具」都在这里换成自绘:
 *  - 香香星(收集物):kit `traceStar` 星形 + 三停径向渐变 + 描边 + 左上小高光;
 *  - 地面垃圾 / 头顶携带件:18 款分类条目逐一自绘(≥2 停渐变 + 1.5px 级描边);
 *  - 三色分类桶的功能图标:可回收 / 厨余 / 其他 三枚自绘白色图形。
 *
 * 统一约定跟全款一致:光源左上 45°、描边 1.5–2px、粉彩色板、绝不 fillText emoji。
 * 这里只读坐标与尺寸,一个玩法数值都不碰。
 */

import { traceStar } from "../../art/kit/sparkle";
import { shade } from "./visual";

/** 圆角矩形路径(本模块自用,不依赖 index.ts 的私有工具) */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 两停线性渐变(亮 → 暗,方向由调用点定,默认斜向左上受光) */
function grad2(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c0: string,
  c1: string
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

// ---------------------------------------------------------------------------
// 香香星(收集物):顶替裸 ✨
// ---------------------------------------------------------------------------

/**
 * 自绘香香星:柔光圈 + 三停径向渐变星身(亮心偏左上)+ 描边 + 左上小高光星。
 * r 是星的外接半径(原 emoji 字号 19px ≈ r 9.5)。
 */
export function drawScentStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  // 柔光圈:收集物在任何底色上都有一圈呼吸感
  const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.55);
  halo.addColorStop(0, "rgba(255,241,186,.5)");
  halo.addColorStop(1, "rgba(255,241,186,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
  ctx.fill();
  // 星身:三停径向渐变,亮心偏左上(统一光源 45°)
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.08, x, y, r * 1.05);
  body.addColorStop(0, "#FFF9E0");
  body.addColorStop(0.55, "#FFD75E");
  body.addColorStop(1, "#F2AE2E");
  ctx.fillStyle = body;
  traceStar(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = "#C98A1E";
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.stroke();
  // 左上小高光星
  ctx.fillStyle = "rgba(255,255,255,.85)";
  traceStar(ctx, x - r * 0.3, y - r * 0.32, r * 0.3);
  ctx.fill();
  ctx.restore();
}
