/**
 * 1.2 新增:手机上的文字约定。
 *
 * 「在 360px 宽的手机上字看得清、不溢出、不贴 Home 条」以前只能靠肉眼调,
 * 这里把它写成一组常量与纯函数,`styles.css` 照着写,单测照着巡检。
 * 本文件不碰颜色对比度(那归 `contrast.ts` 管),只管字号、行高、换行与安全区。
 */

/** 正文字号下限:说明文字、卡片介绍都不许比它小 */
export const MIN_BODY_PX = 16;

/** 控件字号下限:按钮文字、关卡格子里的数字可以小一点,但不能小过它 */
export const MIN_CONTROL_PX = 14;

/** 360px 宽时标题的字号下限 */
export const MIN_TITLE_PX_AT_360 = 20;

/** 行高下限:汉字排得太挤会连成一片 */
export const MIN_LINE_HEIGHT = 1.4;

/** 窄屏断点:验收视口就是 360 × 640 */
export const NARROW_BREAKPOINT = 360;

/** 底部安全区至少留这么多,免得贴上 Home 条 */
export const MIN_SAFE_BOTTOM_PX = 12;

/** 正文字号夹取:比下限小就抬到下限,脏值也给一个能看的数 */
export function clampBodyPx(px: number): number {
  if (!Number.isFinite(px)) return MIN_BODY_PX;
  return Math.max(MIN_BODY_PX, Math.round(px));
}

/** 控件字号夹取(按钮、关卡格子数字) */
export function clampControlPx(px: number): number {
  if (!Number.isFinite(px)) return MIN_CONTROL_PX;
  return Math.max(MIN_CONTROL_PX, Math.round(px));
}

/** 行高夹取 */
export function clampLineHeight(lh: number): number {
  if (!Number.isFinite(lh)) return MIN_LINE_HEIGHT;
  return Math.max(MIN_LINE_HEIGHT, lh);
}

/** 标题的 `clamp()` 串:360px 时不小于 20px,宽屏才放大 */
export function titleClamp(minPx: number = MIN_TITLE_PX_AT_360, maxPx = 30): string {
  const lo = Math.max(MIN_TITLE_PX_AT_360, Math.round(minPx));
  const hi = Math.max(lo, Math.round(maxPx));
  return `clamp(${lo}px, 5.4vw, ${hi}px)`;
}

/** 底部安全区表达式:至少 12px,有刘海屏就按系统给的来 */
export function safeBottom(minPx: number = MIN_SAFE_BOTTOM_PX): string {
  const px = Math.max(0, Math.round(Number.isFinite(minPx) ? minPx : MIN_SAFE_BOTTOM_PX));
  return `max(${px}px, env(safe-area-inset-bottom))`;
}

/** 这个宽度算不算窄屏(360px 及以下按窄屏排版) */
export function isNarrow(width: number): boolean {
  if (!Number.isFinite(width) || width <= 0) return false;
  return width <= NARROW_BREAKPOINT;
}

/** 巡检 `styles.css` 时必须出现的关键字 */
export const MOBILE_CSS_MARKERS: string[] = [
  "1.2 mobile text",
  "safe-area-inset",
  "overflow-wrap",
  "word-break",
  "360px"
];

/** 长文案的换行规则:汉字长串也要能断,绝不横向溢出 */
export const WRAP_RULES: string[] = ["overflow-wrap: anywhere", "word-break: break-word"];

/** 把上面这套约定写成 CSS 变量,挂到某个根节点上(唯一一处 DOM 操作) */
export function applyMobileTextVars(root: { style?: { setProperty(k: string, v: string): void } } | null): void {
  const style = root?.style;
  if (!style) return;
  style.setProperty("--mt-body", `${MIN_BODY_PX}px`);
  style.setProperty("--mt-control", `${MIN_CONTROL_PX}px`);
  style.setProperty("--mt-line", String(MIN_LINE_HEIGHT));
  style.setProperty("--mt-title", titleClamp());
  style.setProperty("--mt-safe-bottom", safeBottom());
}
