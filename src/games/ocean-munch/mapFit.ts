/**
 * 选关界面的布局小工具(1.3 UX 走查修复,纯函数便于单测):
 *
 *  1. `fitLineWith`:章节卡标题 / 简介按卡片内宽截断补省略号。
 *     390px 手机是两列卡,一张卡只有 150px 上下,「第10章 夜露温室」这种
 *     长标题直接 fillText 会横着捅进邻卡、再被锁图标压住 —— 先量宽再画。
 *  2. `mapRowYs`:关卡地图的行 Y 坐标。老写法把 3 行节点均摊到整个画布高,
 *     行距能拉到 300px,地图像漏了气 —— 行距夹上限后整块居中。
 *  3. `unlockedWithRoot`:管理员权限(kangkang 密码,src/ui/root12Contract)
 *     开着时所有关卡一律可进;关着/过期时回落到本游戏自己的星级解锁。
 */

/** 按最大宽度截断一行文字,截掉时补「…」;measure 由调用方注入(canvas 的 measureText) */
export function fitLineWith(
  measure: (text: string) => number,
  text: string,
  maxW: number
): string {
  if (!Number.isFinite(maxW) || maxW <= 0) return "";
  if (measure(text) <= maxW) return text;
  const ell = "…";
  let lo = 0;
  let hi = text.length;
  // 二分找能塞下「前缀 + …」的最长前缀;全塞不下就只剩省略号
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + ell) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? ell : text.slice(0, lo) + ell;
}

/**
 * 关卡节点图的列数(trio-r7 收 r4 遗留,同 garden-guard 法)。
 * 后三章 29/30 关的大海域:横屏 6 列(5 行)、竖屏 4 列(原样)。
 * 前九章各 11 关的小海域原先也按 4 列排,3 行小圆点缩在画布正中显得空 ——
 * 竖屏改 3 列(4 行,节点能放大一号),横屏改 6 列(2 行,同样更大更满)。
 */
export function mapCols(count: number, w: number, h: number): number {
  const landscape = w > h * 1.1;
  if (count <= 11) return landscape ? 6 : 3;
  return landscape ? 6 : 4;
}

/** 节点半径上限:小海域行列都少,允许放大到 36(点击区也跟着变大);大海域保持 28 不挤 */
export function nodeRadiusCap(count: number): number {
  return count <= 11 ? 36 : 28;
}

/**
 * 关卡地图每一行的 Y 坐标(行距夹到 maxGap,整块在 [my0,my1] 里垂直居中)。
 * rows <= 1 时返回一行,放在区间正中。
 */
export function mapRowYs(rows: number, my0: number, my1: number, maxGap: number): number[] {
  const span = Math.max(0, my1 - my0);
  if (rows <= 1) return [my0 + span / 2];
  const gap = Math.min(maxGap, span / (rows - 1));
  const blockH = gap * (rows - 1);
  const y0 = my0 + (span - blockH) / 2;
  const out: number[] = [];
  for (let r = 0; r < rows; r++) out.push(y0 + gap * r);
  return out;
}

/** 管理员权限开着就全开;关着走本游戏自己的解锁判定 */
export function unlockedWithRoot(rootOpen: boolean, baseUnlocked: boolean): boolean {
  return rootOpen || baseUnlocked;
}
