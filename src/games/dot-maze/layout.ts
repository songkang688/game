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

/** 画布显示高的下限:比这更矮迷宫就看不清了,低于它宁可交给舞台滚动 */
export const MIN_CANVAS_DISPLAY_PX = 160;

/**
 * 矮横屏（915×412 一族）单独的下限。
 *
 * 那一族竖着只有 412px,壳层顶栏 + 关卡条 + HUD 各占一截之后,留给迷宫的净高只有
 * 150 上下:守着 160 的下限就等于让迷宫压着裁切线,而线以下正是方向键——
 * 触屏玩家一步都动不了。迷宫是等比缩,缩了仍然整张在屏、判定走的是相对滑动,
 * 所以这一族把下限让到 128,先保证「整张图 + 整排键」都在首屏。
 */
export const MIN_CANVAS_DISPLAY_SHORT_PX = 128;

/** 是不是「矮横屏」一族（和 CSS 里 min-width:700 + max-height:560 那条分支同一口径） */
export function isShortLandscape(w: number, h: number): boolean {
  return w >= 700 && h <= 560;
}

/**
 * 画布该「显示」多高(null = 原生高度就装得下,一个样式都不用写)。
 *
 * 画布分辨率按屏宽定,显示层是 `width:100%; height:auto`——横屏 640×360 上
 * 15 行 × 26px 的图显示高 ~390px,而 `.game-stage` 的可视高只剩 ~280px:
 * 画布下半截连同虚拟方向键(触屏的主输入)一起掉在裁切线以下。
 * 量出真实余量后给显示层钳一条 `max-height`:canvas 是带内在比例的 replaced
 * 元素,浏览器会连宽一起等比收,迷宫不变形;触屏输入是相对滑动(dx/dy),
 * 显示缩放不碰任何判定。
 */
export function canvasDisplayCapPx(
  nativeH: number,
  roomPx: number,
  min = MIN_CANVAS_DISPLAY_PX
): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  // 差一个像素以内不算超:亚像素抖动不值得为它改样式
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}
