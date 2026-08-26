/**
 * 豆豆迷宫 · 屏幕排布的那点纯算术。
 *
 * 规格第九节对 360px 有硬要求：整张迷宫要完整入屏，格子不能小于 14px，
 * 虚拟方向键热区不能小于 44px。这些数字散在 CSS 和 canvas 里没法断言，
 * 所以单独抽到这里，`layout.test.ts` 拿 188 关的真实宽度逐关过一遍。
 */

/** 格子边长下限：再小手指就点不准了（规格第九节） */
export const MIN_CELL_PX = 14;

/** 格子边长上限：大屏上迷宫铺满整面反而看不过来 */
export const MAX_CELL_PX = 26;

/** 虚拟方向键的最小热区（规格要求 ≥ 44px，实际给到 48px） */
export const PAD_HIT_PX = 48;

/** `.dmz-wrap` 左右内边距合计，算可用宽度时要先扣掉 */
export const WRAP_PADDING_PX = 20;

/** 最窄要支持到的屏宽 */
export const NARROW_VIEWPORT_PX = 360;

/** 扣掉外框内边距之后，迷宫真正能用的宽度 */
export function availableWidth(viewportPx: number): number {
  return Math.max(0, Math.floor(viewportPx) - WRAP_PADDING_PX);
}

/**
 * 这块屏宽下每格画多大。先按可用宽度平分，再夹进 [14, 26]。
 * 夹到下限说明这张图太宽了，`mazeFits` 会先把它拦下来。
 */
export function cellPxFor(viewportPx: number, cols: number): number {
  const c = Math.max(1, Math.floor(cols));
  const raw = Math.floor(availableWidth(viewportPx) / c);
  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, raw));
}

/** 这张图在这块屏宽下能不能既完整入屏、每格又不小于 14px */
export function mazeFits(viewportPx: number, cols: number): boolean {
  return Math.max(1, Math.floor(cols)) * MIN_CELL_PX <= availableWidth(viewportPx);
}

/** 一张 cols 宽的图最多能画多宽（大屏上别把迷宫拉变形） */
export function maxCanvasWidth(cols: number): number {
  return Math.max(1, Math.floor(cols)) * MAX_CELL_PX;
}
