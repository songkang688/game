/**
 * 共享美术套件 · 发光五角星（1.3 视觉升级 · 窗口8 第 26 步 B 档新增）。
 *
 * 约定：一个文件只归一个人，这一份归 music-stars（B 档）。
 * 全部是纯函数 + 常量，node 环境可测，不碰 DOM、不带运行时依赖。
 *
 * 「音符点 → 发光星星」的工序单（对应绘制规格 4.2）：
 *  ① 星形：十点多边形（5 外点 + 5 内点交替，内 r = 0.42 × 外 r），
 *     第一枚外点朝正上；圆角尖走 `stroke-linejoin:round`；
 *  ② 光晕：星底垫径向渐变圆（直径 = 星宽 × 2.2，中心色 = 音色 45% 透明度 →
 *     边缘 0），星心再叠一枚 `rgba(255,255,255,.9)` 的小圆当高光；
 *  ③ 同一套顶点几何还输出成 CSS `polygon(…)`，给 DOM 圆点做 clip-path 星形用
 *     ——盒子尺寸零改动，只换剪影。
 */
import { shade, withAlpha } from "./palette";

/** 内外半径比：内点半径 = 0.42 × 外点半径 */
export const STAR_INNER_RATIO = 0.42;
/** 十点多边形：5 个外点 + 5 个内点 */
export const STAR_POINT_COUNT = 10;
/** 光晕直径 = 星宽 × 2.2 */
export const HALO_RATIO = 2.2;
/** 光晕中心色的透明度（音色 45%） */
export const HALO_CENTER_ALPHA = 0.45;
/** 星心高光小圆的填充色 */
export const STAR_CORE_FILL = "rgba(255,255,255,.9)";

function safeSize(size: number): number {
  return Number.isFinite(size) && size > 0 ? size : 24;
}

function safeRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : STAR_INNER_RATIO;
}

/**
 * 五角星的十个顶点（外点、内点交替），第一枚外点在正上方。
 * 星形撑满 size × size 的方框，中心在 (size/2, size/2)。
 */
export function starVertices(size: number, innerRatio = STAR_INNER_RATIO): Array<[number, number]> {
  const s = safeSize(size);
  const ratio = safeRatio(innerRatio);
  const cx = s / 2;
  const cy = s / 2;
  const outer = s / 2;
  const inner = outer * ratio;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < STAR_POINT_COUNT; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return pts;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** SVG `<polygon points="…">` 的顶点串 */
export function starPointsAttr(size: number, innerRatio = STAR_INNER_RATIO): string {
  return starVertices(size, innerRatio)
    .map(([x, y]) => `${round2(x)},${round2(y)}`)
    .join(" ");
}

/**
 * 同一套几何输出成 CSS `polygon(x% y%, …)`：给 DOM 圆点当 clip-path，
 * 盒子尺寸一个像素不动，只把剪影换成星星。
 */
export function starClipPolygon(innerRatio = STAR_INNER_RATIO): string {
  const pts = starVertices(100, innerRatio)
    .map(([x, y]) => `${round2(x)}% ${round2(y)}%`)
    .join(",");
  return `polygon(${pts})`;
}

/** 径向光晕：中心 = 颜色 45% 透明度，往外到 70% 处渐隐为 0 */
export function haloBackground(color: string, alpha = HALO_CENTER_ALPHA): string {
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : HALO_CENTER_ALPHA;
  return `radial-gradient(circle,${withAlpha(color, a)} 0%,${withAlpha(color, 0)} 70%)`;
}

export interface StarSvgOptions {
  /** 写进 width / height 的 CSS 尺寸（如 "1em"，随字号缩放）；不传用像素 */
  cssSize?: string;
  /** SVG 根节点的 class */
  className?: string;
}

/**
 * 发光五角星的 SVG 标记：星形（圆角尖 + 同色系深描边）+ 星心高光小圆。
 * 光晕不进这段 SVG（径向渐变要 defs + 全文档唯一 id，多颗星会撞）——
 * 由调用方用 `haloBackground()` 垫一层 CSS 渐变圆。
 */
export function starSvg(size: number, color: string, opts: StarSvgOptions = {}): string {
  const s = safeSize(size);
  const dim = opts.cssSize ?? `${s}px`;
  const cls = opts.className ?? "ak-star";
  const stroke = shade(color, -30);
  const strokeW = Math.max(1, round2(s * 0.06));
  const core = round2(s * 0.1);
  return (
    `<svg class="${cls}" viewBox="0 0 ${s} ${s}" width="${dim}" height="${dim}" aria-hidden="true">` +
    `<polygon points="${starPointsAttr(s)}" fill="${color}" stroke="${stroke}" ` +
    `stroke-width="${strokeW}" stroke-linejoin="round"/>` +
    `<circle cx="${round2(s / 2)}" cy="${round2(s / 2)}" r="${core}" fill="${STAR_CORE_FILL}"/>` +
    `</svg>`
  );
}
