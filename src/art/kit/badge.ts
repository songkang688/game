/**
 * 共享美术套件 · 参数化 SVG 圆徽章（1.3 视觉升级 · 窗口 6 第 17 步 A 档落的文件）。
 *
 * 给 DOM/SVG 游戏用的角色徽章：圆底 + 阵营/职业色环 + 自绘中心图标 + 底部小影，
 * 全部是字符串模板函数，零运行时依赖、零位图。颜色统一收在 `BADGE_BASE` /
 * `BADGE_RING` / `BADGE_INK` 里，调用方不许在运行时拼魔法色值。
 *
 * 六套规格图标起步（勇者三职业 + 怪物三剪影），另带两套「一朵一星」通用角色：
 *  - swordsman 剑士（交叉双剑 · 金环）    - jelly    果冻怪（半圆 + 波浪底 · 绿环）
 *  - mage      法师（星杖 · 蓝环）        - mushroom 蘑菇怪（伞盖 + 斑点 · 橙环）
 *  - priest    牧师（花十字 · 粉环）      - rock     石头怪（圆角多边形 + 裂缝 · 灰环）
 *  - flower    朵朵（五瓣小花）           - star     星星（五角星影子）
 *
 * 约定（对齐 1.3 视觉规格）：
 *  - viewBox 64×64，主体圆直径 52 ≈ 82%，徽章默认吃满宿主格子（width/height 100%）；
 *  - 主体圆 1.5px 深色描边，色环 3px；
 *  - 底部小影是 rgba(0,0,0,.12) 的椭圆；
 *  - 怪物可带右下等级角标（`opts.level`）；
 *  - 纯装饰输出，自带 aria-hidden，读屏由宿主的文字负责。
 */

export type BadgeKind =
  | "swordsman"
  | "mage"
  | "priest"
  | "jelly"
  | "mushroom"
  | "rock"
  | "flower"
  | "star";

export const BADGE_KINDS: readonly BadgeKind[] = [
  "swordsman",
  "mage",
  "priest",
  "jelly",
  "mushroom",
  "rock",
  "flower",
  "star"
];

export interface BadgeOpts {
  /** 固定像素尺寸；不给就 100% 吃满宿主容器 */
  size?: number;
  /** 底色阵营：勇者暖白 / 怪物淡紫。不给就按 kind 的默认阵营 */
  camp?: "hero" | "foe";
  /** 右下等级角标（怪物专用），1..99 之外不画 */
  level?: number;
  /** 覆盖色环颜色（一般不用，留给特殊皮肤） */
  ring?: string;
}

/** 圆底底色：勇者暖白 / 怪物淡紫 */
export const BADGE_BASE = { hero: "#FFF7EC", foe: "#EFE7F8" } as const;

/** 职业 / 怪物色环：剑士金、法师蓝、牧师粉；果冻绿、蘑菇橙、石头灰 */
export const BADGE_RING: Record<BadgeKind, string> = {
  swordsman: "#E3A82F",
  mage: "#5F9BE8",
  priest: "#F48FB1",
  jelly: "#7CC96B",
  mushroom: "#F0964A",
  rock: "#9A93A6",
  flower: "#F48FB1",
  star: "#E3A82F"
};

/** 描边墨色与底部小影 */
export const BADGE_INK = "#4B3A6E";
export const BADGE_SHADOW = "rgba(0,0,0,.12)";

/** 这些 kind 默认算勇者阵营，其余算怪物阵营 */
const HERO_SIDE: ReadonlySet<BadgeKind> = new Set(["swordsman", "mage", "priest", "flower"]);

/** 正多角星的多边形顶点（给法师星杖与星星影子共用） */
function starPoints(cx: number, cy: number, outer: number, inner: number, tips: number): string {
  const pts: string[] = [];
  for (let i = 0; i < tips * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / tips;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** 五瓣小花（朵朵）：五个花瓣圆 + 花心 */
function flowerIcon(): string {
  let petals = "";
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = (32 + 8.6 * Math.cos(a)).toFixed(1);
    const y = (30 + 8.6 * Math.sin(a)).toFixed(1);
    petals += `<circle cx="${x}" cy="${y}" r="5.6" fill="#FFB2D8"/>`;
  }
  return `${petals}<circle cx="32" cy="30" r="4.8" fill="#F0C25A"/>`;
}

/** 中心图标：全部手绘路径，坐标基于 64×64、主体圆心 (32,30) */
const ICONS: Record<BadgeKind, (ring: string) => string> = {
  swordsman: (ring) =>
    `<path d="M22 19L42 39" stroke="#AEB6CC" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M42 19L22 39" stroke="#C6CDDF" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M25.5 35.5L19 42M38.5 35.5L45 42" stroke="${ring}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<circle cx="19" cy="42" r="2.6" fill="${ring}"/><circle cx="45" cy="42" r="2.6" fill="${ring}"/>`,
  mage: (ring) =>
    `<path d="M30 22L38 42" stroke="#B08A5A" stroke-width="3.8" stroke-linecap="round"/>` +
    `<polygon points="${starPoints(29, 20, 7.4, 3, 5)}" fill="${ring}"/>` +
    `<circle cx="29" cy="20" r="1.7" fill="#FFF7EC"/>`,
  priest: (ring) =>
    `<path d="M32 18v24M20 30h24" stroke="${ring}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="32" cy="30" r="4.4" fill="#FFF7EC"/><circle cx="32" cy="30" r="2" fill="#F0C25A"/>`,
  jelly: (ring) =>
    `<path d="M19 36v-4a13 12 0 0 1 26 0v4l-3.6 2.4-4.4-2.4-5 2.4-5-2.4-4.4 2.4z" fill="${ring}"/>` +
    `<path d="M23 27a9 8 0 0 1 8-6" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>` +
    `<circle cx="27" cy="32" r="1.9" fill="#FFFFFF"/><circle cx="37" cy="32" r="1.9" fill="#FFFFFF"/>`,
  mushroom: (ring) =>
    `<path d="M19 31a13 11.5 0 0 1 26 0l-1 2H20z" fill="${ring}"/>` +
    `<rect x="27.6" y="33" width="8.8" height="8.6" rx="3.4" fill="#F5E7D2"/>` +
    `<circle cx="26" cy="26" r="2.1" fill="#FFFFFF"/><circle cx="34" cy="23.4" r="1.7" fill="#FFFFFF"/>` +
    `<circle cx="39.4" cy="27.6" r="1.5" fill="#FFFFFF"/>`,
  rock: (ring) =>
    `<path d="M25 18.5l11-1.8 7.6 6.6 1.2 9.4-6.4 8-11.6 1-6.6-7.6 1-10.6z" fill="${ring}" stroke="#6E6880" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M30 23l3.6 5.6-2.6 6.8M36.6 25.4l3 4.4" stroke="#6E6880" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  flower: () => flowerIcon(),
  star: (ring) =>
    `<polygon points="${starPoints(32, 30, 12.5, 5.2, 5)}" fill="${ring}"/>` +
    `<circle cx="28.6" cy="28" r="1.6" fill="#FFF7EC"/><circle cx="35.4" cy="28" r="1.6" fill="#FFF7EC"/>`
};

/** 右下等级角标（怪物专用） */
function levelCorner(level: number): string {
  if (!Number.isFinite(level) || level < 1 || level > 99) return "";
  const n = Math.round(level);
  return (
    `<g data-part="level">` +
    `<circle cx="47" cy="45" r="8.4" fill="#FFFFFF" stroke="${BADGE_INK}" stroke-width="1.2"/>` +
    `<text x="47" y="48.4" text-anchor="middle" font-size="9.4" font-weight="800" fill="${BADGE_INK}" font-family="inherit">${n}</text>` +
    `</g>`
  );
}

/**
 * 生成一枚圆徽章的 SVG 字符串。
 * 主体圆直径 52/64 ≈ 82%，1.5px 描边，色环 3px，底部椭圆小影。
 */
export function badge(kind: BadgeKind, opts: BadgeOpts = {}): string {
  const camp = opts.camp ?? (HERO_SIDE.has(kind) ? "hero" : "foe");
  const base = BADGE_BASE[camp];
  const ring = opts.ring ?? BADGE_RING[kind];
  const sizeAttr =
    opts.size && Number.isFinite(opts.size)
      ? `width="${Math.round(opts.size)}" height="${Math.round(opts.size)}"`
      : `width="100%" height="100%"`;
  return (
    `<svg class="ak-badge ak-badge-${kind}" viewBox="0 0 64 64" ${sizeAttr} ` +
    `aria-hidden="true" focusable="false">` +
    `<ellipse cx="32" cy="58" rx="15" ry="3.4" fill="${BADGE_SHADOW}"/>` +
    `<circle cx="32" cy="30" r="26" fill="${base}" stroke="${BADGE_INK}" stroke-width="1.5"/>` +
    `<circle cx="32" cy="30" r="22.6" fill="none" stroke="${ring}" stroke-width="3"/>` +
    `<g data-icon="${kind}">${ICONS[kind](ring)}</g>` +
    (opts.level !== undefined ? levelCorner(opts.level) : "") +
    `</svg>`
  );
}
