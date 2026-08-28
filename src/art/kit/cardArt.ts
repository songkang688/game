/**
 * 共享美术套件 · 纸牌牌面素材(1.3 第 22 步 A 档 `landlord-cards` 首建,归 A 档所有)。
 *
 * 全部是纯字符串 SVG 生成器,零运行时依赖、零位图:
 *  - 四枚自绘花色(红桃 / 方块暖色,黑桃 / 梅花冷色,每枚左上小高光);
 *  - 朵朵(花冠 Q 版半身)与星星(星冠 Q 版半身)原创王牌立绘——
 *    本库自己的角色,不像任何官方纸牌游戏的形象;
 *  - 四角星星屑(DOM 游戏用的 SVG 版,剪影口径与 canvas 版 `sparkle.ts` 对齐:
 *    腰身内收 28%,两头尖)。
 *
 * 同样的入参永远得到同样的字符串,所以每一笔都能被单测钉死。
 */

// ---------------------------------------------------------------------------
// 花色
// ---------------------------------------------------------------------------

export type SuitId = "heart" | "diamond" | "spade" | "club";

/** 暖色:红桃与方块 */
export const SUIT_WARM = "#E85D75";
/** 冷色:黑桃与梅花 */
export const SUIT_COOL = "#4A5A8F";

/** 花色字符 → 花色 id(王没有花色,不在这张表里) */
export const SUIT_IDS: Readonly<Record<"♥" | "♦" | "♠" | "♣", SuitId>> = {
  "♥": "heart",
  "♦": "diamond",
  "♠": "spade",
  "♣": "club",
};

/** 红桃 / 方块是暖色,黑桃 / 梅花是冷色 */
export function suitColor(suit: SuitId): string {
  return suit === "heart" || suit === "diamond" ? SUIT_WARM : SUIT_COOL;
}

/**
 * 四枚花色的剪影路径(24×24 视窗),完全自绘:
 * 桃是两瓣圆肩收尖;方是四边微鼓的菱形;黑桃是倒桃加小底座;梅花是三团加小底座。
 * 四枚两两不同,一眼分得清(单测钉死)。
 */
const SUIT_PATHS: Readonly<Record<SuitId, string>> = {
  heart:
    "M12 21C7.2 16.9 3 13.2 3 8.9 3 5.7 5.4 3.4 8.2 3.4c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C18.6 3.4 21 5.7 21 8.9c0 4.3-4.2 8-9 12.1Z",
  diamond:
    "M12 2c1.6 3.8 4.4 7.2 7.6 10-3.2 2.8-6 6.2-7.6 10-1.6-3.8-4.4-7.2-7.6-10C7.6 9.2 10.4 5.8 12 2Z",
  spade:
    "M12 2c4.8 4.6 9 8 9 12.2 0 2.9-2.2 5-4.9 5-1.1 0-2.1-.4-2.9-1 .3 1.5 1 2.9 2.3 3.8H8.5c1.3-.9 2-2.3 2.3-3.8-.8.6-1.8 1-2.9 1-2.7 0-4.9-2.1-4.9-5C3 10 7.2 6.6 12 2Z",
  club:
    "M12 2.6a4.2 4.2 0 0 1 4.2 4.2c0 .6-.1 1.2-.4 1.7a4.2 4.2 0 1 1-2.7 7.4c.3 2.1 1.1 3.8 2.4 5.1H8.5c1.3-1.3 2.1-3 2.4-5.1a4.2 4.2 0 1 1-2.7-7.4c-.3-.5-.4-1.1-.4-1.7A4.2 4.2 0 0 1 12 2.6Z",
};

export function suitPathD(suit: SuitId): string {
  return SUIT_PATHS[suit];
}

/**
 * 一枚花色 SVG:剪影 + 左上小高光点。
 * `color` 不传就按暖冷色映射;浮雕淡纹想要别的颜色可以自己传。
 */
export function suitSvg(suit: SuitId, size: number, color?: string): string {
  const fill = color ?? suitColor(suit);
  return `<svg class="ca-suit ca-suit-${suit}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATHS[suit]}" fill="${fill}"/><circle cx="8.8" cy="7.6" r="1.7" fill="#FFFFFF" opacity=".5"/></svg>`;
}

// ---------------------------------------------------------------------------
// 四角星星屑(DOM 版)
// ---------------------------------------------------------------------------

/**
 * 四角星路径:两头尖、腰身内收 28%(与 canvas 版 `sparkle.ts` 的 traceStar 同一口径)。
 * 以 (r, r) 为中心,装进 2r × 2r 的视窗。
 */
export function starPathD(r: number): string {
  const f = (v: number): string => String(Number(v.toFixed(2)));
  const c = r;
  const w = r * 0.28;
  return (
    `M${f(c)} ${f(c - r)}Q${f(c + w)} ${f(c - w)} ${f(c + r)} ${f(c)}` +
    `Q${f(c + w)} ${f(c + w)} ${f(c)} ${f(c + r)}` +
    `Q${f(c - w)} ${f(c + w)} ${f(c - r)} ${f(c)}` +
    `Q${f(c - w)} ${f(c - w)} ${f(c)} ${f(c - r)}Z`
  );
}

/** 一颗四角星 SVG(星屑环 / 装饰用) */
export function starSvg(size: number, color: string): string {
  const r = size / 2;
  return `<svg class="ca-star" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><path d="${starPathD(r)}" fill="${color}"/></svg>`;
}

// ---------------------------------------------------------------------------
// 王牌立绘:朵朵(花冠)与星星(星冠),Q 版半身,纯原创
// ---------------------------------------------------------------------------

/** 大王的金框色 */
export const JOKER_GOLD = "#F0C25A";
/** 小王的银框色 */
export const JOKER_SILVER = "#C9D3DE";

export type JokerKind = "big" | "small";

/** 五瓣小花(花冠用):五片花瓣圆点围一圈 + 花芯 */
function flowerBud(cx: number, cy: number, r: number, petal: string, core: string): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = (cx + Math.cos(a) * r).toFixed(2);
    const py = (cy + Math.sin(a) * r).toFixed(2);
    out += `<circle cx="${px}" cy="${py}" r="${(r * 0.62).toFixed(2)}" fill="${petal}"/>`;
  }
  return `${out}<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(2)}" fill="${core}"/>`;
}

/** 五角星(星冠用) */
function crownStar(cx: number, cy: number, r: number, fill: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}

/**
 * Q 版半身立绘(48×64 视窗):
 *  - `big`  → 朵朵:栗色齐刘海 + 花冠(三朵五瓣小花),粉裙;
 *  - `small`→ 星星:深发呆毛 + 星冠(三颗五角星发带),蓝衫。
 * 两张脸同一套底子(圆脸 / 腮红 / 弯眼 / 笑),靠冠子、发型与配色分身份。
 */
export function jokerArtSvg(kind: JokerKind, size = 34): string {
  const w = size;
  const h = Math.round((size * 4) / 3);
  const isBig = kind === "big";
  const hair = isBig ? "#8A5A3B" : "#4B4066";
  const dress = isBig ? "#F79BB6" : "#7E9BE0";
  const dressDeep = isBig ? "#E2648F" : "#5C79C4";
  const crown = isBig
    ? // 花冠:三朵五瓣小花横排在发际线上
      flowerBud(15, 13, 3.4, "#FF9EC7", "#FFD98A") +
      flowerBud(24, 10.6, 4, "#FFC2D9", "#F0C25A") +
      flowerBud(33, 13, 3.4, "#FF9EC7", "#FFD98A")
    : // 星冠:细发带 + 三颗五角星
      `<path d="M12 14.5Q24 8.5 36 14.5" stroke="#F0C25A" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      crownStar(15, 12.6, 3.2, "#F5D276") +
      crownStar(24, 9.4, 4.2, "#F0C25A") +
      crownStar(33, 12.6, 3.2, "#F5D276");
  const bang = isBig
    ? // 朵朵:圆润齐刘海
      `<path d="M10 22Q10 9 24 9t14 13q-4-4.5-9-4.5-2.6 0-4.6 1.4Q22 15 18.4 16 13.4 17.4 10 22Z" fill="${hair}"/>`
    : // 星星:斜刘海 + 一根呆毛
      `<path d="M10 22Q10 9 24 9t14 13q-6-5.5-13-4.5-6 .8-9.6 2.5T10 22Z" fill="${hair}"/>` +
      `<path d="M23 9q-1-4 3-6-1 3 1 5Z" fill="${hair}"/>`;
  return `<svg class="ca-joker ca-joker-${kind}" data-part="${isBig ? "flower-crown" : "star-crown"}" width="${w}" height="${h}" viewBox="0 0 48 64" aria-hidden="true">
  <path d="M12 63q0-14 12-14t12 14Z" fill="${dress}"/>
  <path d="M18 52q6 4 12 0v11h-12Z" fill="${dressDeep}" opacity=".55"/>
  <circle cx="24" cy="26" r="14.5" fill="${hair}"/>
  <circle cx="24" cy="28" r="12" fill="#FFE9D8"/>
  ${bang}
  <circle cx="14.6" cy="31" r="2.4" fill="#FFC1CC" opacity=".85"/>
  <circle cx="33.4" cy="31" r="2.4" fill="#FFC1CC" opacity=".85"/>
  <path d="M17.4 28.6q1.8-2.4 3.6 0" stroke="#4A3B55" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  <path d="M27 28.6q1.8-2.4 3.6 0" stroke="#4A3B55" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  <path d="M21.4 33.4q2.6 2.6 5.2 0" stroke="#C2557F" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  ${crown}
</svg>`;
}
