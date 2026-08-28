/**
 * N-16 · 走廊引擎画布按可视余量钳高（闯关 / 无尽遗迹 / 计时速通三态共用）。
 *
 * 旧算法 `clamp(cssW×0.9, 250, 430)` 在 915×412 给出 430px，触控键排整排掉到
 * `.game-stage` 裁切线下。量不到裁切祖先时原样返回 want，竖屏/宽屏零回归。
 * 古堡 `advk-shell` 不走这条函数。
 */

export const CORRIDOR_CANVAS_MIN_H = 140;

/** 想按宽算出的画布高（与修前 syncSize 同一条公式） */
export function corridorWantH(hostW: number): number {
  const w = Math.max(240, Math.round(hostW));
  const raw = Math.round(w * 0.9);
  return Math.max(250, Math.min(430, raw));
}

/**
 * 画布该多高：want 按宽，room 是宿主顶到裁切线，below 是键排+提示行。
 * 量不出 room 时一字不改 want。
 */
export function corridorCanvasCssH(
  want: number,
  room: number,
  below: number,
  min = CORRIDOR_CANVAS_MIN_H
): number {
  if (!Number.isFinite(want)) return want;
  if (!Number.isFinite(room) || room <= 0) return want;
  const chrome = Number.isFinite(below) && below > 0 ? below : 0;
  const fits = Math.floor(room - chrome - 4);
  return Math.max(min, Math.min(want, fits));
}

/** 从 el 顶到最近 overflow 裁切祖先 padding 下沿还剩多少；没有裁切祖先则 Infinity */
export function measureClipRoomPx(el: HTMLElement): number {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return Number.POSITIVE_INFINITY;
  const bottoms: number[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = view.getComputedStyle(p);
    const oy = cs.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      const rect = p.getBoundingClientRect();
      const border = Number.parseFloat(cs.borderBottomWidth);
      const bottom =
        Number.isFinite(p.clientHeight) && p.clientHeight > 0
          ? rect.top + p.clientTop + p.clientHeight
          : Number.isFinite(border) && border > 0
            ? rect.bottom - border
            : rect.bottom;
      bottoms.push(bottom);
    }
  }
  if (bottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...bottoms) - el.getBoundingClientRect().top;
}
