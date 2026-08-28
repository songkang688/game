/**
 * 连连看 · 1.3 纯视觉模块(只管皮,不碰任何判定 / 关卡 / 计时逻辑)。
 *
 * 三件事:
 *  1. **牌面图标**:emoji 字符换成 kit 的原创 SVG 图标(双色渐变 + 1.5px 描边 +
 *     左上高光),同一主题里 v 相同必同款、v 不同必不同款,任何机器渲染一致;
 *  2. **流星光带**:配对成功沿连通路径画 SVG 折线 + 3 颗星尘滑过。路径坐标由
 *     `meteorPoints` 把判定算出的拐点**一比一**映射成格子中心,一个点都不自己加;
 *  3. **顶栏小徽记**:currentColor 描边的小图形,跟着卡片文字颜色走。
 */
import { ICONS, MASK_ICON, iconSvg, starburstPath, type KitIcon } from "../../art/kit/icons";
import type { Pt } from "./board";

// ---------------------------------------------------------------------------
// 一、尺寸与时序(与 index.ts 样式表里的 --llk-* token 一一对应)
// ---------------------------------------------------------------------------

/** 图标绘制区占牌面的比例(样式表里写的 68%) */
export const TILE_ICON_FRAC = 0.68;
/** 牌面低于这个像素就省略侧沿,只留顶面 + 描边(360px 兜底档) */
export const SLIM_TILE_PX = 34;
/** 流星光带时长(--llk-ms-trail) */
export const METEOR_MS = 240;
/** 星尘颗数与交错间隔 */
export const DUST_COUNT = 3;
export const DUST_STAGGER_MS = 40;
/** 洗牌腾空转位时长(--llk-ms-shuffle) */
export const SHUFFLE_FX_MS = 180;
/** 提示柔光停留时长(--llk-ms-hint) */
export const HINT_GLOW_MS = 2000;

/** 这块牌要不要走「省侧沿」的轻量画法 */
export function slimTile(px: number): boolean {
  return px < SLIM_TILE_PX;
}

// ---------------------------------------------------------------------------
// 二、牌面图标映射
// ---------------------------------------------------------------------------

/**
 * 主题键(主题的第一个 emoji)→ 图标环上的起点。
 * 不同主题各转一个角度,同一主题内 v→图标 是平移映射:
 * ICONS.length(16)> 单主题图案数上限(14),所以 v 不同图标必不同。
 */
export function themeOffset(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % ICONS.length;
}

/** 第 v 号图案在这套主题里用哪枚图标 */
export function tileIcon(themeKey: string, v: number): KitIcon {
  const n = ICONS.length;
  const base = ((v % n) + n) % n;
  return ICONS[(base + themeOffset(themeKey)) % n];
}

/** 图标中文名(给 aria-label:图案靠名字念得出来) */
export function tileIconName(themeKey: string, v: number): string {
  return tileIcon(themeKey, v).name;
}

const faceCache = new Map<string, string>();

/** 牌面 SVG 字符串(同款同串,缓存住免得每次 render 都重拼) */
export function tileFaceSvg(themeKey: string, v: number): string {
  const key = `${themeKey}#${v}`;
  let svg = faceCache.get(key);
  if (!svg) {
    svg = iconSvg(tileIcon(themeKey, v), { cls: "llk-face" });
    faceCache.set(key, svg);
  }
  return svg;
}

/** 面具牌的盖脸 SVG */
export function maskFaceSvg(): string {
  return iconSvg(MASK_ICON, { cls: "llk-face" });
}

// ---------------------------------------------------------------------------
// 三、流星光带
// ---------------------------------------------------------------------------

export type Px = readonly [number, number];

/**
 * 流星折线的像素点:把判定给的拐点**一比一**映射成格子中心。
 * 这里不 import 也不重算任何连通逻辑——一个点都不许自己加、不许自己减。
 */
export function meteorPoints(path: readonly Pt[], centerOf: (r: number, c: number) => Px): Px[] {
  return path.map(([r, c]) => centerOf(r, c));
}

export interface MeteorOpts {
  /** 安静模式:只画静态折线,不放星尘不做滑动 */
  calm?: boolean;
  /** 渐变 id 去重用;缺省自增 */
  uid?: number;
}

let meteorSeq = 0;

/**
 * 流星覆盖层的 <svg> 字符串:
 * 圆角拐点折线 × 2(宽的做辉光、细的做主线),渐变描边头亮尾淡,
 * 3 颗四角星尘沿同一条路径 240ms 滑过(交错 40ms)。
 * 层本身不接指针事件(样式表里 .llk-fx / .llk-line 都是 pointer-events: none)。
 */
export function meteorSvg(pts: readonly Px[], w: number, h: number, opts: MeteorOpts = {}): string {
  if (pts.length < 2 || w <= 0 || h <= 0) return "";
  const pointsAttr = pts.map(([x, y]) => `${x},${y}`).join(" ");
  if (opts.calm) {
    return (
      `<svg class="llk-line llk-line-calm" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
      `<polyline points="${pointsAttr}" fill="none" stroke="#FFD678" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>` +
      `</svg>`
    );
  }
  const uid = opts.uid ?? ++meteorSeq;
  const gid = `llkTrail${uid}`;
  const tail = pts[0];
  const head = pts[pts.length - 1];
  const motion = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const durS = METEOR_MS / 1000;
  let dust = "";
  for (let i = 0; i < DUST_COUNT; i++) {
    const begin = (i * DUST_STAGGER_MS) / 1000;
    dust +=
      `<path class="llk-dust" d="${starburstPath(5 - i)}" fill="#FFF6D8" opacity="${(0.95 - i * 0.2).toFixed(2)}">` +
      `<animateMotion dur="${durS}s" begin="${begin}s" fill="freeze" path="${motion}"/>` +
      `</path>`;
  }
  return (
    `<svg class="llk-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${tail[0]}" y1="${tail[1]}" x2="${head[0]}" y2="${head[1]}">` +
    `<stop offset="0" stop-color="rgba(255,214,120,0)"/>` +
    `<stop offset="0.55" stop-color="rgba(255,214,120,.65)"/>` +
    `<stop offset="1" stop-color="#FFD678"/>` +
    `</linearGradient></defs>` +
    `<polyline points="${pointsAttr}" fill="none" stroke="url(#${gid})" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" opacity=".45"/>` +
    `<polyline points="${pointsAttr}" fill="none" stroke="url(#${gid})" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    dust +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 四、顶栏小徽记
// ---------------------------------------------------------------------------

export type HudGlyph = "pairs" | "clock" | "shuffle" | "bulb" | "compass" | "round" | "chain" | "medal";

const HUD_GLYPHS: Readonly<Record<HudGlyph, string>> = {
  pairs: `<rect x="3" y="3" width="10" height="10" rx="3"/><rect x="7" y="7" width="10" height="10" rx="3"/>`,
  clock: `<circle cx="10" cy="10" r="7.5"/><path d="M10 5.5 L10 10 L13.5 12"/>`,
  shuffle:
    `<path d="M3 6 H8 C12 6 12 14 16 14 M3 14 H8 C9.4 14 10.3 13.1 11.2 12 M16 6 C14.6 6 13.7 6.9 12.8 8"/>` +
    `<path d="M14.5 4 L17 6 L14.5 8 M14.5 12 L17 14 L14.5 16"/>`,
  bulb: `<path d="M10 3 A5.5 5.5 0 0 1 13 13 L7 13 A5.5 5.5 0 0 1 10 3 Z"/><path d="M8 16 H12"/>`,
  compass: `<circle cx="10" cy="10" r="7.5"/><path d="M13 7 L11 11 L7 13 L9 9 Z"/>`,
  round: `<path d="M5 17 V4 H15 L12.5 7.5 L15 11 H5"/>`,
  chain: `<circle cx="7" cy="10" r="4"/><circle cx="13" cy="10" r="4"/>`,
  medal: `<circle cx="10" cy="8" r="5"/><path d="M7 12.5 L5.5 17 M13 12.5 L14.5 17"/>`
};

/** 顶栏卡片的小徽记:currentColor 描边,跟着卡片文字颜色走 */
export function hudGlyphSvg(kind: HudGlyph): string {
  return (
    `<svg viewBox="0 0 20 20" class="llk-glyph" aria-hidden="true" focusable="false">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${HUD_GLYPHS[kind]}</g>` +
    `</svg>`
  );
}
