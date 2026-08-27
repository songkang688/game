/**
 * 共享美术套件 · 统一描边(1.3 视觉升级)。
 *
 * 全库约定:剪影描边 1.5–2px、颜色取主色加深 20%。
 * 这里只包一层「取色 + 设线宽 + stroke」,路径谁画的谁负责。
 */
import { shade } from "./palette";

/** 描边线宽下限 / 上限(px):细过 1.5 看不见,粗过 2 抢戏 */
export const OUTLINE_MIN = 1.5;
export const OUTLINE_MAX = 2;

/** 统一描边的加深幅度(%) */
export const OUTLINE_DARKEN = -20;

/** 对当前路径做统一描边:深 20%、宽度夹在 1.5–2px */
export function strokeOutline(
  ctx: CanvasRenderingContext2D,
  color: string,
  width = OUTLINE_MIN
): void {
  ctx.strokeStyle = shade(color, OUTLINE_DARKEN);
  ctx.lineWidth = Math.max(OUTLINE_MIN, Math.min(OUTLINE_MAX, width));
  ctx.lineJoin = "round";
  ctx.stroke();
}
