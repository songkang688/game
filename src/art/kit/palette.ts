/**
 * 1.3 素材包 · 调色板（`src/art/kit/palette.ts`）
 *
 * 全项目共享的粉彩底色、朵朵 / 星星角色配色，以及 shade / tint 明暗推导。
 * 纯数据 + 纯函数：不碰 DOM、不建 canvas、零依赖。
 * 色值一律小写 `#rrggbb`，方便素材契约测试逐个校验。
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

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** 解析 `#rrggbb`；非法输入返回 null，不抛 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string" || !HEX_RE.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function channel(n: number): string {
  const v = Math.round(Math.min(255, Math.max(0, n)));
  return v.toString(16).padStart(2, "0");
}

/** 三通道拼回小写 `#rrggbb`（越界自动截到 0–255） */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** 往 target（0 = 黑，255 = 白）混 amount 比例；非法 hex 原样返回 */
function mixToward(hex: string, target: number, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return hex.toLowerCase();
  const a = Math.min(1, Math.max(0, amount));
  return rgbToHex(
    rgb.r + (target - rgb.r) * a,
    rgb.g + (target - rgb.g) * a,
    rgb.b + (target - rgb.b) * a
  );
}

/** 推导暗部：amount 0–1 越大越黑。非法输入原样返回、不抛。 */
export function shade(hex: string, amount: number): string {
  return mixToward(hex, 0, amount);
}

/** 推导高光：amount 0–1 越大越白。非法输入原样返回、不抛。 */
export function tint(hex: string, amount: number): string {
  return mixToward(hex, 255, amount);
}
