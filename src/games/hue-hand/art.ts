/**
 * 花色接龙 · 视觉资产(1.3 视觉升级)。
 *
 * 全部是纯函数,只产出 SVG 字符串,不碰 DOM、不碰任何玩法状态:
 *  - actionIconSVG():五种功能牌图标(跳过/反转/加二/万能/加四),全部原创绘制;
 *  - cardBackSVG():统一的「花背卡」(深紫渐变底 + 中心四色小花 + 细白双框),
 *    牌堆、对手手牌条、飞行替身、结算小图全用同一张,跨平台不再依赖字体字符;
 *  - colorShapeSVG():四色各配一个小符号(粉=圆、黄=方、绿=三角、蓝=星),
 *    色弱的孩子从卡面角标到颜色条都能靠形状认色;
 *  - lighten():卡底「左上提亮」的对角渐变要用的调色小工具。
 *
 * 共享 art kit(src/art/kit/)还没建,按视觉宪法先落在本目录;建成后把这里换成 import。
 */

import { COLORS, COLOR_HEX, type CardKind, type Color } from "./deck";

/** 花背与万能牌图标共用的深紫墨色 */
const INK_PURPLE = "#6b4f9e";

/** 把 #rrggbb 往白色方向提亮 amount(0–1),越界自动夹回 */
export function lighten(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const one = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(v + (255 - v) * Math.max(0, Math.min(1, amount)))));
  const r = one((n >> 16) & 255);
  const g = one((n >> 8) & 255);
  const b = one(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** 四色的图形第二通道:从卡面角标到颜色条一致,色弱也分得清 */
export const COLOR_SHAPES: Record<Color, "circle" | "square" | "triangle" | "star"> = {
  pink: "circle",
  lemon: "square",
  mint: "triangle",
  sky: "star",
};

/** 一个颜色对应的小符号。fill 不传就用该色主色 */
export function colorShapeSVG(color: Color, size: number, fill?: string): string {
  const f = fill ?? COLOR_HEX[color];
  const shape = COLOR_SHAPES[color];
  const body: Record<typeof shape, string> = {
    circle: `<circle cx="12" cy="12" r="9" fill="${f}"/>`,
    square: `<rect x="4" y="4" width="16" height="16" rx="3" fill="${f}"/>`,
    triangle: `<polygon points="12,3.5 21.5,20 2.5,20" fill="${f}"/>`,
    star: `<polygon points="12,2 14.9,8.6 22,9.2 16.7,14 18.3,21 12,17.3 5.7,21 7.3,14 2,9.2 9.1,8.6" fill="${f}"/>`,
  };
  return (
    `<svg class="hh-shape hh-shape-${shape}" viewBox="0 0 24 24" width="${size}" height="${size}"` +
    ` aria-hidden="true">${body[shape]}</svg>`
  );
}

/**
 * 「花色接龙」的那朵四色小花:四片花瓣一色一片,绕花心各转 90°。
 * 花背、万能牌、加四牌共用这一朵,cx/cy 是花心,r 是整朵花的半径。
 */
function petalsSVG(cx: number, cy: number, r: number): string {
  const petal = (color: Color, deg: number): string =>
    `<ellipse class="hh-petal" cx="${cx}" cy="${cy - r * 0.52}" rx="${r * 0.34}" ry="${r * 0.5}"` +
    ` fill="${COLOR_HEX[color]}" transform="rotate(${deg} ${cx} ${cy})"/>`;
  return (
    COLORS.map((c, i) => petal(c, i * 90)).join("") +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#fff"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.1}" fill="${INK_PURPLE}"/>`
  );
}

/**
 * 功能牌图标:跳过=圆圈斜线、反转=双弯箭头、加二=两张小叠卡、
 * 万能=四色花瓣扇、加四=四色扇 + 「+4」。数字牌(num)不用图标,回空串。
 */
export function actionIconSVG(kind: CardKind, ink: string, size: number): string {
  if (kind === "num") return "";
  const open =
    `<svg class="hh-icon hh-icon-${kind}" viewBox="0 0 48 48" width="${size}" height="${size}"` +
    ` aria-hidden="true">`;
  if (kind === "skip") {
    return (
      `${open}<circle cx="24" cy="24" r="16" fill="none" stroke="${ink}" stroke-width="5.5"/>` +
      `<line x1="13.5" y1="13.5" x2="34.5" y2="34.5" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/></svg>`
    );
  }
  if (kind === "reverse") {
    return (
      `${open}<path d="M13 19 A13 13 0 0 1 35 19" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>` +
      `<polygon points="29,17 41,17 35,28" fill="${ink}"/>` +
      `<path d="M35 29 A13 13 0 0 1 13 29" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>` +
      `<polygon points="7,31 19,31 13,20" fill="${ink}"/></svg>`
    );
  }
  if (kind === "draw2") {
    return (
      `${open}<rect x="17" y="7" width="19" height="27" rx="4" fill="${ink}" opacity=".45" transform="rotate(9 26 20)"/>` +
      `<rect x="11" y="13" width="19" height="27" rx="4" fill="${ink}" stroke="#fff" stroke-width="2" transform="rotate(-7 20 26)"/>` +
      `<text x="20.5" y="31" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" transform="rotate(-7 20 26)">+2</text></svg>`
    );
  }
  if (kind === "wild") {
    return `${open}${petalsSVG(24, 24, 19)}</svg>`;
  }
  // wild4:小一号的四色花 + 下方「+4」
  return (
    `${open}${petalsSVG(24, 17, 13)}` +
    `<text x="24" y="43" text-anchor="middle" font-size="16" font-weight="900" fill="${INK_PURPLE}">+4</text></svg>`
  );
}

/** 花背是一张固定图,拼一次就够 */
let backCache = "";

/** 统一花背卡:深紫渐变底 + 细白双框 + 中心四色小花 + 四角小星点 */
export function cardBackSVG(): string {
  if (backCache) return backCache;
  backCache =
    `<svg class="hh-backsvg" viewBox="0 0 60 88" width="100%" height="100%" aria-hidden="true">` +
    `<defs><linearGradient id="hhbg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#8a74dd"/><stop offset="1" stop-color="#5b4399"/></linearGradient></defs>` +
    `<rect x="0.5" y="0.5" width="59" height="87" rx="9" fill="url(#hhbg)" stroke="#4a3684" stroke-width="1"/>` +
    `<rect x="4" y="4" width="52" height="80" rx="7" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85"/>` +
    `<rect x="8" y="8" width="44" height="72" rx="5" fill="none" stroke="#fff" stroke-width="1" opacity=".45"/>` +
    petalsSVG(30, 44, 15) +
    `<circle cx="14" cy="16" r="1.6" fill="#fff" opacity=".7"/>` +
    `<circle cx="46" cy="16" r="1.6" fill="#fff" opacity=".7"/>` +
    `<circle cx="14" cy="72" r="1.6" fill="#fff" opacity=".7"/>` +
    `<circle cx="46" cy="72" r="1.6" fill="#fff" opacity=".7"/>` +
    `</svg>`;
  return backCache;
}
