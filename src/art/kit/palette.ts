// 共享美术套件 · 粉彩色板与颜色换算(1.3 视觉升级 · 窗口 6 第 18 步 C 档落的文件)。
//
// 约定:这里只放「全库通用」的粉彩基础 token 与纯字符串颜色换算;
// 各游戏自己的皮肤色(比如 box-hamster 的 --bh- 系列)住在各自的视觉层,
// 用这里的 shade() 派生亮面 / 暗面,不许在运行时手拼魔法色值。
// 纯函数、零 DOM、零依赖;别的游戏只 import,要新能力就在 kit 里另起自己的文件。

/** 全库粉彩基础 token(和 sparkle.ts 的五色一家人,外加纸底和墨字) */
export const PASTEL = {
  /** 米白纸底 */
  paper: "#FFF8EC",
  /** 深棕墨字 */
  ink: "#7A5433",
  pink: "#ffb6c9",
  blue: "#a9d8ff",
  mint: "#8fe0c4",
  lemon: "#ffd75e",
  lilac: "#d9bcff",
} as const;

/** #rgb / #rrggbb → [r, g, b](0..255) */
export function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const t = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  const n = parseInt(t, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r, g, b] → 小写 #rrggbb(各分量先夹到 0..255) */
export function rgbToHex(r: number, g: number, b: number): string {
  const one = (x: number): string =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${one(r)}${one(g)}${one(b)}`;
}

/**
 * 同色系提亮 / 压暗:shade(hex, +20) 往白提亮 20%,shade(hex, -22) 往黑压暗 22%。
 * 立柱投影 / 箱子侧面这类「主色暗一档」的换算全走它,输出小写 #rrggbb。
 */
export function shade(hex: string, percent: number): string {
  const k = Math.max(-100, Math.min(100, percent)) / 100;
  const [r, g, b] = hexToRgb(hex);
  const to = k >= 0 ? 255 : 0;
  const t = Math.abs(k);
  const m = (x: number): number => x + (to - x) * t;
  return rgbToHex(m(r), m(g), m(b));
}

/** 感知加权明度(0..1):对比度自查用,不追求色度学上的严格 */
export function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
