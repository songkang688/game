// 360px 手机上的手指口径：任何能点的东西都得留出 44 CSS px 见方。
//
// 这一款是纯画布，没有 CSS 可以兜底 —— 热区就是 `inRect` 拿去比的那个矩形。
// 顶栏的「◀ 回家」「🎁 收藏册」这几颗按钮真画到 44px 会压到 HUD 第二行和章节标题，
// 所以走另一条路：**画的还是原来那颗小按钮，能点的范围往外扩到 44px 见方**。
export const MIN_HIT_PX = 44;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 把一个矩形撑到至少 44px 见方，以原矩形为中心往外扩。
 *
 * 扩到画布外面的那一截手指够不着，所以左上角一律推回 0 —— 顶栏那几颗按钮本来就贴着边，
 * 不推回来的话看着是 44px，真正落在画布里的只有 42px。
 */
export function touchArea(r: Rect): Rect {
  const w = Math.max(r.w, MIN_HIT_PX);
  const h = Math.max(r.h, MIN_HIT_PX);
  return {
    x: Math.max(0, r.x + (r.w - w) / 2),
    y: Math.max(0, r.y + (r.h - h) / 2),
    w,
    h,
  };
}
