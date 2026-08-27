/**
 * 军旗对决 · 视觉素材（全部是返回 SVG 字符串的纯函数，一行 DOM 都不碰）。
 *
 * 共享 art kit（src/art/kit/）还没建，所以按 1.3 视觉宪法在本款内自绘：
 *  - rankBadgeSVG(kind)：棋子汉字上方的军衔条——司令 3 星、军长 2 星、师长 1 星、
 *    旅/团/营长 3/2/1 杠、连长 2 点、排长 1 点、工兵扳手、地雷圆雷、炸弹引线弹、军旗小旗。
 *    不认字的孩子数星星数杠也能比大小。
 *  - backSVG()：盖着的子的牌背——深色底 + 五角星压纹 + 双线边框。
 *    只有这一个无参函数，红蓝双方共用同一张，暗棋信息一丝不漏。
 *  - tentSVG() / hqSVG(side)：行营帐篷与大本营碉堡（双方旗色不同，属地形不泄密）。
 *  - mountainSVG()：前沿走不通那两列的小山。
 *  - smokeSVG()：炸弹同尽的卡通烟云（圆滚滚的云朵 + 小星星，无写实表现）。
 *  - hoistSVG(side)：扛旗成功的升旗杆（旗面交给 CSS 从杆底升到顶）。
 *  - crestSVG(side)：HUD 上双方的小军旗徽标。
 */
import type { Side } from "./board";
import { KINDS, type Kind } from "./rules";

/** 双方主色（沿用棋盘既有配色：朵朵暖橙、星星海蓝） */
export const SIDE_COLOR: Record<Side, string> = { duo: "#E0813C", star: "#4B76B4" };
export const SIDE_DARK: Record<Side, string> = { duo: "#A9531F", star: "#25508F" };

const GOLD = "#F6C445";
const GOLD_DARK = "#A87A1C";
const STEEL = "#55677A";

/** 五角星顶点串（cx,cy 圆心，r 外接半径） */
function starPts(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + Math.cos(rad) * rr).toFixed(2)},${(cy + Math.sin(rad) * rr).toFixed(2)}`);
  }
  return pts.join(" ");
}

function goldStar(cx: number, cy: number, r: number): string {
  return `<polygon points="${starPts(cx, cy, r)}" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.8" stroke-linejoin="round"/>`;
}

/** 五瓣小花的花瓣圈（朵朵的形状徽记零件） */
function petalRing(cx: number, cy: number, r: number, pr: number, fill: string, line: string): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const rad = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    out += `<circle cx="${(cx + Math.cos(rad) * r).toFixed(2)}" cy="${(cy + Math.sin(rad) * r).toFixed(2)}" r="${pr}" fill="${fill}" stroke="${line}" stroke-width="0.7"/>`;
  }
  return out;
}

function goldBar(y: number): string {
  return `<rect x="7" y="${y}" width="16" height="2.2" rx="1.1" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.5"/>`;
}

function goldDot(cx: number): string {
  return `<circle cx="${cx}" cy="5" r="2.1" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.6"/>`;
}

function strip(inner: string): string {
  return `<svg viewBox="0 0 30 10" width="27" height="9" aria-hidden="true">${inner}</svg>`;
}

/** 每个兵种一条军衔条：12 种互不相同 */
export function rankBadgeSVG(kind: Kind): string {
  switch (kind) {
    case "siling":
      return strip(goldStar(7, 5, 4.2) + goldStar(15, 5, 4.2) + goldStar(23, 5, 4.2));
    case "junzhang":
      return strip(goldStar(10.5, 5, 4.2) + goldStar(19.5, 5, 4.2));
    case "shizhang":
      return strip(goldStar(15, 5, 4.2));
    case "lvzhang":
      return strip(goldBar(1) + goldBar(3.9) + goldBar(6.8));
    case "tuanzhang":
      return strip(goldBar(2.4) + goldBar(5.4));
    case "yingzhang":
      return strip(goldBar(3.9));
    case "lianzhang":
      return strip(goldDot(11) + goldDot(19));
    case "paizhang":
      return strip(goldDot(15));
    case "gongbing":
      // 小扳手：C 形开口 + 圆头手柄
      return strip(
        `<path d="M10.6 2.6 A3.6 3.6 0 1 0 10.6 7.4" fill="none" stroke="${STEEL}" stroke-width="2.2" stroke-linecap="round"/>` +
          `<rect x="10" y="3.8" width="12.5" height="2.4" rx="1.2" fill="${STEEL}"/>` +
          `<circle cx="23" cy="5" r="1.9" fill="${STEEL}"/>`
      );
    case "dilei":
      // 圆雷带引线：深色圆 + 四颗小圆钉 + 一截引线
      return strip(
        `<circle cx="15" cy="5.6" r="3.4" fill="#4A4E69" stroke="#2F3247" stroke-width="0.8"/>` +
          `<circle cx="10.8" cy="5.6" r="1" fill="#4A4E69"/><circle cx="19.2" cy="5.6" r="1" fill="#4A4E69"/>` +
          `<circle cx="15" cy="9" r="0.9" fill="#4A4E69"/>` +
          `<path d="M15 2.2 q1.4 -1.6 3 -0.8" fill="none" stroke="#8F7A50" stroke-width="1" stroke-linecap="round"/>` +
          `<circle cx="13.8" cy="4.4" r="0.9" fill="#ffffff88"/>`
      );
    case "zhadan":
      // 圆炸弹：深色圆 + 弯引线 + 金色小火花，卡通味
      return strip(
        `<circle cx="14" cy="6" r="3.6" fill="#3E4A5C" stroke="#28303D" stroke-width="0.8"/>` +
          `<rect x="13" y="1.4" width="2" height="1.6" rx="0.6" fill="#28303D"/>` +
          `<path d="M14 1.6 q2.4 -1.2 4.6 0.4" fill="none" stroke="#8F7A50" stroke-width="1" stroke-linecap="round"/>` +
          goldStar(20.4, 2.6, 2) +
          `<circle cx="12.6" cy="4.6" r="1" fill="#ffffff7d"/>`
      );
    case "junqi":
      // 小军旗：旗杆 + 三角旗 + 白星
      return strip(
        `<rect x="10" y="0.8" width="1.4" height="8.6" rx="0.7" fill="#8F7A50"/>` +
          `<polygon points="11.4,1.2 22.5,3.6 11.4,6" fill="#E0663C" stroke="#B84A22" stroke-width="0.7" stroke-linejoin="round"/>` +
          `<polygon points="${starPts(14.6, 3.6, 1.5)}" fill="#FFF4DE"/>`
      );
  }
}

/** 全部兵种的军衔条（自检用：12 种互不相同） */
export function allRankBadges(): Record<Kind, string> {
  const out = {} as Record<Kind, string>;
  for (const k of KINDS) out[k] = rankBadgeSVG(k);
  return out;
}

/**
 * 盖着的子的牌背：深紫底 + 双线边框 + 五角星压纹。
 * 无参数、无侧别——红蓝双方完全同款，谁也别想从牌背认出对面的子。
 */
export function backSVG(): string {
  return (
    `<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">` +
    `<rect x="2" y="2" width="36" height="36" rx="9" fill="#6C579A"/>` +
    `<rect x="4.6" y="4.6" width="30.8" height="30.8" rx="7" fill="none" stroke="#CDBBE8" stroke-width="1.6"/>` +
    `<rect x="7.6" y="7.6" width="24.8" height="24.8" rx="5" fill="none" stroke="#CDBBE8" stroke-width="0.9" opacity="0.7"/>` +
    `<polygon points="${starPts(20, 20, 8.5)}" fill="#8D77BC" stroke="#CDBBE8" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<polygon points="${starPts(20, 19.2, 8.5)}" fill="none" stroke="#5A4685" stroke-width="0.8" opacity="0.6" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** 行营帐篷：三角帐 + 亮色前帘 + 深色门 + 草地影 */
export function tentSVG(): string {
  return (
    `<svg viewBox="0 0 34 30" width="30" height="27" aria-hidden="true">` +
    `<ellipse cx="17" cy="26.5" rx="13" ry="2.6" fill="#7FB069" opacity="0.35"/>` +
    `<polygon points="17,4 31,26 3,26" fill="#8FC46F" stroke="#5C8639" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<polygon points="17,4 24.5,26 9.5,26" fill="#A9D68B"/>` +
    `<path d="M13 26 Q17 12 21 26 Z" fill="#5C8639"/>` +
    `<rect x="16.3" y="1.2" width="1.4" height="4" rx="0.7" fill="#5C8639"/>` +
    `<polygon points="17.7,1.6 23,2.8 17.7,4" fill="#F2A03C"/>` +
    `</svg>`
  );
}

/**
 * 大本营碉堡：垛口墙 + 拱门 + 旗杆小旗（双方旗色不同，这是明摆着的地形不泄密）。
 * 旗形也是双方互异的形状通道：朵朵三角尖旗、星星燕尾旗——去掉颜色也认得出这是谁家。
 */
export function hqSVG(side: Side): string {
  const flag = SIDE_COLOR[side];
  const pennant =
    side === "duo"
      ? `<polygon points="28.6,1.6 21.6,3.4 28.6,5.2" fill="${flag}"/>`
      : `<path d="M28.6 1.6 L21.6 1.6 L23.6 3.4 L21.6 5.2 L28.6 5.2 Z" fill="${flag}"/>`;
  return (
    `<svg viewBox="0 0 36 32" width="32" height="29" aria-hidden="true">` +
    `<ellipse cx="18" cy="29" rx="14" ry="2.4" fill="#8F7A50" opacity="0.3"/>` +
    `<rect x="5" y="13" width="26" height="15" rx="2.5" fill="#D9C79E" stroke="#8F7A50" stroke-width="1.4"/>` +
    `<rect x="5" y="10" width="6" height="5" rx="1.2" fill="#C9B48A" stroke="#8F7A50" stroke-width="1.2"/>` +
    `<rect x="15" y="10" width="6" height="5" rx="1.2" fill="#C9B48A" stroke="#8F7A50" stroke-width="1.2"/>` +
    `<rect x="25" y="10" width="6" height="5" rx="1.2" fill="#C9B48A" stroke="#8F7A50" stroke-width="1.2"/>` +
    `<path d="M13.5 28 v-6.5 a4.5 4.5 0 0 1 9 0 V28 Z" fill="#8F7A50"/>` +
    `<rect x="28.6" y="1" width="1.5" height="10" rx="0.75" fill="#8F7A50"/>` +
    pennant +
    `</svg>`
  );
}

/** 前沿的小山：两座圆润绿丘 + 雪顶 */
export function mountainSVG(): string {
  return (
    `<svg viewBox="0 0 44 26" width="40" height="24" aria-hidden="true">` +
    `<path d="M2 24 Q13 2 24 24 Z" fill="#8FB573" stroke="#5C8639" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M10.2 10.5 Q13 5.5 15.8 10.5 Q13 12.6 10.2 10.5 Z" fill="#F4F8EC"/>` +
    `<path d="M20 24 Q31 6 42 24 Z" fill="#A9C98B" stroke="#5C8639" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M27.6 13.4 Q31 9 34.4 13.4 Q31 15.4 27.6 13.4 Z" fill="#F4F8EC"/>` +
    `</svg>`
  );
}

/** 炸弹同尽的卡通烟云：几团圆云 + 两颗小星星，圆滚滚不吓人 */
export function smokeSVG(): string {
  const cloud = "#EDE8DE";
  const rim = "#C6BDAD";
  return (
    `<svg viewBox="0 0 48 40" width="44" height="37" aria-hidden="true">` +
    `<circle cx="24" cy="18" r="11" fill="${cloud}" stroke="${rim}" stroke-width="1.4"/>` +
    `<circle cx="12" cy="24" r="7.5" fill="${cloud}" stroke="${rim}" stroke-width="1.4"/>` +
    `<circle cx="36" cy="24" r="7.5" fill="${cloud}" stroke="${rim}" stroke-width="1.4"/>` +
    `<circle cx="24" cy="28" r="8.5" fill="${cloud}"/>` +
    `<circle cx="19" cy="15" r="3" fill="#ffffff"/>` +
    goldStar(7, 8, 3.2) +
    goldStar(41, 10, 2.6) +
    `</svg>`
  );
}

/**
 * 扛旗成功的升旗杆：金顶旗杆，旗面挂 fx-flag 类，交给 CSS 从杆底升到顶再飘两下。
 * 旗面是双方互异的形状通道：朵朵三角尖旗配小花徽，星星燕尾旗配白星徽。
 */
export function hoistSVG(side: Side): string {
  const flag = SIDE_COLOR[side];
  const dark = SIDE_DARK[side];
  const face =
    side === "duo"
      ? `<polygon points="6,5 24,9 6,13" fill="${flag}" stroke="${dark}" stroke-width="0.9" stroke-linejoin="round"/>` +
        petalRing(11, 9, 1.9, 1.15, "#FFF4DE", dark) +
        `<circle cx="11" cy="9" r="1" fill="${GOLD}"/>`
      : `<path d="M6 5 L24 5 L20.4 9 L24 13 L6 13 Z" fill="${flag}" stroke="${dark}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<polygon points="${starPts(12, 9, 2.4)}" fill="#FFF4DE"/>`;
  return (
    `<svg viewBox="0 0 26 46" width="24" height="43" aria-hidden="true">` +
    `<rect x="4" y="3" width="2" height="41" rx="1" fill="#8F7A50"/>` +
    `<circle cx="5" cy="3" r="2.2" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.8"/>` +
    `<g class="fx-flag">` +
    face +
    `</g>` +
    `</svg>`
  );
}

/**
 * HUD 上的小军旗徽标。颜色之外的形状第二通道（专项③）：
 * 朵朵是波浪旗 + 五瓣小花徽，星星是燕尾旗 + 白星徽——去掉颜色也一眼分得开。
 */
export function crestSVG(side: Side): string {
  const flag = SIDE_COLOR[side];
  const dark = SIDE_DARK[side];
  const face =
    side === "duo"
      ? `<path d="M3.6 2 Q11 0.4 20 2.6 Q18.4 5.6 20 8.6 Q11 10.8 3.6 8.6 Z" fill="${flag}" stroke="${dark}" stroke-width="0.9" stroke-linejoin="round"/>` +
        petalRing(9.5, 5.4, 2, 1.2, "#FFF4DE", dark) +
        `<circle cx="9.5" cy="5.4" r="1" fill="${GOLD}"/>`
      : `<path d="M3.6 2 L20 2 L16.8 5.5 L20 9 L3.6 9 Z" fill="${flag}" stroke="${dark}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<polygon points="${starPts(9.5, 5.5, 2.6)}" fill="#FFF4DE"/>`;
  return (
    `<svg viewBox="0 0 22 16" width="20" height="15" aria-hidden="true">` +
    `<rect x="2" y="1" width="1.6" height="14" rx="0.8" fill="#8F7A50"/>` +
    face +
    `</svg>`
  );
}

/**
 * 双方的形状角标（专项③第二通道，盖在翻开棋面的左下角）：
 * 朵朵一朵圆瓣小花、星星一颗尖角五角星——16px 灰度下靠剪影就分得清是谁的子。
 * 只跟着「翻开的」棋面走；牌背由 backSVG 统一无侧别，信息红线不破。
 */
export function sideMarkSVG(side: Side): string {
  if (side === "duo") {
    return (
      `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">` +
      petalRing(8, 8, 3.4, 2.5, "#FFF4E4", SIDE_DARK.duo) +
      `<circle cx="8" cy="8" r="2.2" fill="${SIDE_COLOR.duo}" stroke="${SIDE_DARK.duo}" stroke-width="0.8"/>` +
      `</svg>`
    );
  }
  return (
    `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">` +
    `<polygon points="${starPts(8, 8.6, 7)}" fill="#F2F7FF" stroke="${SIDE_DARK.star}" stroke-width="1" stroke-linejoin="round"/>` +
    `<polygon points="${starPts(8, 8.6, 3.4)}" fill="${SIDE_COLOR.star}"/>` +
    `</svg>`
  );
}
