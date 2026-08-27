/**
 * 共享美术套件 · 粉彩色板与调色工具（1.3 视觉升级 · 窗口8 B 档落的第一块砖）。
 *
 * 约定：一个文件只归一个人，这一份归 red-blue-tap（B 档）。
 * 全部是纯函数 + 常量，node 环境可测，不碰 DOM、不带运行时依赖。
 */

/** 粉彩基础 token：各款游戏做视觉皮肤时优先从这里取色 */
export const PASTEL = {
  /** 对抗红（暖而不刺眼，给小孩看的红） */
  red: "#E85D75",
  /** 对抗蓝 */
  blue: "#4A7FD8",
  /** 待机灰（信号灯的「还没轮到你」） */
  idleGray: "#C9CFD8",
  /** 预备黄（信号灯的「马上就来」） */
  readyYellow: "#F0C25A",
  /** 奖励金（星屑、正确反馈） */
  starGold: "#FFD678",
  /** 云朵白 */
  cloudWhite: "#FFFFFF",
  /** 夜空墨（深色描边基准） */
  inkNavy: "#2F4E86"
} as const;

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** 把 #RGB / #RRGGBB 解析成三个通道；解析不了返回 null（绝不抛错，视觉层坏了也不能拖垮玩法） */
export function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== "string") return null;
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16)
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number): string => clamp255(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/**
 * 加深 / 提亮一个颜色。
 * `pct` 是百分比：`shade("#E85D75", -12)` 往黑压 12%，`shade(hex, 10)` 往白提 10%。
 * 解析不了的输入原样返回，保证视觉层永远给得出一个能用的颜色。
 */
export function shade(hex: string, pct: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const p = Math.max(-100, Math.min(100, Number.isFinite(pct) ? pct : 0)) / 100;
  const mix = (c: number): number => (p >= 0 ? c + (255 - c) * p : c * (1 + p));
  return toHex(mix(rgb[0]), mix(rgb[1]), mix(rgb[2]));
}

/** 带透明度：`withAlpha("#FFD678", .6)` → `rgba(255,214,120,.6)` */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  if (!rgb) return hex;
  const short = Number((a).toFixed(3));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${short})`;
}
