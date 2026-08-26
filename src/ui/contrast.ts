/**
 * 对比度计算(纯函数,无 DOM 依赖)。
 *
 * 只实现 WCAG 2.1 定义的那一套:sRGB 通道 → 线性化 → 相对亮度 → 对比度。
 * 全站配色的「关键色对」也放在这里(`CONTRAST_CHECKS`),
 * 单测直接遍历它做回归,谁把某个颜色调浅了都会当场红。
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG AA:正文(小于 18.66px 常规 / 24px 粗体)最低对比度 */
export const AA_NORMAL = 4.5;

/** WCAG AA:大字号(≥ 24px 常规,或 ≥ 18.66px 粗体)最低对比度 */
export const AA_LARGE = 3;

/** WCAG AAA:正文最低对比度(本项目只当加分项,不做硬性要求) */
export const AAA_NORMAL = 7;

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function clamp255(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

/**
 * 解析 `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`。
 * 带 alpha 的写法只取颜色分量,透明度请用 {@link blendOver} 显式合成。
 */
export function parseHex(input: string): Rgb {
  const raw = typeof input === "string" ? input.trim() : "";
  const m = HEX_RE.exec(raw);
  if (!m) throw new Error(`不认识的颜色写法:${input}`);
  let hex = m[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  hex = hex.slice(0, 6);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

/** 颜色可以写成 `#rrggbb` 字符串,也可以直接给 {@link Rgb} */
export type ColorLike = string | Rgb;

export function toRgb(color: ColorLike): Rgb {
  if (typeof color === "string") return parseHex(color);
  return { r: clamp255(color.r), g: clamp255(color.g), b: clamp255(color.b) };
}

/** 单通道 sRGB(0–255)线性化 */
export function channelToLinear(value255: number): number {
  const c = clamp255(value255) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 相对亮度(0 = 纯黑,1 = 纯白) */
export function relativeLuminance(color: ColorLike): number {
  const { r, g, b } = toRgb(color);
  return (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  );
}

/** 两色对比度,范围 1–21,与前后顺序无关 */
export function contrastRatio(a: ColorLike, b: ColorLike): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 半透明色压在底色上之后的实色(alpha 0–1) */
export function blendOver(fg: ColorLike, alpha: number, bg: ColorLike): Rgb {
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  const f = toRgb(fg);
  const b = toRgb(bg);
  return {
    r: clamp255(f.r * a + b.r * (1 - a)),
    g: clamp255(f.g * a + b.g * (1 - a)),
    b: clamp255(f.b * a + b.b * (1 - a))
  };
}

/**
 * 线性渐变上某一点的颜色(t = 0 取 from,t = 1 取 to)。
 * 卡片背景是「彩色 → 白」的渐变,文字落在中段,用这个算它真正压着的底色。
 */
export function mixColors(from: ColorLike, to: ColorLike, t: number): Rgb {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return blendOver(to, k, from);
}

/** 这段文字按 WCAG 算不算「大字号」(≥24px 常规 或 ≥18.66px 粗体) */
export function isLargeText(fontSizePx: number, bold = false): boolean {
  if (!Number.isFinite(fontSizePx)) return false;
  return bold ? fontSizePx >= 18.66 : fontSizePx >= 24;
}

/** 这段文字的最低对比度要求 */
export function requiredRatio(fontSizePx: number, bold = false): number {
  return isLargeText(fontSizePx, bold) ? AA_LARGE : AA_NORMAL;
}

/** 对比度是否达标(默认按正文 4.5:1) */
export function meetsAA(fg: ColorLike, bg: ColorLike, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? AA_LARGE : AA_NORMAL) - 1e-9;
}

/** 保留两位小数,断言失败时的报错信息好读一点 */
export function ratio2(fg: ColorLike, bg: ColorLike): number {
  return Math.round(contrastRatio(fg, bg) * 100) / 100;
}

// ---------------------------------------------------------------------------
// 全站关键色对(改配色必须同步改这里,否则单测会红)
// ---------------------------------------------------------------------------

/** styles.css 里的核心色板;单测会校验它和 CSS 变量的实际取值一致 */
export const PALETTE = {
  card: "#ffffff",
  ink: "#4a3b45",
  inkSoft: "#5c4b56",
  pinkDeep: "#b52f74",
  pinkStrong: "#cf3d86",
  pinkSoft: "#ffd9ea",
  /** 首页卡片渐变的白端 */
  cardWhite: "#ffffff"
} as const;

export interface ContrastCheck {
  /** 出现在哪儿,断言失败时一眼能定位 */
  where: string;
  fg: string;
  bg: string;
  /** 这段文字的字号(px),用来决定 4.5 还是 3 */
  fontSizePx: number;
  bold?: boolean;
}

/**
 * 关键色对清单。
 * 背景一律取「文字实际压着的最深那一层」:渐变取深端附近、半透明先合成成实色。
 */
export const CONTRAST_CHECKS: readonly ContrastCheck[] = [
  { where: "正文 --ink / 白底卡片", fg: PALETTE.ink, bg: "#ffffff", fontSizePx: 16 },
  { where: "正文 --ink / 粉彩底", fg: PALETTE.ink, bg: PALETTE.pinkSoft, fontSizePx: 16 },
  { where: "次要文字 --ink-soft / 白底", fg: PALETTE.inkSoft, bg: "#ffffff", fontSizePx: 14 },
  { where: "次要文字 --ink-soft / 粉彩底", fg: PALETTE.inkSoft, bg: PALETTE.pinkSoft, fontSizePx: 14 },
  { where: "问候语 --ink-soft / 淡蓝背景", fg: PALETTE.inkSoft, bg: "#eef6ff", fontSizePx: 17 },
  { where: "卡片简介 --ink-soft / 卡片渐变中段", fg: PALETTE.inkSoft, bg: "#f6e9f0", fontSizePx: 14 },
  { where: "深粉链接色 --pink-deep / 白底", fg: PALETTE.pinkDeep, bg: "#ffffff", fontSizePx: 18 },
  { where: "主按钮白字 / 渐变浅端 --pink-strong", fg: "#ffffff", bg: PALETTE.pinkStrong, fontSizePx: 21, bold: true },
  { where: "描边按钮 --pink-deep / 白底", fg: PALETTE.pinkDeep, bg: "#ffffff", fontSizePx: 21, bold: true },
  { where: "危险按钮红字 / 白底", fg: "#a52a20", bg: "#ffffff", fontSizePx: 17 },
  { where: "星星芯片棕字 / 淡黄底", fg: "#7a520a", bg: "#fff4d6", fontSizePx: 19, bold: true },
  { where: "页签未选中 --ink-soft / 近白底", fg: PALETTE.inkSoft, bg: "#f7f4f6", fontSizePx: 19, bold: true },
  { where: "页签选中白字 / 粉渐变浅端", fg: "#ffffff", bg: PALETTE.pinkStrong, fontSizePx: 19, bold: true },
  { where: "最近玩过副标题 / 卡片渐变中段", fg: PALETTE.inkSoft, bg: "#f3e6ee", fontSizePx: 12.5, bold: true },
  { where: "99 关进度徽章 / 近白底", fg: "#5f3f8f", bg: "#ffffff", fontSizePx: 13, bold: true },
  { where: "结算失败标题 / 淡蓝弹窗底(大字)", fg: "#41599c", bg: "#f4f8ff", fontSizePx: 30, bold: true },
  { where: "结算鼓励语 --ink-soft / 弹窗白底", fg: PALETTE.inkSoft, bg: "#fff9fc", fontSizePx: 17 },
  { where: "弹窗说明文字 --ink-soft / 弹窗白底", fg: PALETTE.inkSoft, bg: "#fff9fc", fontSizePx: 15 },
  { where: "攻略标题 / 抽屉粉白底", fg: "#7a3f66", bg: "#fff8fc", fontSizePx: 20, bold: true },
  { where: "攻略小节标题 / 白底", fg: "#6a3f80", bg: "#ffffff", fontSizePx: 16, bold: true },
  { where: "攻略正文 / 白底", fg: "#4b3f52", bg: "#ffffff", fontSizePx: 15 },
  { where: "攻略关卡角标 / 淡紫底", fg: "#4c3070", bg: "#ede4ff", fontSizePx: 14, bold: true },
  { where: "攻略提醒 / 淡橙底", fg: "#7a4a2e", bg: "#fff3e2", fontSizePx: 14, bold: true },
  { where: "攻略关闭按钮 / 白底", fg: "#5f3d51", bg: "#ffffff", fontSizePx: 17, bold: true },
  { where: "攻略「知道啦」白字 / 深粉底", fg: "#ffffff", bg: "#b3306f", fontSizePx: 16, bold: true },
  { where: "暂停面板标题 / 白底(大字)", fg: PALETTE.pinkDeep, bg: "#fff9fc", fontSizePx: 26, bold: true },
  { where: "暂停面板说明 --ink-soft / 白底", fg: PALETTE.inkSoft, bg: "#fff9fc", fontSizePx: 15 },
  { where: "选关地图章节说明 / 淡紫白底", fg: "#5c4783", bg: "#fbf7ff", fontSizePx: 13, bold: true },
  { where: "选关地图格子序号 / 白底", fg: "#4f4173", bg: "#ffffff", fontSizePx: 17, bold: true },
  { where: "选关地图翻页提示 / 淡紫白底", fg: "#5c4783", bg: "#fbf7ff", fontSizePx: 12, bold: true },
  { where: "首页页脚 --ink-soft / 淡黄背景", fg: PALETTE.inkSoft, bg: "#fdfff2", fontSizePx: 14 }
];
