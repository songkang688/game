/**
 * N-16(trio-r7)· 走廊引擎画布显示高的可视余量(纯函数,配方 B 之 1)。
 *
 * 病根:`syncSize` 的 cssH = clamp(cssW*0.9, 250, 430),915×412 一族里 430px
 * 画布独吞整个视口,◀ ▶ 跳 🪃 🪝 ⏸ 六个实时触控键连同提示行全部折叠线下
 * (r5 量得裁 332/出屏 204;r7 复测闯关 304 / 无尽遗迹 258 / 速通同引擎)。
 *
 * 修法:mount 时量一次 `.game-stage` 可视下沿、画布上沿、画布下面的家当
 * (键排 + 提示行)实高,算出画布显示高的上限;syncSize 里 cssH 取小。
 * scale = cssH / VIEW_H 跟着走,等于把镜头拉远一点 —— 世界坐标、跑跳判定、
 * 关卡数据零触碰。闯关 / 无尽遗迹 / 计时速通共用 createRunner,一次修三态。
 */

/** 显示高下限:比这再矮连朵朵都看不清,宁可留一点滚动 */
export const CORRIDOR_MIN_DISPLAY_PX = 160;

/**
 * 画布显示高上限(px)。量不到(jsdom / 还没排版)返回 null = 不钳。
 * @param clipBottom `.game-stage` 可视下沿(top + clientHeight)
 * @param canvasTop  画布上沿(viewport 坐标)
 * @param belowPx    画布下面的家当实高(键排 + 提示行,按 wrap 下沿 − 画布下沿量,
 *                   天然含 flex 的两道 8px 纵缝)
 * @param slackPx    呼吸位(默认 4px,和 dot-maze 的钳高一致)
 */
export function corridorRoomPx(
  clipBottom: number,
  canvasTop: number,
  belowPx: number,
  slackPx = 4
): number | null {
  if (!Number.isFinite(clipBottom) || clipBottom <= 0) return null;
  if (!Number.isFinite(canvasTop)) return null;
  const room = Math.floor(clipBottom - canvasTop - Math.max(0, belowPx) - slackPx);
  if (!Number.isFinite(room) || room <= 0) return null;
  return Math.max(CORRIDOR_MIN_DISPLAY_PX, room);
}
