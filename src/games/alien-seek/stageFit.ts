/**
 * C-6:寻找外星朋友画布按宽等比长高(1000×640)时,915×412 / 360×640
 * 会把工具条和 D-pad 顶出 `.game-stage` 裁切线。只钳显示高,场景坐标与判定不动。
 */
export const MIN_CANVAS_DISPLAY_PX = 120;

export function canvasDisplayCapPx(
  nativeH: number,
  roomPx: number,
  min = MIN_CANVAS_DISPLAY_PX
): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}

export function rectBottom(r: { top: number; bottom?: number; height: number }): number {
  return Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;
}

/** 往上找 `.game-stage` 裁切下沿;量不到返回 NaN,钳位失效、画布仍按宽算。 */
export function stageClipBottom(from: HTMLElement): number {
  let node: HTMLElement | null = from.parentElement;
  for (let i = 0; node && i < 10; i++) {
    if (typeof node.className === "string" && node.className.includes("game-stage")) {
      if (typeof node.getBoundingClientRect !== "function") break;
      const r = node.getBoundingClientRect();
      const inner =
        typeof node.clientHeight === "number" && node.clientHeight > 0
          ? (node.clientTop || 0) + node.clientHeight
          : r.height;
      if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
      break;
    }
    node = node.parentElement;
  }
  return Number.NaN;
}

/**
 * 画布顶到裁切线,扣掉画布下面的线索 / 清单 / 工具 / D-pad / 提示。
 * 量不出矩形就返回 NaN。
 */
export function canvasRoomPx(canvas: HTMLElement, wrap: HTMLElement): number {
  if (typeof canvas.getBoundingClientRect !== "function") return Number.NaN;
  if (typeof wrap.getBoundingClientRect !== "function") return Number.NaN;
  const clip = stageClipBottom(wrap);
  if (!Number.isFinite(clip)) return Number.NaN;
  const canvasRect = canvas.getBoundingClientRect();
  if (!Number.isFinite(canvasRect.top)) return Number.NaN;
  const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
  return clip - canvasRect.top - below - 4;
}
