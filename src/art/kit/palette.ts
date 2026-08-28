/**
 * 1.3 素材包 · 调色板（`src/art/kit/palette.ts`）
 *
 * 窗口 1 与窗口 5 各自写过一份。合并后两套 API 并存：
 * - 窗口 1：`KIT_PALETTE` / `CHAR_COLORS` / `tint` / `tryHexToRgb`，
 *   `shade(hex, 0–1)` 往黑混（`shade(hex, 1)` = 纯黑）。
 * - 窗口 5：`PASTELS` / `withAlpha`，`shade(hex, ±100)` 正数朝白、负数朝黑，
 *   `hexToRgb` 返回 `[r,g,b]`（认不出则中性灰）。
 * `shade` 按 amount 分流：`amount < 0` 或 `amount > 1` 走 ±100，其余走 0–1。
 * 纯数据 + 纯函数：不碰 DOM、不建 canvas、零依赖。
 */

/** 角色四件套配色：主色（最大面积）/ 辅色（脸、浅面）/ 点缀（配饰）/ 描边 */
export interface CharColorSet {
  primary: string;
  secondary: string;
  accent: string;
  outline: string;
}

/** 粉彩基础调色板 —— 76 款游戏画背景与通用道具时优先取这里 */
export const KIT_PALETTE = {
  /** 背景暖白（纸面） */
  paper: "#fff7ef",
  /** 纯白（云朵、高光） */
  cloud: "#ffffff",
  /** 日间天空 */
  sky: "#bfe4fb",
  /** 深一号天空（远景层） */
  skyDeep: "#8ec9f2",
  /** 草地 */
  grass: "#a9dd8f",
  /** 深草（草地暗部） */
  grassDeep: "#7cbf68",
  /** 糖果粉 */
  candy: "#ffb3d2",
  /** 深糖果粉（爱心、+1 飞字） */
  candyDeep: "#f2789f",
  /** 柠檬黄 */
  lemon: "#ffe38a",
  /** 薄荷绿 */
  mint: "#a5e6c8",
  /** 星光金（金币、星星收集物） */
  starGold: "#ffd34e",
  /** 蜜桃橙 */
  peach: "#ffc9a6",
  /** 丁香紫 */
  lilac: "#cfb7f2",
  /** 珊瑚红（警示色带、危险语义） */
  coral: "#ff8d7a",
  /** 宝石蓝（drawGem 默认） */
  gem: "#79c8ef",
  /** 石灰蓝（尖刺石面） */
  stone: "#c7cede",
  /** 浅木色（木箱前脸） */
  woodLight: "#d9a066",
  /** 深木色（木箱边框） */
  woodDark: "#8a5a32",
  /** 深可可（通用描边） */
  cocoa: "#6b4f3f",
  /** 墨色（眼睛、文字，非纯黑更柔和） */
  ink: "#4a3b3e",
  /** 夜空蓝 */
  nightBlue: "#3f4f74",
  /** 腮红粉 */
  blush: "#ff9db4"
} as const;

/**
 * 朵朵 / 星星的正装配色。两人的 primary 必须不同色相（宪法：双人一眼可区分）：
 * 朵朵是粉色系（约 335° 色相），星星是金黄系（约 47° 色相）。
 */
export const CHAR_COLORS: Readonly<Record<"duoduo" | "xingxing", CharColorSet>> = {
  duoduo: {
    primary: "#ff8fbf",
    secondary: "#ffeaf3",
    accent: "#79c86e",
    outline: "#874f68"
  },
  xingxing: {
    primary: "#ffcf4d",
    secondary: "#fff2c4",
    accent: "#5fa8e8",
    outline: "#8a6420"
  }
};

/** 粉彩主色 token（窗口 5 起，给还没有自己配色板的游戏当起点） */
export const PASTELS = {
  pink: "#F4859F",
  blue: "#7FB2F0",
  mint: "#7FE7C4",
  lemon: "#FFE8A3",
  lilac: "#C9A8F0",
  peach: "#FFB36B"
} as const;

const HEX_RE = /^#[0-9a-f]{6}$/i;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

/** 窗口 1：解析失败返回 null，不抛 */
export function tryHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string" || !HEX_RE.test(hex)) return null;
  return parseHex(hex);
}

/**
 * 窗口 5：`#RGB` / `#RRGGBB` → `[r, g, b]`。
 * 认不出来退回中性灰，不抛错（绘制层不许炸）。
 */
export function hexToRgb(hex: string): [number, number, number] {
  const rgb = parseHex(hex);
  if (!rgb) return [128, 128, 128];
  return [rgb.r, rgb.g, rgb.b];
}

function channel(n: number): string {
  const v = Math.round(Math.min(255, Math.max(0, n)));
  return v.toString(16).padStart(2, "0");
}

/** 三通道拼回小写 `#rrggbb`（越界自动截到 0–255） */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mixToward(hex: string, target: number, amount: number): string {
  const rgb = tryHexToRgb(hex);
  if (!rgb) return hex;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return hex.toLowerCase();
  const a = Math.min(1, Math.max(0, amount));
  return rgbToHex(
    rgb.r + (target - rgb.r) * a,
    rgb.g + (target - rgb.g) * a,
    rgb.b + (target - rgb.b) * a
  );
}

/** 窗口 1：往黑混，amount 0–1。非法 hex 原样返回。 */
function shadeUnit(hex: string, amount: number): string {
  return mixToward(hex, 0, amount);
}

/** 窗口 5：n 取 ±100。正数朝白，负数朝黑。非法 hex 按中性灰再混。 */
function shadePercent(hex: string, n: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = Math.max(-100, Math.min(100, n)) / 100;
  const mix = (v: number): number => (f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return `#${channel(mix(r))}${channel(mix(g))}${channel(mix(b))}`;
}

/**
 * 明暗推导。两套调用约定并存：
 * - `0 ≤ n ≤ 1`：窗口 1，往黑混（`1` = 纯黑）。
 * - `n < 0` 或 `n > 1`：窗口 5，±100 百分数。
 */
export function shade(hex: string, amount: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return mixToward(typeof hex === "string" ? hex : String(hex), 0, amount);
  }
  if (amount < 0 || amount > 1) return shadePercent(hex, amount);
  return shadeUnit(hex, amount);
}

/** 推导高光：amount 0–1 越大越白。非法输入原样返回、不抛。 */
export function tint(hex: string, amount: number): string {
  return mixToward(hex, 255, amount);
}

/** 十六进制主色 → rgba 字符串（拖尾渐隐 / 光索这类要透明度的地方用） */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}
