/**
 * 翻翻暗棋 · 绘制资产（1.3 视觉升级）。
 *
 * 全部是「输入参数 → 返回 SVG 字符串」的纯函数，不碰 DOM、不碰状态，
 * 视图层拿去塞进 innerHTML 就能用，单测也能直接对字符串做契约断言。
 *
 * 两条信息红线在这一层就锁死：
 *  - `backSVG` 压根不接受颜色参数——红蓝双方翻开前的牌背在构造上就完全一致，不可能泄露；
 *  - 牌背之间只允许差两道木纹的相位（按格位哈希），其余结构 32 格一模一样。
 */
import { RANK, labelOf, rand01, type Color, type Kind } from "./board";

/**
 * 阵营配色：主环 / 深色字 / 描边（红方金描、蓝方银描）。
 * 点数行同时用阵营色，但「点的个数」本身就是颜色之外的第二通道。
 */
export const FACTION = {
  red: { ring: "#c03a2b", deep: "#a32215", hook: "#e7b54a" },
  blue: { ring: "#2f66b8", deep: "#1d4f96", hook: "#c6d3e8" },
} as const;

/**
 * 牌背：深棕木底（三停层叠实心，免 defs/id——32 份内联不撞车）+ 双线描边 +
 * 中央「暗」字印章 + 底部厚度阴影。
 *
 * `seedIdx` 只决定两道极淡木纹（class="dcg"）的走向相位——32 张牌背不会死板到一模一样，
 * 但除了这两条纹以外的每一个字节都相同，也绝不掺进任何棋子信息。
 */
export function backSVG(seedIdx: number): string {
  const p1 = Math.round(rand01(seedIdx, 1) * 10 - 5);
  const p2 = Math.round(rand01(seedIdx, 2) * 10 - 5);
  const g1 = `M8 ${20 + p1} Q32 ${26 + p2} 56 ${18 - p1}`;
  const g2 = `M8 ${44 - p2} Q32 ${38 + p1} 56 ${46 + p2}`;
  return (
    `<svg viewBox="0 0 64 64" aria-hidden="true">` +
    `<rect x="4" y="6" width="56" height="55" rx="11" fill="#3e2712"/>` +
    `<rect x="4" y="4" width="56" height="55" rx="11" fill="#5f3a1c"/>` +
    `<rect x="4" y="4" width="56" height="44" rx="11" fill="#744a26"/>` +
    `<rect x="4" y="4" width="56" height="27" rx="11" fill="#8a5a30"/>` +
    `<path class="dcg" d="${g1}" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/>` +
    `<path class="dcg" d="${g2}" fill="none" stroke="#2c1a0b" stroke-opacity=".18" stroke-width="2"/>` +
    `<rect x="7.5" y="7.5" width="49" height="48" rx="8" fill="none" stroke="#e6c48d" stroke-width="1.6"/>` +
    `<rect x="10.5" y="10.5" width="43" height="42" rx="6" fill="none" stroke="#caa268" stroke-width="1"/>` +
    `<circle cx="32" cy="31.5" r="13.5" fill="#6b4423" stroke="#e6c48d" stroke-width="1.6"/>` +
    `<circle cx="32" cy="31.5" r="10.8" fill="none" stroke="#caa268" stroke-width="1"/>` +
    `<text x="32" y="32.2" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="900" fill="#f2d9a6">暗</text>` +
    `</svg>`
  );
}

/**
 * 翻开的棋面：中国象棋圆子制式。
 *
 *  - 象牙底 + 阵营环 + 底部厚度阴影（椭圆错位半格，看得出这是一枚有厚度的子）；
 *  - 汉字主体保留（认字教学），双钩描边：红方深红字金描、蓝方深蓝字银描；
 *  - 汉字下方一排战力点（class="dcp"，帅 7 点 → 兵 1 点，直读 `RANK`）——
 *    记不住相克表的孩子按点数比大小就行；
 *  - 炮多一道虚线小弧（class="dcarc"），提示它是「隔一个才吃得着」的那一枚。
 *
 * `uid` 拼进渐变 id：同一兵种会在棋盘上开出好几枚，视图把格号传进来，
 * 同文档内联多份也不会出现重复 id（无参调用只用于单测与单份渲染）。
 */
export function pieceFaceSVG(color: Color, kind: Kind, uid: string | number = "x"): string {
  const f = FACTION[color];
  const gid = `dcIvory-${color}-${kind}-${uid}`;
  const n = RANK[kind];
  let dots = "";
  for (let i = 0; i < n; i++) {
    const x = 32 + (i - (n - 1) / 2) * 5.4;
    dots += `<circle class="dcp" cx="${x.toFixed(1)}" cy="46.5" r="1.9" fill="${f.ring}"/>`;
  }
  const arc =
    kind === "cannon"
      ? `<path class="dcarc" d="M20 14.5 Q32 6.5 44 14.5" fill="none" stroke="${f.ring}" stroke-width="1.6" stroke-dasharray="3 2.4" stroke-linecap="round"/>`
      : "";
  return (
    `<svg viewBox="0 0 64 64" aria-hidden="true">` +
    `<defs><radialGradient id="${gid}" cx=".38" cy=".3" r=".9">` +
    `<stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#efe0bd"/></radialGradient></defs>` +
    `<ellipse cx="32" cy="34.5" rx="26.5" ry="26" fill="#b09468"/>` +
    `<circle cx="32" cy="31.5" r="26.5" fill="url(#${gid})"/>` +
    `<circle cx="32" cy="31.5" r="24.2" fill="none" stroke="${f.ring}" stroke-width="3.4"/>` +
    `<circle cx="32" cy="31.5" r="20.9" fill="none" stroke="${f.ring}" stroke-opacity=".35" stroke-width="1"/>` +
    arc +
    `<text x="32" y="30" text-anchor="middle" dominant-baseline="central" font-size="21" font-weight="900" ` +
    `fill="${f.deep}" stroke="${f.hook}" stroke-width="1" paint-order="stroke">${labelOf(color, kind)}</text>` +
    `<g class="dcd">${dots}</g>` +
    `</svg>`
  );
}

/**
 * 记牌面板的迷你棋子：一圈阵营环 + 汉字。
 * `dim=true` 表示这一兵种已经全部露过面：整枚转灰、再划一道线（class="dcx"）。
 */
export function miniPieceSVG(color: Color, kind: Kind, dim: boolean): string {
  const f = FACTION[color];
  const ring = dim ? "#b3a894" : f.ring;
  const ink = dim ? "#a89a82" : f.deep;
  const body = dim ? "#f0ece1" : "#fffbe9";
  return (
    `<svg viewBox="0 0 20 20" aria-hidden="true">` +
    `<circle cx="10" cy="10.6" r="8.6" fill="#c2ab84"/>` +
    `<circle cx="10" cy="9.6" r="8.6" fill="${body}"/>` +
    `<circle cx="10" cy="9.6" r="7.3" fill="none" stroke="${ring}" stroke-width="1.7"/>` +
    `<text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="900" fill="${ink}">${labelOf(color, kind)}</text>` +
    (dim
      ? `<line class="dcx" x1="3.5" y1="16.5" x2="16.5" y2="3.5" stroke="#9a8c74" stroke-width="1.8" stroke-linecap="round"/>`
      : "") +
    `</svg>`
  );
}

/**
 * 一片花瓣：吃子退场用粉色、胜利花瓣雨用金色。
 * 三阶光影齐全：底色 + 深色描边脉络 + 高光，符合视觉宪法对收集物的底线。
 */
export function petalSVG(tone: "pink" | "gold"): string {
  const c =
    tone === "gold"
      ? { base: "#ffd977", edge: "#e2ae3c", shine: "#fff3cd" }
      : { base: "#ffb7c9", edge: "#e88ba4", shine: "#ffe3ea" };
  return (
    `<svg viewBox="0 0 16 16" aria-hidden="true">` +
    `<path d="M8 1.2 C12.6 4 13.4 9.4 8 14.8 C2.6 9.4 3.4 4 8 1.2 Z" fill="${c.base}" stroke="${c.edge}" stroke-width="1"/>` +
    `<path d="M8 3.4 C10.6 5.4 11 8.8 8 12.4" fill="none" stroke="${c.edge}" stroke-width=".9" stroke-opacity=".6"/>` +
    `<ellipse cx="6.4" cy="5" rx="1.5" ry="2.2" fill="${c.shine}" transform="rotate(-24 6.4 5)"/>` +
    `</svg>`
  );
}

/** 顶栏倒数 chip 用的小沙漏（做成 data URI 塞进 CSS 的 ::before，替掉字符占位） */
export function hourglassSVG(ink: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">` +
    `<path d="M3.2 1.6 H12.8 M3.2 14.4 H12.8" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` +
    `<path d="M4.4 2.4 C4.4 6 7 6.6 7 8 C7 9.4 4.4 10 4.4 13.6 H11.6 C11.6 10 9 9.4 9 8 C9 6.6 11.6 6 11.6 2.4 Z" fill="none" stroke="${ink}" stroke-width="1.2"/>` +
    `<path d="M6 11.8 C6.6 10.8 9.4 10.8 10 11.8 L10.4 13 H5.6 Z" fill="${ink}"/>` +
    `</svg>`
  );
}

/** 内联 SVG → CSS 可用的 data URI */
export function svgUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
