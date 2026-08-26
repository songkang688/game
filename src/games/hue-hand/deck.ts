/**
 * 花色接龙 · 牌堆模型。
 *
 * 一副 108 张:
 *  - 4 种颜色 × 数字 0–9,0 每色 1 张、1–9 每色 2 张 —— 4 + 72 = 76 张;
 *  - 每色功能牌各 2 张:跳过 / 反转 / 加二 —— 4 × 3 × 2 = 24 张;
 *  - 万能换色 4 张 + 万能加四 4 张 —— 8 张。
 *
 * 这一层只描述「牌是什么」,不掺任何出牌规则,规则全在 rules.ts。
 */

/** 四种粉彩颜色。id 用英文,给孩子看的名字在 COLOR_NAMES 里 */
export type Color = "pink" | "lemon" | "mint" | "sky";

export const COLORS: readonly Color[] = ["pink", "lemon", "mint", "sky"];

/** 色盲友好:颜色一律配一个中文名,色条上直接写「现在是粉色」 */
export const COLOR_NAMES: Record<Color, string> = {
  pink: "粉色",
  lemon: "黄色",
  mint: "绿色",
  sky: "蓝色",
};

/** 牌面主色(粉彩) */
export const COLOR_HEX: Record<Color, string> = {
  pink: "#F58FBB",
  lemon: "#EFB33F",
  mint: "#54B584",
  sky: "#5A9BE0",
};

/** 牌面浅底色 */
export const COLOR_SOFT: Record<Color, string> = {
  pink: "#FFE1EE",
  lemon: "#FFF0CC",
  mint: "#D9F2E4",
  sky: "#DCEBFF",
};

/** 牌型:数字 / 跳过 / 反转 / 加二 / 万能换色 / 万能加四 */
export type CardKind = "num" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

/** 加牌类的两种牌型(两条链分开叠) */
export type DrawKind = "draw2" | "wild4";

export interface Card {
  /** 全局唯一编号,同一副牌里不重复 */
  id: number;
  kind: CardKind;
  /** 万能牌没有固定颜色 */
  color: Color | null;
  /** 只有数字牌有 */
  num: number | null;
}

/** 功能牌的图形符号(原创写法,不照抄任何商业牌面) */
export const KIND_SYMBOL: Record<CardKind, string> = {
  num: "",
  skip: "⃠",
  reverse: "⇅",
  draw2: "+2",
  wild: "◈",
  wild4: "+4",
};

/** 功能牌的中文名,读屏与提示语共用 */
export const KIND_NAMES: Record<CardKind, string> = {
  num: "数字",
  skip: "跳过",
  reverse: "反转",
  draw2: "加二",
  wild: "万能换色",
  wild4: "万能加四",
};

/** 计分权重:数字按面值,功能牌 20,万能牌 50 */
export function cardScore(card: Card): number {
  if (card.kind === "num") return card.num ?? 0;
  if (card.kind === "wild" || card.kind === "wild4") return 50;
  return 20;
}

export function isWild(card: Card): boolean {
  return card.kind === "wild" || card.kind === "wild4";
}

/** 是不是加牌链能用的牌 */
export function isDrawCard(card: Card): card is Card & { kind: DrawKind } {
  return card.kind === "draw2" || card.kind === "wild4";
}

/** 一张牌的中文说法,例如「粉色 7」「蓝色跳过」「万能加四」 */
export function cardLabel(card: Card): string {
  if (card.kind === "num") return `${COLOR_NAMES[card.color as Color]} ${card.num}`;
  if (isWild(card)) return KIND_NAMES[card.kind];
  return `${COLOR_NAMES[card.color as Color]}${KIND_NAMES[card.kind]}`;
}

/** 牌面上印的那个字符 */
export function cardFace(card: Card): string {
  return card.kind === "num" ? String(card.num) : KIND_SYMBOL[card.kind];
}

/**
 * 造一副全新的 108 张。顺序是固定的(颜色 → 数字 → 功能 → 万能),
 * 要打乱请自己走 shuffle();这样单测能稳定地数各类张数。
 */
export function buildDeck(): Card[] {
  const out: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    out.push({ id: id++, kind: "num", color, num: 0 });
    for (let n = 1; n <= 9; n++) {
      out.push({ id: id++, kind: "num", color, num: n });
      out.push({ id: id++, kind: "num", color, num: n });
    }
  }
  for (const color of COLORS) {
    for (const kind of ["skip", "reverse", "draw2"] as const) {
      out.push({ id: id++, kind, color, num: null });
      out.push({ id: id++, kind, color, num: null });
    }
  }
  for (let i = 0; i < 4; i++) out.push({ id: id++, kind: "wild", color: null, num: null });
  for (let i = 0; i < 4; i++) out.push({ id: id++, kind: "wild4", color: null, num: null });
  return out;
}

/** 一副牌里各类牌的张数,单测拿它对账 */
export function deckCensus(deck: readonly Card[]): Record<string, number> {
  const out: Record<string, number> = { total: deck.length };
  for (const card of deck) {
    out[card.kind] = (out[card.kind] ?? 0) + 1;
    if (card.color) out[card.color] = (out[card.color] ?? 0) + 1;
    if (card.kind === "num") out[`num${card.num}`] = (out[`num${card.num}`] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 确定性随机:同一个种子永远洗出同一副牌,关卡与单测才可复现
// ---------------------------------------------------------------------------

/** 一步 mulberry32:传入种子,回「随机数 + 下一个种子」 */
export function nextRandom(seed: number): { value: number; seed: number } {
  let a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  a = a >>> 0;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: a };
}

/** 洗牌:纯函数,回新数组与新种子 */
export function shuffle(cards: readonly Card[], seed: number): { cards: Card[]; seed: number } {
  const out = cards.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { cards: out, seed: s };
}

/** 洗好的一副 108 张 */
export function shuffledDeck(seed: number): { cards: Card[]; seed: number } {
  return shuffle(buildDeck(), seed);
}

/** 按 id 从一副牌里挑牌(关卡表里用 id 描述手牌) */
export function cardsByIds(ids: readonly number[], from: readonly Card[] = buildDeck()): Card[] {
  const map = new Map(from.map((c) => [c.id, c]));
  const out: Card[] = [];
  for (const id of ids) {
    const card = map.get(id);
    if (card) out.push({ ...card });
  }
  return out;
}
