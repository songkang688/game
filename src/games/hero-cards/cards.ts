/**
 * 英杰令 · 牌堆。
 *
 * 结构对齐经典身份牌局(基本牌 / 锦囊 / 装备三层),名字全部另起原创的花园星空主题:
 * 「击」叫花瓣击,「挡」叫星星盾,「愈」叫蜜桃愈。
 * 本文件只管牌本身与牌堆进出,不认识座位、身份和技能,谁都能安全 import。
 */

/** 四门花色:🌺花 / 🍒果 是红,🍃叶 / 🪨石 是黑。判定牌看红黑 */
export type Suit = "flower" | "berry" | "leaf" | "stone";

export const SUITS: readonly Suit[] = ["flower", "berry", "leaf", "stone"];

export const SUIT_LABELS: Record<Suit, string> = {
  flower: "🌺",
  berry: "🍒",
  leaf: "🍃",
  stone: "🪨"
};

export const SUIT_NAMES: Record<Suit, string> = {
  flower: "花",
  berry: "果",
  leaf: "叶",
  stone: "石"
};

/** 红门:花与果 */
export function isRed(card: Pick<Card, "suit">): boolean {
  return card.suit === "flower" || card.suit === "berry";
}

/** 黑门:叶与石 */
export function isBlack(card: Pick<Card, "suit">): boolean {
  return !isRed(card);
}

export type CardKind =
  // 基本牌
  | "slash"
  | "dodge"
  | "heal"
  // 锦囊
  | "snatch"
  | "dismantle"
  | "duel"
  | "petalStorm"
  | "starShower"
  | "playful"
  | "nullify"
  | "borrow"
  // 装备
  | "weapon"
  | "armor"
  | "horsePlus"
  | "horseMinus";

/** 三层分类,合法目标与 AI 都按这个分流 */
export type CardClass = "basic" | "trick" | "gear";

export const CARD_NAMES: Record<CardKind, string> = {
  slash: "花瓣击",
  dodge: "星星盾",
  heal: "蜜桃愈",
  snatch: "顺手摘花",
  dismantle: "拆花篮",
  duel: "对花令",
  petalStorm: "落英缤纷",
  starShower: "流星阵雨",
  playful: "贪玩令",
  nullify: "春风无懈",
  borrow: "春风借力",
  weapon: "武器",
  armor: "防具",
  horsePlus: "疾风小马",
  horseMinus: "踏云软靴"
};

export const CARD_EMOJI: Record<CardKind, string> = {
  slash: "🌸",
  dodge: "⭐",
  heal: "🍑",
  snatch: "🤲",
  dismantle: "🧺",
  duel: "🎏",
  petalStorm: "🌪️",
  starShower: "☄️",
  playful: "🪁",
  nullify: "🍃",
  borrow: "🌬️",
  weapon: "🎐",
  armor: "🧣",
  horsePlus: "🐎",
  horseMinus: "👟"
};

/** 一句话说清这张牌干什么(界面提示与攻略共用) */
export const CARD_HINTS: Record<CardKind, string> = {
  slash: "攻击范围内的一名角色掉 1 点元气,对方可以用星星盾挡下。",
  dodge: "挡下一次花瓣击。",
  heal: "回 1 点元气,只有元气没满时才用得上。",
  snatch: "拿走距离 1 以内一名角色的一张牌。",
  dismantle: "弃掉任意一名角色的一张牌,距离多远都行。",
  duel: "和一名角色轮流打出花瓣击,先接不上的那个掉 1 点元气。",
  petalStorm: "其他所有人各打一张花瓣击,打不出就掉 1 点元气。",
  starShower: "其他所有人各打一张星星盾,打不出就掉 1 点元气。",
  playful: "贴到一名角色面前。他回合开始时判定,不是红门就跳过出牌阶段。",
  nullify: "抵消一张正在结算的锦囊,也能抵消别人的春风无懈。",
  borrow: "让一名有武器的角色去对另一名角色出花瓣击,不肯就把武器给你。",
  weapon: "换上武器,攻击范围跟着变。每人只能挂一件。",
  armor: "披上防具,受到花瓣击时翻判定,红门就当挡下了。",
  horsePlus: "别人算到你的距离 +1,更难打到你。",
  horseMinus: "你算到别人的距离 -1,更容易打到别人。"
};

/** 装备型号 */
export type GearId = "flute" | "fan" | "ribbon" | "kite" | "wheel" | "cloak" | "plus" | "minus";

export type GearSlot = "weapon" | "armor" | "horsePlus" | "horseMinus";

export interface Gear {
  id: GearId;
  slot: GearSlot;
  name: string;
  emoji: string;
  /** 武器的攻击范围;非武器不填 */
  range?: number;
  /** 出「击」不受每回合一张的限制(连珠花轮) */
  unlimitedSlash?: boolean;
  desc: string;
}

export const GEARS: Record<GearId, Gear> = {
  flute: { id: "flute", slot: "weapon", name: "银铃短笛", emoji: "🎵", range: 1, desc: "范围 1,近身好用。" },
  fan: { id: "fan", slot: "weapon", name: "玉兰折扇", emoji: "🪭", range: 2, desc: "范围 2,能够到隔壁的隔壁。" },
  ribbon: { id: "ribbon", slot: "weapon", name: "长虹彩带", emoji: "🎀", range: 3, desc: "范围 3,一甩过半桌。" },
  kite: { id: "kite", slot: "weapon", name: "纸鸢长弓", emoji: "🪁", range: 4, desc: "范围 4,全桌都在射程里。" },
  wheel: {
    id: "wheel",
    slot: "weapon",
    name: "连珠花轮",
    emoji: "🎡",
    range: 1,
    unlimitedSlash: true,
    desc: "范围 1,但出花瓣击不再限一张。"
  },
  cloak: { id: "cloak", slot: "armor", name: "星纱披风", emoji: "🧣", desc: "受到花瓣击时翻判定,红门就当挡下。" },
  plus: { id: "plus", slot: "horsePlus", name: "疾风小马", emoji: "🐎", desc: "别人算到你的距离 +1。" },
  minus: { id: "minus", slot: "horseMinus", name: "踏云软靴", emoji: "👟", desc: "你算到别人的距离 -1。" }
};

export interface Card {
  /** 牌堆里唯一,洗牌回收都认这个 */
  id: number;
  kind: CardKind;
  suit: Suit;
  /** 点数 1..13,判定与部分技能会看 */
  point: number;
  /** 装备牌的具体型号 */
  gear?: GearId;
}

/** 这张牌属于三层里的哪一层 */
export function cardClass(kind: CardKind): CardClass {
  if (kind === "slash" || kind === "dodge" || kind === "heal") return "basic";
  if (kind === "weapon" || kind === "armor" || kind === "horsePlus" || kind === "horseMinus") return "gear";
  return "trick";
}

/** 延时锦囊:贴到别人面前,回合开始判定 */
export function isDelayed(kind: CardKind): boolean {
  return kind === "playful";
}

/** 牌名(装备牌报型号,别的报牌名) */
export function cardName(card: Card): string {
  if (card.gear) return GEARS[card.gear].name;
  return CARD_NAMES[card.kind];
}

export function cardEmoji(card: Card): string {
  if (card.gear) return GEARS[card.gear].emoji;
  return CARD_EMOJI[card.kind];
}

/** 「🌺花 7 · 花瓣击」这种完整标签 */
export function cardLabel(card: Card): string {
  return `${SUIT_LABELS[card.suit]}${pointLabel(card.point)} ${cardName(card)}`;
}

export function pointLabel(point: number): string {
  if (point === 1) return "A";
  if (point === 11) return "J";
  if (point === 12) return "Q";
  if (point === 13) return "K";
  return String(point);
}

/** 牌堆配方:一行就是「几张这种牌」 */
export interface DeckEntry {
  kind: CardKind;
  count: number;
  gear?: GearId;
}

/** 一整套牌的配方(约 98 张),`只带某几种牌` 的残局会在此基础上过滤 */
export const DECK_RECIPE: readonly DeckEntry[] = [
  { kind: "slash", count: 30 },
  { kind: "dodge", count: 15 },
  { kind: "heal", count: 8 },
  { kind: "snatch", count: 5 },
  { kind: "dismantle", count: 6 },
  { kind: "duel", count: 3 },
  { kind: "petalStorm", count: 3 },
  { kind: "starShower", count: 3 },
  { kind: "playful", count: 3 },
  { kind: "nullify", count: 4 },
  { kind: "borrow", count: 2 },
  { kind: "weapon", count: 1, gear: "flute" },
  { kind: "weapon", count: 2, gear: "fan" },
  { kind: "weapon", count: 2, gear: "ribbon" },
  { kind: "weapon", count: 1, gear: "kite" },
  { kind: "weapon", count: 1, gear: "wheel" },
  { kind: "armor", count: 3, gear: "cloak" },
  { kind: "horsePlus", count: 3, gear: "plus" },
  { kind: "horseMinus", count: 3, gear: "minus" }
];

/** 整套牌一共多少张 */
export function recipeTotal(recipe: readonly DeckEntry[] = DECK_RECIPE): number {
  return recipe.reduce((s, e) => s + e.count, 0);
}

let nextId = 1;

/** 单独造一张牌(残局发牌用)。id 全局自增,保证任何两张牌都能区分开 */
export function makeCard(kind: CardKind, suit: Suit = "flower", point = 7, gear?: GearId): Card {
  const card: Card = { id: nextId++, kind, suit, point };
  if (gear) card.gear = gear;
  else if (kind === "weapon") card.gear = "fan";
  else if (kind === "armor") card.gear = "cloak";
  else if (kind === "horsePlus") card.gear = "plus";
  else if (kind === "horseMinus") card.gear = "minus";
  return card;
}

/** 按配方摊平成一叠牌(还没洗),花色点数按下标铺开,保证红黑都有 */
export function buildPile(recipe: readonly DeckEntry[] = DECK_RECIPE): Card[] {
  const out: Card[] = [];
  let i = 0;
  for (const entry of recipe) {
    for (let k = 0; k < entry.count; k++) {
      const suit = SUITS[i % SUITS.length];
      const point = (i % 13) + 1;
      out.push(makeCard(entry.kind, suit, point, entry.gear));
      i++;
    }
  }
  return out;
}

/** 原地洗牌(Fisher–Yates),随机源由调用方给,固定种子就能复现一模一样的牌序 */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 洗好的一副牌 */
export function createDeck(rand: () => number, recipe: readonly DeckEntry[] = DECK_RECIPE): Card[] {
  return shuffle(buildPile(recipe), rand);
}

/** 牌堆 + 弃牌堆:摸牌、弃牌、抽空回收都走这里 */
export interface Pile {
  deck: Card[];
  discard: Card[];
  rand: () => number;
  /** 洗回过几次(测试与播报用) */
  recycles: number;
}

export function createPile(rand: () => number, recipe: readonly DeckEntry[] = DECK_RECIPE): Pile {
  return { deck: createDeck(rand, recipe), discard: [], rand, recycles: 0 };
}

/**
 * 牌堆抽空就把弃牌堆洗回来接着用。
 * 弃牌堆也空了返回 false —— 这种情况下摸牌只能摸个空,规则上不算异常。
 */
export function recycle(pile: Pile): boolean {
  if (pile.deck.length > 0) return true;
  if (pile.discard.length === 0) return false;
  pile.deck = shuffle(pile.discard, pile.rand);
  pile.discard = [];
  pile.recycles++;
  return true;
}

/** 从牌堆顶摸 n 张(不够就先洗回弃牌堆,还不够就有几张给几张) */
export function draw(pile: Pile, n: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (!recycle(pile)) break;
    const card = pile.deck.shift();
    if (!card) break;
    out.push(card);
  }
  return out;
}

/** 翻开牌堆顶一张(判定用):翻出来的牌直接进弃牌堆 */
export function flipTop(pile: Pile): Card | null {
  if (!recycle(pile)) return null;
  const card = pile.deck.shift() ?? null;
  if (card) pile.discard.push(card);
  return card;
}

/** 把牌丢进弃牌堆 */
export function discardTo(pile: Pile, cards: readonly Card[]): void {
  for (const c of cards) pile.discard.push(c);
}
