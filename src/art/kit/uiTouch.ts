/**
 * uiTouch.ts —— 窗口 6 第 2 轮 W6R1-09/10:壳层触区与正文字号统一抬升。
 *
 * 背景:第 1 轮 A 档专项⑤登记了 9 款壳层按钮高 26–38px、正文字号 10–13px 的存量清单
 * (W6R1-09/10),第 1 轮 C 档明确「第 2 轮统一抬」,防止单款零敲碎打造成 9 款不一致。
 * 本文件是该统一规格的唯一出处(kit 只增不改,不动任何既有 kit 文件)。
 *
 * 约定:
 * - 可点触区最小高度 44px(MIN_TOUCH_PX);过窄按钮补最小宽度 44px(MIN_TOUCH_WIDE_PX)。
 * - 正文类字号最低 16px(MIN_BODY_FONT_PX);纯装饰记号(图案角标、共享壳层 l99-star)
 *   豁免但需在 QA 报告登记。
 * - 只输出附加 CSS(min-height / min-width / font-size),追加在各款 CSS 末尾生效;
 *   不改布局模型、不动任何热区判定与宽度既有规则(如 bubble-pop 宽屏 .bp-cell 36px)。
 */

export const MIN_TOUCH_PX = 44;
export const MIN_TOUCH_WIDE_PX = 44;
export const MIN_BODY_FONT_PX = 16;

/** 触区抬升:给按钮类选择器补最小高度(可选补最小宽度),内容仍按浏览器按钮默认垂直居中 */
export function touchUpliftCss(selectors: readonly string[], opts?: { minWidth?: boolean }): string {
  if (!selectors.length) return "";
  const extra = opts?.minWidth ? `min-width:${MIN_TOUCH_WIDE_PX}px;` : "";
  return `${selectors.join(",")}{min-height:${MIN_TOUCH_PX}px;${extra}}`;
}

/** 正文字号抬升:给正文类选择器统一到 ≥16px(追加在款内 CSS 末尾,可覆盖窄屏 media 的更小值) */
export function bodyFontUpliftCss(selectors: readonly string[]): string {
  if (!selectors.length) return "";
  return `${selectors.join(",")}{font-size:${MIN_BODY_FONT_PX}px;}`;
}
