/**
 * 共享美术套件 · 2.5D 双面块(掀顶视角)。
 *
 * 约定(全库统一,谁用谁遵守):
 *   - 光源在左上 45°:顶面亮、侧面暗;
 *   - 侧面固定画在右与下,厚度 = `sideRatio × 块宽`(默认 0.18);
 *   - 侧面颜色 = `shade(顶面, -22)`;
 *   - **一切都画进调用者给的 `(x, y, w, h)` 盒子里**,一像素都不越界 ——
 *     格子游戏逐格调用时不会脏到隔壁格,判定坐标也完全不用动。
 *
 * 只依赖 `palette.shade`,不碰 DOM 全局,方便在 node 测试里用记录桩验证包围盒。
 */

import { shade } from "./palette";

/** 侧面厚度占块宽的比例(全库统一) */
export const SIDE_RATIO = 0.18;
/** 右/下侧面相对顶面的压暗档位 */
export const SIDE_SHADE = -22;

export interface BlockFaces {
  top: string;
  side: string;
}

/** 顶 / 侧面配色:顶面 = 主色,侧面 = shade(-22) */
export function blockFaces(base: string): BlockFaces {
  return { top: base, side: shade(base, SIDE_SHADE) };
}

/**
 * 画笔的最小面:真 `CanvasRenderingContext2D` 与测试桩都天然满足。
 * 只用「路径 + fill」,不用 `ctx.roundRect`(旧 WebView 上没有)。
 */
export interface BlockCtx {
  fillStyle: unknown;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  fill(): void;
}

/** 圆角矩形路径(arcTo 版,控制点都在矩形四角上,包围盒好验证) */
export function roundRectPath(c: BlockCtx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/**
 * 双面块:先铺满整个盒子画「侧面」,再在左上画缩进 `side` 的「顶面」——
 * 露出来的右条与下条就是侧面,厚度 = `sideRatio × w`。
 * 顶面、侧面都在 `(x, y, w, h)` 内,绝不越界。
 */
export function topSideBlock(
  c: BlockCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  sideRatio: number = SIDE_RATIO,
  radius = 2
): void {
  const faces = blockFaces(base);
  const side = Math.max(1, Math.min(w, h) * sideRatio);
  c.fillStyle = faces.side;
  roundRectPath(c, x, y, w, h, radius);
  c.fill();
  c.fillStyle = faces.top;
  roundRectPath(c, x, y, w - side, h - side, radius);
  c.fill();
}
