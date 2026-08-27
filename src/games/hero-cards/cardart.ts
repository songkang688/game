/**
 * 英杰令 · 1.3 视觉资产(纯函数 SVG 生成器)。
 *
 * 这一款是棋牌(视觉宪法定级:精 2D),卡面走 DOM+SVG 保住按钮语义与键盘操作,
 * 所以共享 kit 里 Canvas 版的心形 / 金币画法在这里落成同规格的 SVG:
 * 调色一律 import `src/art/kit` 的 KIT_PALETTE / CHAR_COLORS / shade / tint,
 * 不另起炉灶;朵朵、星星两位共享 IP 的头像配色直接取 CHAR_COLORS。
 *
 * 全部函数只吃数据吐字符串:零 DOM、零随机、零副作用,单测直接对着字符串断言。
 * 分级红线:攻击画成花瓣剑光 + 星星,无血液;反派也圆润。
 */

import { CHAR_COLORS, KIT_PALETTE, shade, tint } from "../../art/kit";
import { cardName, pointLabel, type Card, type CardKind, type GearId, type Suit } from "./cards";
import { heroOf, HEROES } from "./heroes";

// ---------------------------------------------------------------------------
// 花色:形状 + 颜色双通道(色弱只看形状也分得开)
// ---------------------------------------------------------------------------

/** 四门花色的传统红黑(红门偏花红/果红,黑门偏叶墨/石墨,全是暗色可读) */
export const SUIT_ART: Record<Suit, { color: string; deep: string }> = {
  flower: { color: "#e0507a", deep: "#a83358" },
  berry: { color: "#d8433c", deep: "#a32c27" },
  leaf: { color: "#3d5a40", deep: "#243b28" },
  stone: { color: "#474a5a", deep: "#2c2f3d" }
};

/** 花色符号的内笔画(13×13 盒子),四种剪影完全不同 */
function suitGlyphInner(suit: Suit): string {
  const c = SUIT_ART[suit];
  switch (suit) {
    case "flower":
      // 五瓣小花:五个花瓣圆 + 深色花芯
      return (
        `<circle cx="6.5" cy="2.9" r="2.2" fill="${c.color}"/>` +
        `<circle cx="9.9" cy="5.4" r="2.2" fill="${c.color}"/>` +
        `<circle cx="8.6" cy="9.4" r="2.2" fill="${c.color}"/>` +
        `<circle cx="4.4" cy="9.4" r="2.2" fill="${c.color}"/>` +
        `<circle cx="3.1" cy="5.4" r="2.2" fill="${c.color}"/>` +
        `<circle cx="6.5" cy="6.5" r="2" fill="${c.deep}"/>`
      );
    case "berry":
      // 双果一叶:两颗果子 + 果柄 + 小叶
      return (
        `<path d="M6.8 2 Q4.6 4.4 4.4 6.4 M6.8 2 Q8.8 4.6 9.4 6.8" stroke="${c.deep}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
        `<ellipse cx="8" cy="2.6" rx="2" ry="1.1" fill="#5e8b4f" transform="rotate(-18 8 2.6)"/>` +
        `<circle cx="4.4" cy="8.6" r="2.9" fill="${c.color}"/>` +
        `<circle cx="9.4" cy="9.2" r="2.5" fill="${c.color}"/>` +
        `<circle cx="3.5" cy="7.7" r="0.8" fill="${tint(c.color, 0.55)}"/>`
      );
    case "leaf":
      // 一片叶子 + 中脉
      return (
        `<path d="M6.5 1.5 C11 3.5 12 8 6.5 12 C1 8 2 3.5 6.5 1.5 Z" fill="${c.color}"/>` +
        `<path d="M6.5 3 L6.5 10.5" stroke="${tint(c.color, 0.45)}" stroke-width="1.1" stroke-linecap="round"/>`
      );
    case "stone":
      // 圆润小石头 + 棱面线 + 高光点
      return (
        `<path d="M3 5 Q3.5 2.5 6.5 2 Q10 2.5 10.5 5.5 Q11 8.5 8.5 10.5 Q5.5 11.5 3.5 9.5 Q2 7.5 3 5 Z" fill="${c.color}"/>` +
        `<path d="M4.4 8.8 L8.6 4.2" stroke="${c.deep}" stroke-width="1" stroke-linecap="round"/>` +
        `<circle cx="5" cy="4.2" r="0.9" fill="${tint(c.color, 0.5)}"/>`
      );
  }
}

/** 单独一枚花色符号(座位/攻略等处复用) */
export function suitGlyphSVG(suit: Suit, size = 14): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 13" width="${size}" height="${size}" aria-hidden="true">${suitGlyphInner(suit)}</svg>`;
}

// ---------------------------------------------------------------------------
// 底部名牌配色:攻击红 / 防御蓝 / 回复绿 / 锦囊紫 / 装备棕
// ---------------------------------------------------------------------------

export const PLATE_COLORS = {
  attack: "#c5474d",
  guard: "#4a6fb5",
  heal: "#4f9d62",
  trick: "#8a5fb8",
  gear: "#9a6b42"
} as const;

export type PlateKind = keyof typeof PLATE_COLORS;

/** 这张牌底部名牌用哪个色系 */
export function plateKind(kind: CardKind): PlateKind {
  if (kind === "slash" || kind === "duel") return "attack";
  if (kind === "dodge" || kind === "nullify") return "guard";
  if (kind === "heal") return "heal";
  if (kind === "weapon" || kind === "armor" || kind === "horsePlus" || kind === "horseMinus") return "gear";
  return "trick";
}

// ---------------------------------------------------------------------------
// 中央卡图:每类一张双色填充 + 描边的简笔图标(≤20 笔)
// 图标画在以 (0,0) 为中心、约 36×34 的盒子里
// ---------------------------------------------------------------------------

const INK = KIT_PALETTE.ink;

/** 交叉的花瓣剑(攻击=剑光,不见血) */
function iconSlash(): string {
  return (
    `<g transform="rotate(45)"><rect x="-3" y="-15" width="6" height="22" rx="3" fill="${KIT_PALETTE.candyDeep}" stroke="#a83358" stroke-width="1.4"/><rect x="-4.5" y="7" width="9" height="3.4" rx="1.7" fill="${KIT_PALETTE.woodDark}"/></g>` +
    `<g transform="rotate(-45)"><rect x="-3" y="-15" width="6" height="22" rx="3" fill="${KIT_PALETTE.coral}" stroke="#a8402f" stroke-width="1.4"/><rect x="-4.5" y="7" width="9" height="3.4" rx="1.7" fill="${KIT_PALETTE.woodDark}"/></g>` +
    `<path d="M0 -15 L1.6 -11.6 L5.2 -11.4 L2.5 -9 L3.4 -5.6 L0 -7.5 L-3.4 -5.6 L-2.5 -9 L-5.2 -11.4 L-1.6 -11.6 Z" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1"/>`
  );
}

/** 星星盾 */
function iconDodge(): string {
  return (
    `<path d="M0 -15 C7 -11.5 13 -11.5 13 -7.5 C13 3 7 11 0 15 C-7 11 -13 3 -13 -7.5 C-13 -11.5 -7 -11.5 0 -15 Z" fill="${KIT_PALETTE.gem}" stroke="#2f5f80" stroke-width="1.6"/>` +
    `<path d="M0 -8 L1.9 -3.9 L6.3 -3.7 L3 -0.8 L4.1 3.4 L0 1 L-4.1 3.4 L-3 -0.8 L-6.3 -3.7 L-1.9 -3.9 Z" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1.1"/>`
  );
}

/** 蜜桃汤碗 */
function iconHeal(): string {
  return (
    `<path d="M-13 2 Q-13 12 0 12 Q13 12 13 2 Z" fill="${KIT_PALETTE.gem}" stroke="#2f5f80" stroke-width="1.5"/>` +
    `<rect x="-9" y="11" width="18" height="2.6" rx="1.3" fill="#2f5f80"/>` +
    `<circle cx="0" cy="-4" r="8" fill="${KIT_PALETTE.peach}" stroke="#b06a3a" stroke-width="1.4"/>` +
    `<path d="M0 -11.5 Q0 -6 0 -1" stroke="#b06a3a" stroke-width="1.2" fill="none"/>` +
    `<ellipse cx="4.5" cy="-11" rx="3.4" ry="1.7" fill="${KIT_PALETTE.grassDeep}" transform="rotate(24 4.5 -11)"/>` +
    `<circle cx="-3" cy="-6.5" r="1.6" fill="${tint(KIT_PALETTE.peach, 0.55)}"/>`
  );
}

/** 顺手摘花:小手够一朵花 */
function iconSnatch(): string {
  return (
    `<path d="M4 -13 Q1 -8 3 -2" stroke="${KIT_PALETTE.grassDeep}" stroke-width="1.6" fill="none"/>` +
    `<circle cx="4" cy="-13" r="2.4" fill="${KIT_PALETTE.candyDeep}"/>` +
    `<circle cx="8.4" cy="-10.5" r="2.4" fill="${KIT_PALETTE.candyDeep}"/>` +
    `<circle cx="7.5" cy="-15.5" r="2.4" fill="${KIT_PALETTE.candyDeep}"/>` +
    `<circle cx="6.6" cy="-12.9" r="1.9" fill="${KIT_PALETTE.starGold}"/>` +
    `<path d="M-12 12 Q-14 4 -8 1 Q-6 -3 -2 -1 Q3 -3 3 2 Q3 8 -3 12 Z" fill="${KIT_PALETTE.peach}" stroke="#b06a3a" stroke-width="1.4"/>` +
    `<path d="M-7 2 Q-5 0 -2.6 1.4" stroke="#b06a3a" stroke-width="1.1" fill="none"/>`
  );
}

/** 拆花篮 */
function iconDismantle(): string {
  return (
    `<path d="M-9 -12 Q0 -20 9 -12" stroke="${KIT_PALETTE.woodDark}" stroke-width="2.2" fill="none"/>` +
    `<path d="M-12 -6 L-9 11 Q0 14 9 11 L12 -6 Z" fill="${KIT_PALETTE.woodLight}" stroke="${KIT_PALETTE.woodDark}" stroke-width="1.6"/>` +
    `<path d="M-11 -1 L11 -1 M-10 4.5 L10 4.5 M-4.5 -5.5 L-3.5 12.5 M4.5 -5.5 L3.5 12.5" stroke="${KIT_PALETTE.woodDark}" stroke-width="1.1"/>` +
    `<rect x="-13" y="-7.5" width="26" height="3.4" rx="1.7" fill="${shade(KIT_PALETTE.woodLight, 0.22)}" stroke="${KIT_PALETTE.woodDark}" stroke-width="1.1"/>`
  );
}

/** 对花令:交叉的两面小旗 */
function iconDuel(): string {
  return (
    `<g transform="rotate(24)"><rect x="-1.2" y="-14" width="2.4" height="28" rx="1.2" fill="${KIT_PALETTE.woodDark}"/><path d="M1 -14 L13 -10 L1 -6 Z" fill="${KIT_PALETTE.coral}" stroke="#a8402f" stroke-width="1.1"/></g>` +
    `<g transform="rotate(-24)"><rect x="-1.2" y="-14" width="2.4" height="28" rx="1.2" fill="${KIT_PALETTE.woodDark}"/><path d="M1 -14 L13 -10 L1 -6 Z" fill="${KIT_PALETTE.gem}" stroke="#2f5f80" stroke-width="1.1"/></g>` +
    `<circle cx="0" cy="12" r="2.6" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1"/>`
  );
}

/** 落英缤纷:旋风卷着花瓣 */
function iconPetalStorm(): string {
  return (
    `<path d="M-11 -6 Q6 -12 10 -2 Q12 6 2 7 Q-5 7.5 -4 2 Q-3 -2 2 -1" stroke="${KIT_PALETTE.skyDeep}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="-9" cy="4" rx="3.2" ry="2" fill="${KIT_PALETTE.candy}" stroke="#c76a8e" stroke-width="1" transform="rotate(-30 -9 4)"/>` +
    `<ellipse cx="9" cy="-9" rx="3.2" ry="2" fill="${KIT_PALETTE.candyDeep}" stroke="#c1447a" stroke-width="1" transform="rotate(20 9 -9)"/>` +
    `<ellipse cx="1" cy="12" rx="3" ry="1.9" fill="${KIT_PALETTE.candy}" stroke="#c76a8e" stroke-width="1" transform="rotate(12 1 12)"/>`
  );
}

/** 流星阵雨:一颗大流星 + 两颗小星 */
function iconStarShower(): string {
  return (
    `<path d="M-14 -12 L-2 -2 M-9 -14 L1 -6" stroke="${tint(KIT_PALETTE.starGold, 0.35)}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M4 -4 L6.4 0.8 L11.6 1.4 L7.8 5 L8.8 10.2 L4 7.6 L-0.8 10.2 L0.2 5 L-3.6 1.4 L1.6 0.8 Z" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1.3"/>` +
    `<path d="M-10 4 L-8.9 6.1 L-6.7 6.4 L-8.3 8 L-7.9 10.2 L-10 9.1 L-12.1 10.2 L-11.7 8 L-13.3 6.4 L-11.1 6.1 Z" fill="${tint(KIT_PALETTE.starGold, 0.3)}" stroke="#8a6420" stroke-width="0.9"/>`
  );
}

/** 贪玩令:小纸鸢(延时判定) */
function iconPlayful(): string {
  return (
    `<path d="M0 -14 L11 0 L0 9 L-11 0 Z" fill="${KIT_PALETTE.lilac}" stroke="#7a5aa8" stroke-width="1.5"/>` +
    `<path d="M0 -14 L0 9 M-11 0 L11 0" stroke="#7a5aa8" stroke-width="1.1"/>` +
    `<path d="M0 9 Q3 12 1 15" stroke="#7a5aa8" stroke-width="1.2" fill="none"/>` +
    `<path d="M1 12 l2.4 -1.6 l-0.3 2.9 Z" fill="${KIT_PALETTE.coral}"/>` +
    `<circle cx="0" cy="-2.5" r="2" fill="${KIT_PALETTE.starGold}"/>`
  );
}

/** 春风无懈:大叶片挡住风 */
function iconNullify(): string {
  return (
    `<path d="M-14 -8 Q-6 -11 0 -8 M-14 0 Q-4 -3 4 0" stroke="${KIT_PALETTE.skyDeep}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M4 -12 C13 -8 14 2 4 12 C-6 2 -5 -8 4 -12 Z" fill="${KIT_PALETTE.grass}" stroke="${KIT_PALETTE.grassDeep}" stroke-width="1.6"/>` +
    `<path d="M4 -9 L4 9" stroke="${KIT_PALETTE.grassDeep}" stroke-width="1.2" stroke-linecap="round"/>`
  );
}

/** 春风借力:风圈托着一把小花剑 */
function iconBorrow(): string {
  return (
    `<path d="M-12 6 Q-14 -2 -6 -4 Q-2 -10 5 -7 Q12 -6 11 1 Q13 8 4 9 Q-5 12 -12 6 Z" fill="none" stroke="${KIT_PALETTE.skyDeep}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<g transform="rotate(35)"><rect x="-2.2" y="-11" width="4.4" height="16" rx="2.2" fill="${KIT_PALETTE.candyDeep}" stroke="#a83358" stroke-width="1.2"/><rect x="-4" y="5" width="8" height="3" rx="1.5" fill="${KIT_PALETTE.woodDark}"/></g>`
  );
}

/** 装备图标(按型号) */
function gearIconInner(id: GearId): string {
  switch (id) {
    case "flute":
      // 银铃短笛:笛身 + 音孔 + 小铃铛
      return (
        `<rect x="-14" y="-3" width="26" height="6" rx="3" fill="${KIT_PALETTE.stone}" stroke="#5a6070" stroke-width="1.4"/>` +
        `<circle cx="-6" cy="0" r="1.2" fill="#5a6070"/><circle cx="-1" cy="0" r="1.2" fill="#5a6070"/><circle cx="4" cy="0" r="1.2" fill="#5a6070"/>` +
        `<circle cx="13" cy="-6" r="3.4" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1.2"/><circle cx="13" cy="-5" r="1" fill="#8a6420"/>`
      );
    case "fan":
      // 玉兰折扇:五页扇面
      return (
        `<path d="M0 12 L-13 -8 A15.5 15.5 0 0 1 13 -8 Z" fill="${KIT_PALETTE.mint}" stroke="#4e8b6d" stroke-width="1.5"/>` +
        `<path d="M0 12 L-7 -11 M0 12 L0 -13 M0 12 L7 -11" stroke="#4e8b6d" stroke-width="1.1"/>` +
        `<circle cx="0" cy="12" r="2.2" fill="${KIT_PALETTE.woodDark}"/>`
      );
    case "ribbon":
      // 长虹彩带:蝴蝶结 + 飘带
      return (
        `<path d="M-2 0 Q-13 -8 -13 0 Q-13 8 -2 0 Z" fill="${KIT_PALETTE.candyDeep}" stroke="#c1447a" stroke-width="1.3"/>` +
        `<path d="M2 0 Q13 -8 13 0 Q13 8 2 0 Z" fill="${KIT_PALETTE.candyDeep}" stroke="#c1447a" stroke-width="1.3"/>` +
        `<circle cx="0" cy="0" r="3" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="1.1"/>` +
        `<path d="M-2 3 Q-6 10 -3 14 M2 3 Q6 10 3 14" stroke="#c1447a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
      );
    case "kite":
      // 纸鸢长弓:弓臂 + 弦 + 一支圆头小箭
      return (
        `<path d="M-8 -13 Q10 0 -8 13" stroke="${KIT_PALETTE.woodDark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
        `<path d="M-8 -13 L-8 13" stroke="#5a6070" stroke-width="1.2"/>` +
        `<path d="M-8 0 L12 0" stroke="${KIT_PALETTE.woodLight}" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="13" cy="0" r="2.2" fill="${KIT_PALETTE.coral}" stroke="#a8402f" stroke-width="1"/>`
      );
    case "wheel":
      // 连珠花轮:花瓣轮辐
      return (
        `<circle cx="0" cy="0" r="12" fill="${KIT_PALETTE.lemon}" stroke="#b08a2a" stroke-width="1.6"/>` +
        `<path d="M0 -11 L0 11 M-11 0 L11 0 M-7.8 -7.8 L7.8 7.8 M-7.8 7.8 L7.8 -7.8" stroke="#b08a2a" stroke-width="1.3"/>` +
        `<circle cx="0" cy="0" r="4" fill="${KIT_PALETTE.candyDeep}" stroke="#c1447a" stroke-width="1.2"/>`
      );
    case "cloak":
      // 星纱披风:小披风 + 星扣
      return (
        `<path d="M-10 -9 Q0 -14 10 -9 L13 11 Q0 15 -13 11 Z" fill="${KIT_PALETTE.lilac}" stroke="#7a5aa8" stroke-width="1.5"/>` +
        `<path d="M-6 -8 Q0 -5 6 -8" stroke="#7a5aa8" stroke-width="1.2" fill="none"/>` +
        `<path d="M0 -4 L1.3 -1.4 L4.1 -1.1 L2 0.8 L2.6 3.6 L0 2.2 L-2.6 3.6 L-2 0.8 L-4.1 -1.1 L-1.3 -1.4 Z" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="0.9"/>`
      );
    case "plus":
      // 疾风小马:Q 版马头
      return (
        `<path d="M-9 12 Q-12 2 -6 -4 L-2 -12 L3 -6 Q12 -5 12 4 Q12 12 4 12 Z" fill="${KIT_PALETTE.peach}" stroke="#b06a3a" stroke-width="1.5"/>` +
        `<path d="M-2 -12 L-4 -3 L2 -6 Z" fill="${shade(KIT_PALETTE.peach, 0.25)}"/>` +
        `<circle cx="4" cy="2" r="1.6" fill="${INK}"/>` +
        `<path d="M-6 -4 Q-9 3 -7 9" stroke="#b06a3a" stroke-width="1.2" fill="none"/>`
      );
    case "minus":
      // 踏云软靴:小靴子踩着云
      return (
        `<path d="M-6 -12 L-6 4 Q-6 8 0 8 L10 8 Q13 8 12 4 Q11 1 4 0 L4 -12 Z" fill="${KIT_PALETTE.gem}" stroke="#2f5f80" stroke-width="1.5"/>` +
        `<path d="M-6 -8 L4 -8" stroke="#2f5f80" stroke-width="1.1"/>` +
        `<path d="M-10 12 Q-12 8 -7 8 Q-6 4.5 -1 6 Q4 4.5 5 8 Q10 8 8 12 Z" fill="${KIT_PALETTE.cloud}" stroke="#a8c4d8" stroke-width="1.2"/>`
      );
  }
}

/** 中央卡图的内笔画(不带 svg 外壳) */
function kindIconInner(card: Pick<Card, "kind" | "gear">): string {
  if (card.gear) return gearIconInner(card.gear);
  switch (card.kind) {
    case "slash":
      return iconSlash();
    case "dodge":
      return iconDodge();
    case "heal":
      return iconHeal();
    case "snatch":
      return iconSnatch();
    case "dismantle":
      return iconDismantle();
    case "duel":
      return iconDuel();
    case "petalStorm":
      return iconPetalStorm();
    case "starShower":
      return iconStarShower();
    case "playful":
      return iconPlayful();
    case "nullify":
      return iconNullify();
    case "borrow":
      return iconBorrow();
    default:
      return gearIconInner(card.kind === "armor" ? "cloak" : "fan");
  }
}

/** 装备小图标(座位装备栏用) */
export function gearIconSVG(id: GearId, size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 32 32" width="${size}" height="${size}" aria-hidden="true">${gearIconInner(id)}</svg>`;
}

// ---------------------------------------------------------------------------
// 完整卡面:角标花色 + 点数、中央卡图、底部名牌,一眼三层
// ---------------------------------------------------------------------------

/**
 * 一张牌的完整卡面 SVG(viewBox 60×84,`preserveAspectRatio="none"` 随容器伸缩)。
 * 点数与牌名是 SVG 文本,沿用 `.hc-card-suit` / `.hc-card-name` 的字号契约(14px 控件档)。
 */
export function cardArtSVG(card: Card): string {
  const suit = SUIT_ART[card.suit];
  const plate = PLATE_COLORS[plateKind(card.kind)];
  const label = cardName(card);
  // 四字名压进 46px 名牌;三字以内原样排
  const squeeze = label.length >= 4 ? ' textLength="46" lengthAdjust="spacingAndGlyphs"' : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect x="1" y="1" width="58" height="82" rx="8" fill="#ffffff" stroke="#e8d9c4" stroke-width="2"/>` +
    `<rect x="4" y="4" width="52" height="76" rx="6" fill="none" stroke="#f3e8d8" stroke-width="1.2"/>` +
    `<g transform="translate(4.5,4.5)">${suitGlyphInner(card.suit)}</g>` +
    `<text class="hc-card-suit" x="11" y="31" text-anchor="middle" font-weight="800" fill="${suit.color}">${pointLabel(card.point)}</text>` +
    `<g transform="translate(30,41)">${kindIconInner(card)}</g>` +
    `<rect x="6" y="63" width="48" height="16" rx="8" fill="${plate}" stroke="${shade(plate, 0.28)}" stroke-width="1.2"/>` +
    `<text class="hc-card-name" x="30" y="75.5" text-anchor="middle" font-weight="800" fill="#ffffff"${squeeze}>${label}</text>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 牌背与牌堆:深蓝底 + 金色云纹边框 + 中心「令」字圆章
// ---------------------------------------------------------------------------

/** 牌背内笔画(60×84 盒子),deckStackSVG 与单张牌背共用 */
function cardBackInner(): string {
  const gold = KIT_PALETTE.starGold;
  const navy = KIT_PALETTE.nightBlue;
  // 四角云纹:同一朵云换四个角
  const cloud = `<path d="M0 0 q3 -4 6 -1 q4 -2 4 2 q3 1 1 4" fill="none" stroke="${gold}" stroke-width="1.1" stroke-linecap="round"/>`;
  return (
    `<rect x="1" y="1" width="58" height="82" rx="8" fill="${navy}" stroke="${shade(navy, 0.35)}" stroke-width="2"/>` +
    `<rect x="5" y="5" width="50" height="74" rx="6" fill="none" stroke="${gold}" stroke-width="1.5"/>` +
    `<g transform="translate(9,10)">${cloud}</g>` +
    `<g transform="translate(51,10) scale(-1,1)">${cloud}</g>` +
    `<g transform="translate(9,74) scale(1,-1)">${cloud}</g>` +
    `<g transform="translate(51,74) scale(-1,-1)">${cloud}</g>` +
    `<circle cx="30" cy="42" r="13" fill="${tint(navy, 0.12)}" stroke="${gold}" stroke-width="1.6"/>` +
    `<circle cx="30" cy="42" r="10.4" fill="none" stroke="${gold}" stroke-width="0.8"/>` +
    `<text x="30" y="47.5" text-anchor="middle" font-size="14" font-weight="900" fill="${gold}">令</text>`
  );
}

/** 单张牌背 */
export function cardBackSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${cardBackInner()}</svg>`;
}

/** 牌堆实体:三张牌背叠起,底下两张微微歪 */
export function deckStackSVG(): string {
  const back = cardBackInner();
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 74 96" width="100%" height="100%" aria-hidden="true">` +
    `<g transform="translate(12,10) rotate(-5 30 42)" opacity="0.8">${back}</g>` +
    `<g transform="translate(9,5) rotate(3 30 42)" opacity="0.9">${back}</g>` +
    `<g transform="translate(7,1)">${back}</g>` +
    `</svg>`
  );
}

/** 弃牌堆空着时的虚位:虚线框 + 一片淡花瓣 */
export function emptyDiscardSVG(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect x="2" y="2" width="56" height="80" rx="8" fill="none" stroke="#d8c2a8" stroke-width="2" stroke-dasharray="5 4"/>` +
    `<ellipse cx="30" cy="42" rx="8" ry="5" fill="${KIT_PALETTE.candy}" opacity="0.5" transform="rotate(-24 30 42)"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 体力心形排:实心红心 = 现有元气,空心 = 掉掉的
// ---------------------------------------------------------------------------

/** 一颗心的路径(12×12 盒子) */
const HEART_PATH =
  "M6 10.6 C2.4 8 0.8 5.6 1.5 3.6 C2.1 1.9 4.3 1.2 6 3 C7.7 1.2 9.9 1.9 10.5 3.6 C11.2 5.6 9.6 8 6 10.6 Z";

/**
 * 体力条:maxVigor 颗心,前 vigor 颗实心。
 * 实心/空心各带 `hc-heart-full` / `hc-heart-empty` 类,测试按类名数数。
 */
export function heartsSVG(vigor: number, maxVigor: number): string {
  const n = Math.max(0, Math.round(maxVigor));
  if (n === 0) return "";
  const v = Math.min(n, Math.max(0, Math.round(vigor)));
  const full = KIT_PALETTE.candyDeep;
  let cells = "";
  for (let i = 0; i < n; i++) {
    const on = i < v;
    cells +=
      `<g class="${on ? "hc-heart-full" : "hc-heart-empty"}" transform="translate(${i * 13},0)">` +
      `<path d="${HEART_PATH}" fill="${on ? full : KIT_PALETTE.paper}" stroke="${on ? shade(full, 0.3) : "#c9b6a4"}" stroke-width="1.4"/>` +
      (on ? `<circle cx="4" cy="4" r="1" fill="${tint(full, 0.55)}"/>` : "") +
      `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n * 13} 12" width="${n * 13}" height="12" aria-hidden="true">${cells}</svg>`;
}

// ---------------------------------------------------------------------------
// 英杰头像:48×48 Q 版(2 头身、大眼、按 look.hat 配原创头饰)
// ---------------------------------------------------------------------------

/** 各头饰的笔画(画在头顶附近;face 圆心 24,21 半径 13.5) */
function hatInner(hat: string, primary: string, deep: string): string {
  const gold = KIT_PALETTE.starGold;
  switch (hat) {
    case "tulip":
      // 郁金香冠
      return (
        `<path d="M18 9 Q18 3 21 3 Q22 6 24 4 Q26 6 27 3 Q30 3 30 9 Q27 12 24 12 Q21 12 18 9 Z" fill="${primary}" stroke="${deep}" stroke-width="1.3"/>` +
        `<path d="M24 12 L24 8" stroke="${deep}" stroke-width="1.1"/>`
      );
    case "scope":
      // 观星平帽 + 单片星镜
      return (
        `<path d="M11 12 Q24 4 37 12 L35 16 Q24 11 13 16 Z" fill="${primary}" stroke="${deep}" stroke-width="1.3"/>` +
        `<path d="M24 5 L25 7.4 L27.6 7.7 L25.7 9.4 L26.2 12 L24 10.7 L21.8 12 L22.3 9.4 L20.4 7.7 L23 7.4 Z" fill="${gold}" stroke="#8a6420" stroke-width="0.8"/>` +
        `<circle cx="29" cy="22" r="4.6" fill="none" stroke="${gold}" stroke-width="1.4"/>`
      );
    case "helm":
      // 将军小盔 + 缨穗
      return (
        `<path d="M11 15 Q11 4 24 4 Q37 4 37 15 L34 17 Q24 12 14 17 Z" fill="${primary}" stroke="${deep}" stroke-width="1.3"/>` +
        `<circle cx="24" cy="4" r="2.2" fill="${gold}" stroke="#8a6420" stroke-width="0.9"/>` +
        `<path d="M24 2 Q29 -2 32 2 Q29 3 26 3" fill="${KIT_PALETTE.coral}" stroke="#a8402f" stroke-width="0.9"/>`
      );
    case "cloud":
      // 云朵蓬蓬头
      return (
        `<path d="M10 14 Q8 8 14 8 Q15 2 22 4 Q28 0 32 5 Q39 4 38 11 Q41 15 36 16 Q24 10 12 16 Q9 16 10 14 Z" fill="${KIT_PALETTE.cloud}" stroke="#a8c4d8" stroke-width="1.3"/>` +
        `<circle cx="17" cy="9" r="1.2" fill="#dceefb"/>`
      );
    case "dango":
      // 三色糖串
      return (
        `<rect x="23.2" y="-1" width="1.6" height="12" rx="0.8" fill="${KIT_PALETTE.woodDark}"/>` +
        `<circle cx="24" cy="1.5" r="2.6" fill="${KIT_PALETTE.candy}" stroke="#c76a8e" stroke-width="1"/>` +
        `<circle cx="24" cy="6" r="2.6" fill="${KIT_PALETTE.cloud}" stroke="#c9b6a4" stroke-width="1"/>` +
        `<circle cx="24" cy="10.5" r="2.6" fill="${KIT_PALETTE.mint}" stroke="#4e8b6d" stroke-width="1"/>`
      );
    case "rock":
      // 平顶石帽 + 一点青苔
      return (
        `<path d="M12 13 Q12 7 17 7 L31 7 Q36 7 36 13 Q30 10.5 24 10.5 Q18 10.5 12 13 Z" fill="${primary}" stroke="${deep}" stroke-width="1.3"/>` +
        `<circle cx="30" cy="8.5" r="1.6" fill="${KIT_PALETTE.grass}"/>`
      );
    case "spark":
      // 闪电呆毛 + 星星发卡
      return (
        `<path d="M23 9 L26 2 L25 8 L28 6 L24 12" fill="none" stroke="${deep}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M15 12 L16.2 14.6 L19 14.9 L17 16.8 L17.5 19.6 L15 18.2 L12.5 19.6 L13 16.8 L11 14.9 L13.8 14.6 Z" fill="${gold}" stroke="#8a6420" stroke-width="0.9"/>`
      );
    case "sprout":
      // 头顶小豆芽
      return (
        `<path d="M24 12 L24 6" stroke="${deep}" stroke-width="1.5" stroke-linecap="round"/>` +
        `<path d="M24 6 Q18 6 17 1 Q23 0 24 6 Z" fill="${primary}" stroke="${deep}" stroke-width="1.1"/>` +
        `<path d="M24 6 Q30 6 31 1 Q25 0 24 6 Z" fill="${KIT_PALETTE.grass}" stroke="${deep}" stroke-width="1.1"/>`
      );
    case "chick":
      // 小鸡绒毛 + 橙嘴
      return (
        `<path d="M21 8 Q22 3 24 7 Q25 2 27 7 Q29 4 29 9" fill="none" stroke="${deep}" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M21.4 26.5 L26.6 26.5 L24 30 Z" fill="#f28f3d" stroke="#c26a1e" stroke-width="1"/>`
      );
    case "star":
      // 星星头冠(共享 IP 星星)
      return (
        `<path d="M24 1 L26 5.6 L31 6.2 L27.4 9.6 L28.4 14.6 L24 12.2 L19.6 14.6 L20.6 9.6 L17 6.2 L22 5.6 Z" fill="${primary}" stroke="${deep}" stroke-width="1.2"/>` +
        `<circle cx="24" cy="8" r="1.2" fill="${KIT_PALETTE.cloud}"/>`
      );
    case "flower":
      // 五瓣花饰(共享 IP 朵朵)
      return (
        `<circle cx="18" cy="6" r="3" fill="${primary}" stroke="${deep}" stroke-width="1"/>` +
        `<circle cx="23.4" cy="4.4" r="3" fill="${primary}" stroke="${deep}" stroke-width="1"/>` +
        `<circle cx="27.4" cy="8.2" r="3" fill="${primary}" stroke="${deep}" stroke-width="1"/>` +
        `<circle cx="24.4" cy="12" r="3" fill="${primary}" stroke="${deep}" stroke-width="1"/>` +
        `<circle cx="19.4" cy="11" r="3" fill="${primary}" stroke="${deep}" stroke-width="1"/>` +
        `<circle cx="22.8" cy="8.2" r="2.4" fill="${gold}"/>`
      );
    case "maple":
      // 霜叶发饰
      return (
        `<path d="M27 3 L28.6 7 L32.6 6 L30.4 9.6 L34 11.6 L29.8 12.6 L30 16 L27 13.6 L24 16 L24.2 12.6 L20 11.6 L23.6 9.6 L21.4 6 L25.4 7 Z" fill="${primary}" stroke="${deep}" stroke-width="1.1"/>` +
        `<path d="M27 6 L27 13" stroke="${deep}" stroke-width="0.9"/>`
      );
    case "dew":
      // 露珠呆毛
      return (
        `<path d="M24 12 Q22 8 24 3 Q26 8 24 12" fill="none" stroke="${deep}" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M29 3 Q32.4 7.4 29 9.4 Q25.6 7.4 29 3 Z" fill="${primary}" stroke="${deep}" stroke-width="1.1"/>` +
        `<circle cx="28" cy="6.6" r="0.9" fill="${KIT_PALETTE.cloud}"/>`
      );
    default:
      // chime:风铃发簪
      return (
        `<path d="M16 8 L32 5" stroke="${KIT_PALETTE.woodDark}" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M28 5.5 L28 9" stroke="${deep}" stroke-width="1"/>` +
        `<path d="M24.6 9 Q28 6.5 31.4 9 L30.6 13.5 Q28 15 25.4 13.5 Z" fill="${primary}" stroke="${deep}" stroke-width="1.1"/>` +
        `<circle cx="28" cy="15.5" r="1.1" fill="${gold}"/>`
      );
  }
}

/**
 * 48×48 Q 版头像:软阴影 + 小身子 + 大脸 + 头饰 + 大眼腮红。
 * 朵朵 / 星星是全家共享 IP,配色强制走 kit 的 `CHAR_COLORS`,不许跑偏。
 */
export function heroPortrait(heroId: string): string {
  const hero = heroOf(heroId);
  const shared = heroId === "duoduo" ? CHAR_COLORS.duoduo : heroId === "xingxing" ? CHAR_COLORS.xingxing : null;
  const primary = shared ? shared.primary : hero.look.primary;
  const secondary = shared ? shared.secondary : hero.look.secondary;
  const deep = shared ? shared.outline : shade(primary, 0.45);
  const isChick = hero.look.hat === "chick";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">` +
    // 椭圆落地软阴影(kit 三阶标准)
    `<ellipse cx="24" cy="45.4" rx="12" ry="2.4" fill="rgba(107,79,63,0.16)"/>` +
    // 2 头身的小身子
    `<path d="M14 45 Q14 34 24 34 Q34 34 34 45 Z" fill="${primary}" stroke="${deep}" stroke-width="1.5"/>` +
    `<path d="M20 38 Q24 40 28 38" stroke="${deep}" stroke-width="1" fill="none" opacity="0.55"/>` +
    // 大脸
    `<circle cx="24" cy="21" r="13.5" fill="${secondary}" stroke="${deep}" stroke-width="1.6"/>` +
    // 头饰(剪影特征)
    hatInner(hero.look.hat, primary, deep) +
    // 大眼 + 高光
    `<ellipse cx="19.4" cy="22" rx="2" ry="2.7" fill="${KIT_PALETTE.ink}"/>` +
    `<ellipse cx="28.6" cy="22" rx="2" ry="2.7" fill="${KIT_PALETTE.ink}"/>` +
    `<circle cx="20.1" cy="21" r="0.8" fill="#ffffff"/>` +
    `<circle cx="29.3" cy="21" r="0.8" fill="#ffffff"/>` +
    // 腮红
    `<circle cx="15.8" cy="26" r="2" fill="${KIT_PALETTE.blush}" opacity="0.7"/>` +
    `<circle cx="32.2" cy="26" r="2" fill="${KIT_PALETTE.blush}" opacity="0.7"/>` +
    // 嘴(小鸡用橙嘴,画在头饰里)
    (isChick ? "" : `<path d="M21.5 27.4 Q24 29.8 26.5 27.4" stroke="${KIT_PALETTE.ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`) +
    `</svg>`
  );
}

/** 全部会画头像的英杰 id(测试遍历用) */
export const PORTRAIT_IDS: readonly string[] = HEROES.map((h) => h.id);

// ---------------------------------------------------------------------------
// 特效小件:花瓣/星屑粒子、剑光、回血心、结算统计图标
// ---------------------------------------------------------------------------

/** 花瓣或星屑粒子(替代 🌸/✨ emoji 占位) */
export function petalBitSVG(kind: "petal" | "spark"): string {
  if (kind === "petal") {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="100%" height="100%" aria-hidden="true">` +
      `<ellipse cx="7" cy="7" rx="5.4" ry="3.4" fill="${KIT_PALETTE.candy}" stroke="#c76a8e" stroke-width="1" transform="rotate(-28 7 7)"/>` +
      `<path d="M4 8.6 Q7 7 10 5.4" stroke="#c76a8e" stroke-width="0.8" fill="none"/>` +
      `</svg>`
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="100%" height="100%" aria-hidden="true">` +
    `<path d="M7 1 L8.3 5.7 L13 7 L8.3 8.3 L7 13 L5.7 8.3 L1 7 L5.7 5.7 Z" fill="${KIT_PALETTE.starGold}" stroke="#8a6420" stroke-width="0.8"/>` +
    `</svg>`
  );
}

/** 剑光弧 + 两颗小星(受击演出,分级口径:无血液) */
export function slashArcSVG(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="100%" height="100%" aria-hidden="true">` +
    `<path d="M8 36 Q22 2 40 10" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="M8 36 Q22 2 40 10" fill="none" stroke="${KIT_PALETTE.candyDeep}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M12 12 L13 15 L16 16 L13 17 L12 20 L11 17 L8 16 L11 15 Z" fill="${KIT_PALETTE.starGold}"/>` +
    `<path d="M34 28 L34.8 30.2 L37 31 L34.8 31.8 L34 34 L33.2 31.8 L31 31 L33.2 30.2 Z" fill="${KIT_PALETTE.starGold}"/>` +
    `</svg>`
  );
}

/** 回血飘字:绿色光晕托着一颗红心 +1 */
export function healRiseSVG(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">` +
    `<circle cx="18" cy="18" r="14" fill="${KIT_PALETTE.mint}" opacity="0.45"/>` +
    `<g transform="translate(8,9) scale(1.3)"><path d="${HEART_PATH}" fill="${KIT_PALETTE.candyDeep}" stroke="${shade(KIT_PALETTE.candyDeep, 0.3)}" stroke-width="1.2"/></g>` +
    `<text x="26" y="16" font-size="11" font-weight="900" fill="${KIT_PALETTE.grassDeep}">+1</text>` +
    `</svg>`
  );
}

/** 结算统计图标:攻(交叉剑)/防(星盾)/愈(蜜桃) */
export function statIconSVG(kind: "attack" | "guard" | "heal", size = 18): string {
  const inner =
    kind === "attack" ? iconSlash() : kind === "guard" ? iconDodge() : iconHeal();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -18 36 36" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}
