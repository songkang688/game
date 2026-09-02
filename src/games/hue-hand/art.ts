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

/* ------------------------------------------------------------------ */
/* 三个电脑对手的画制头像(visual-r1 修 A 档 P-06,替掉 🐰🐼🦊 DOM emoji)   */
/* ------------------------------------------------------------------ */

export type BotFace = "tuantuan" | "yuanyuan" | "diandian";

/** 眼睛一对(带左上高光点)+ 两团腮红,三张脸共用的五官小件 */
function faceBitsSVG(eyeY: number, ink: string): string {
  return (
    `<circle cx="19" cy="${eyeY}" r="1.9" fill="${ink}"/>` +
    `<circle cx="29" cy="${eyeY}" r="1.9" fill="${ink}"/>` +
    `<circle cx="18.4" cy="${eyeY - 0.7}" r=".7" fill="#fff"/>` +
    `<circle cx="28.4" cy="${eyeY - 0.7}" r=".7" fill="#fff"/>` +
    `<ellipse cx="14.8" cy="${eyeY + 4.6}" rx="2.4" ry="1.5" fill="#F7AECB" opacity=".8"/>` +
    `<ellipse cx="33.2" cy="${eyeY + 4.6}" rx="2.4" ry="1.5" fill="#F7AECB" opacity=".8"/>`
  );
}

/** 左上 45° 高光(宪法光照约定),三张脸同一处 */
const FACE_GLOSS = `<ellipse cx="19" cy="22" rx="5" ry="3.6" fill="rgba(255,255,255,.4)"/>`;

const botFaceCache = new Map<BotFace, string>();

/**
 * Q 版对手头像:团团=长耳小兔、圆圆=圆耳熊猫、点点=尖耳小狐,
 * 三张脸靠耳形剪影一眼可分;每张都有底色 + 描边暗部 + 左上高光的三阶。
 * 产出可直接塞进 `.hh-face` span 的内联 SVG(width/height 100% 撑满圆片)。
 */
export function botFaceSVG(which: BotFace): string {
  const hit = botFaceCache.get(which);
  if (hit) return hit;
  const open =
    `<svg class="hh-botface hh-botface-${which}" viewBox="0 0 48 48" width="100%" height="100%"` +
    ` aria-hidden="true">`;
  let body = "";
  if (which === "tuantuan") {
    // 小兔:两只长耳(剪影),奶白脸,粉内耳
    body =
      `<ellipse cx="16.5" cy="11" rx="4.4" ry="9" fill="#FFF7F2" stroke="#D9A9B8" stroke-width="1.5" transform="rotate(-14 16.5 11)"/>` +
      `<ellipse cx="31.5" cy="11" rx="4.4" ry="9" fill="#FFF7F2" stroke="#D9A9B8" stroke-width="1.5" transform="rotate(14 31.5 11)"/>` +
      `<ellipse cx="16.8" cy="11.6" rx="2" ry="5.6" fill="#FBD3DF" transform="rotate(-14 16.8 11.6)"/>` +
      `<ellipse cx="31.2" cy="11.6" rx="2" ry="5.6" fill="#FBD3DF" transform="rotate(14 31.2 11.6)"/>` +
      `<circle cx="24" cy="28" r="13.5" fill="#FFF7F2" stroke="#D9A9B8" stroke-width="1.6"/>` +
      FACE_GLOSS +
      faceBitsSVG(27, "#5A4450") +
      `<path d="M22.6 31 L25.4 31 L24 32.8 Z" fill="#E8899F"/>` +
      `<path d="M24 32.8 q-1.6 2 -3.4 .8 M24 32.8 q1.6 2 3.4 .8" fill="none" stroke="#C98CA0" stroke-width="1.1" stroke-linecap="round"/>`;
  } else if (which === "yuanyuan") {
    // 熊猫:圆耳 + 眼斑(剪影),白脸墨耳
    body =
      `<circle cx="13" cy="13.5" r="5.4" fill="#3D3D4D" stroke="#2C2C3A" stroke-width="1.3"/>` +
      `<circle cx="35" cy="13.5" r="5.4" fill="#3D3D4D" stroke="#2C2C3A" stroke-width="1.3"/>` +
      `<circle cx="11.9" cy="12.4" r="1.7" fill="rgba(255,255,255,.28)"/>` +
      `<circle cx="33.9" cy="12.4" r="1.7" fill="rgba(255,255,255,.28)"/>` +
      `<circle cx="24" cy="27.5" r="14" fill="#FFFFFF" stroke="#C2C2D4" stroke-width="1.6"/>` +
      FACE_GLOSS +
      `<ellipse cx="18.6" cy="25.8" rx="3.9" ry="4.9" fill="#3D3D4D" transform="rotate(-16 18.6 25.8)"/>` +
      `<ellipse cx="29.4" cy="25.8" rx="3.9" ry="4.9" fill="#3D3D4D" transform="rotate(16 29.4 25.8)"/>` +
      `<circle cx="19" cy="25.5" r="1.5" fill="#fff"/>` +
      `<circle cx="29" cy="25.5" r="1.5" fill="#fff"/>` +
      `<circle cx="19.3" cy="25.8" r=".8" fill="#2C2C3A"/>` +
      `<circle cx="29.3" cy="25.8" r=".8" fill="#2C2C3A"/>` +
      `<ellipse cx="14.6" cy="31.4" rx="2.4" ry="1.5" fill="#F7AECB" opacity=".8"/>` +
      `<ellipse cx="33.4" cy="31.4" rx="2.4" ry="1.5" fill="#F7AECB" opacity=".8"/>` +
      `<path d="M22.7 31.6 L25.3 31.6 L24 33.2 Z" fill="#3D3D4D"/>` +
      `<path d="M24 33.2 q0 1.6 0 1.6 M24 34.8 q-1.7 1.4 -3.2 .2 M24 34.8 q1.7 1.4 3.2 .2" fill="none" stroke="#3D3D4D" stroke-width="1.1" stroke-linecap="round"/>`;
  } else {
    // 小狐:尖耳(剪影),杏橙脸,白吻端
    body =
      `<path d="M11.2 20.5 L13.2 5.8 L23 13.6 Z" fill="#F5A25E" stroke="#C97B3A" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M36.8 20.5 L34.8 5.8 L25 13.6 Z" fill="#F5A25E" stroke="#C97B3A" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M13.6 17.6 L14.7 9.5 L20 13.8 Z" fill="#FFE3C9"/>` +
      `<path d="M34.4 17.6 L33.3 9.5 L28 13.8 Z" fill="#FFE3C9"/>` +
      `<circle cx="24" cy="28" r="13.5" fill="#F7B073" stroke="#C97B3A" stroke-width="1.6"/>` +
      `<ellipse cx="24" cy="33" rx="7.2" ry="5.4" fill="#FFF6EC"/>` +
      FACE_GLOSS +
      faceBitsSVG(26.5, "#55371F") +
      `<path d="M22.7 31.4 L25.3 31.4 L24 33.1 Z" fill="#7A4A26"/>` +
      `<path d="M24 33.1 q-1.5 1.9 -3.2 .7 M24 33.1 q1.5 1.9 3.2 .7" fill="none" stroke="#B07A48" stroke-width="1.1" stroke-linecap="round"/>`;
  }
  const svg = `${open}${body}</svg>`;
  botFaceCache.set(which, svg);
  return svg;
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
