/**
 * 共享美术套件 · 配色工具(1.3 视觉升级)。
 *
 * 约定:全库粉彩基调,光源统一左上 45°。`shade` 是所有「三停渐变 / 受光面 /
 * 深色描边」的唯一取色入口 —— 各游戏不许自己手写加深减淡的十六进制。
 * 纯字符串数学,零 DOM,node 测试环境可直接跑。
 */

/** 粉彩主色 token(给还没有自己配色板的游戏当起点) */
export const PASTELS = {
  pink: "#F4859F",
  blue: "#7FB2F0",
  mint: "#7FE7C4",
  lemon: "#FFE8A3",
  lilac: "#C9A8F0",
  peach: "#FFB36B",
} as const;

/** #RGB / #RRGGBB → [r, g, b];认不出来就退回中性灰,不抛错(绘制层不许炸) */
export function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [128, 128, 128];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function channel(v: number): string {
  return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
}

/**
 * 加深 / 减淡:n 取 ±100。正数朝白色靠 n%(受光面),负数朝黑色靠 |n|%(阴影与描边)。
 * `shade(c, 25)` 就是规格里的「顶光 +25%」,`shade(c, -15)` 是「腹部 -15%」。
 */
export function shade(hex: string, n: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = Math.max(-100, Math.min(100, n)) / 100;
  const mix = (v: number): number => (f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return `#${channel(mix(r))}${channel(mix(g))}${channel(mix(b))}`;
}

/** 十六进制主色 → rgba 字符串(拖尾渐隐 / 光索这类要透明度的地方用) */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}
