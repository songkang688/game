// 朵朵抢地主 —— 纯逻辑层:54 张牌的牌型识别、牌型比较、叫分与算分。
//
// 这一层里没有一个 DOM、没有一个定时器,全是纯函数:
// 同样的入参永远得到同样的结果,所以牌型规则可以被单测钉死(见 logic.test.ts)。
// UI(index.ts)、AI(ai.ts)、对局引擎(sim.ts)都只调用这里的函数,不自己造规则。
import { mulberry32, shuffled } from "../level99";

// ---------------------------------------------------------------------------
// 一副牌:0..51 是普通牌,52 小王,53 大王
// ---------------------------------------------------------------------------

/** 花色符号,按 id % 4 排列 */
export const SUITS = ["♠", "♥", "♣", "♦"] as const;
export type SuitName = (typeof SUITS)[number];

/** 一副牌 54 张 */
export const DECK_SIZE = 54;
/** 小王的 id */
export const SMALL_JOKER = 52;
/** 大王的 id */
export const BIG_JOKER = 53;
/** 小王的点数 */
export const RANK_SMALL_JOKER = 16;
/** 大王的点数 */
export const RANK_BIG_JOKER = 17;
/** 最小点数(3) */
export const MIN_RANK = 3;
/** 顺子 / 连对 / 飞机能用到的最大点数:A(14)。2 和王都不能进顺子 */
export const MAX_CHAIN_RANK = 14;
/** 每人起手 17 张 */
export const HAND_SIZE = 17;
/** 底牌 3 张 */
export const BOTTOM_SIZE = 3;

/** 牌的点数:3..10 原样,J=11 Q=12 K=13 A=14 2=15 小王=16 大王=17 */
export function cardRank(id: number): number {
  if (id === SMALL_JOKER) return RANK_SMALL_JOKER;
  if (id === BIG_JOKER) return RANK_BIG_JOKER;
  return MIN_RANK + Math.floor(id / 4);
}

/** 是不是王 */
export function isJoker(id: number): boolean {
  return id === SMALL_JOKER || id === BIG_JOKER;
}

/** 花色;王没有花色,返回 null */
export function cardSuit(id: number): SuitName | null {
  return isJoker(id) ? null : SUITS[id % 4];
}

/** 点数的中文/数字写法 */
export function rankLabel(rank: number): string {
  if (rank === RANK_BIG_JOKER) return "大王";
  if (rank === RANK_SMALL_JOKER) return "小王";
  if (rank === 15) return "2";
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

/** 一张牌的完整写法,例如 "♠A"、"大王" */
export function cardLabel(id: number): string {
  if (isJoker(id)) return rankLabel(cardRank(id));
  return `${cardSuit(id)}${rankLabel(cardRank(id))}`;
}

/** 全新的一副牌(0..53) */
export function makeDeck(): number[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

/** 按点数从大到小排(同点数按花色固定顺序),扇形手牌就按这个顺序摆 */
export function sortDesc(ids: readonly number[]): number[] {
  return ids.slice().sort((a, b) => cardRank(b) - cardRank(a) || a - b);
}

/** 按点数从小到大排 */
export function sortAsc(ids: readonly number[]): number[] {
  return ids.slice().sort((a, b) => cardRank(a) - cardRank(b) || a - b);
}

/** 洗牌发牌:三家各 17 张 + 3 张底牌(确定性,同一个 seed 结果完全一样) */
export function dealCards(seed: number): { hands: number[][]; bottom: number[] } {
  const deck = shuffled(makeDeck(), mulberry32(seed));
  return {
    hands: [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, HAND_SIZE * 2), deck.slice(HAND_SIZE * 2, HAND_SIZE * 3)],
    bottom: deck.slice(HAND_SIZE * 3),
  };
}

// ---------------------------------------------------------------------------
// 牌型
// ---------------------------------------------------------------------------

export type PlayType =
  | "single"
  | "pair"
  | "triple"
  | "triple_single"
  | "triple_pair"
  | "straight"
  | "double_straight"
  | "plane"
  | "plane_single"
  | "plane_pair"
  | "four_two_single"
  | "four_two_pair"
  | "bomb"
  | "rocket";

export const PLAY_NAMES: Record<PlayType, string> = {
  single: "单张",
  pair: "对子",
  triple: "三张",
  triple_single: "三带一",
  triple_pair: "三带一对",
  straight: "顺子",
  double_straight: "连对",
  plane: "飞机",
  plane_single: "飞机带单",
  plane_pair: "飞机带对",
  four_two_single: "四带二",
  four_two_pair: "四带两对",
  bomb: "炸弹",
  rocket: "王炸",
};

export interface Play {
  type: PlayType;
  /** 主牌点数:比大小只看它(顺子看最大的那张) */
  main: number;
  /** 链长:顺子看张数,连对看对数,飞机看三张的组数,其余一律 1 */
  len: number;
  /** 这一手用掉的牌(升序) */
  cards: number[];
}

interface CountEntry {
  rank: number;
  count: number;
}

/** 按点数统计张数,升序返回 */
export function rankEntries(ids: readonly number[]): CountEntry[] {
  const m = new Map<number, number>();
  for (const id of ids) {
    const r = cardRank(id);
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return [...m.entries()].map(([rank, count]) => ({ rank, count })).sort((a, b) => a.rank - b.rank);
}

/** 点数数组是不是一段连续的(3,4,5…) */
function isRun(ranks: readonly number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** 飞机识别:找出「连续的三张」窗口,再看剩下的牌能不能当翅膀 */
function tryPlane(entries: CountEntry[], n: number): Omit<Play, "cards"> | null {
  const bodyRanks = entries
    .filter((e) => e.count >= 3 && e.rank <= MAX_CHAIN_RANK)
    .map((e) => e.rank)
    .sort((a, b) => a - b);
  if (bodyRanks.length < 2) return null;

  // 先切成极长连续段,再在段里滑窗;长窗口优先,避免把「纯飞机」误判成「飞机带翅膀」
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const r of bodyRanks) {
    if (cur.length === 0 || r === cur[cur.length - 1] + 1) cur.push(r);
    else {
      runs.push(cur);
      cur = [r];
    }
  }
  if (cur.length) runs.push(cur);

  const windows: number[][] = [];
  for (const run of runs) {
    for (let len = run.length; len >= 2; len--) {
      for (let s = 0; s + len <= run.length; s++) windows.push(run.slice(s, s + len));
    }
  }
  windows.sort((a, b) => b.length - a.length);

  for (const w of windows) {
    const k = w.length;
    const body = new Set(w);
    const rest = new Map<number, number>();
    for (const e of entries) {
      const left = e.count - (body.has(e.rank) ? 3 : 0);
      if (left > 0) rest.set(e.rank, left);
    }
    let restTotal = 0;
    for (const v of rest.values()) restTotal += v;
    const main = w[w.length - 1];

    if (n === 3 * k && restTotal === 0) return { type: "plane", main, len: k };
    // 带 k 张单牌:翅膀是什么牌都行(带成一对也算两张单牌,规则里允许)
    if (n === 4 * k && restTotal === k) return { type: "plane_single", main, len: k };
    if (n === 5 * k && restTotal === 2 * k) {
      const allPairs = rest.size === k && [...rest.values()].every((v) => v === 2);
      if (allPairs) return { type: "plane_pair", main, len: k };
    }
  }
  return null;
}

/**
 * 识别一手牌;不是合法牌型就返回 null。
 * 传进来的 id 有重复也算不合法(防止 UI 把同一张牌算两次)。
 */
export function parsePlay(cards: readonly number[]): Play | null {
  const n = cards.length;
  if (n === 0) return null;
  const ids = cards.slice().sort((a, b) => a - b);
  for (let i = 1; i < n; i++) {
    if (ids[i] === ids[i - 1]) return null;
    if (!Number.isInteger(ids[i]) || ids[i] < 0 || ids[i] >= DECK_SIZE) return null;
  }
  if (!Number.isInteger(ids[0]) || ids[0] < 0 || ids[0] >= DECK_SIZE) return null;

  const entries = rankEntries(ids);
  const done = (p: Omit<Play, "cards">): Play => ({ ...p, cards: ids });

  // 王炸最大,先认它
  if (n === 2 && ids[0] === SMALL_JOKER && ids[1] === BIG_JOKER) {
    return done({ type: "rocket", main: RANK_BIG_JOKER, len: 1 });
  }
  if (n === 4 && entries.length === 1) {
    return done({ type: "bomb", main: entries[0].rank, len: 1 });
  }
  if (n === 1) return done({ type: "single", main: entries[0].rank, len: 1 });
  if (n === 2 && entries.length === 1) return done({ type: "pair", main: entries[0].rank, len: 1 });
  if (n === 3 && entries.length === 1) return done({ type: "triple", main: entries[0].rank, len: 1 });

  const triples = entries.filter((e) => e.count === 3);
  const fours = entries.filter((e) => e.count === 4);

  if (n === 4 && triples.length === 1 && entries.length === 2) {
    return done({ type: "triple_single", main: triples[0].rank, len: 1 });
  }
  if (n === 5 && triples.length === 1 && entries.length === 2 && entries.some((e) => e.count === 2)) {
    return done({ type: "triple_pair", main: triples[0].rank, len: 1 });
  }

  const ranks = entries.map((e) => e.rank);
  const maxRank = ranks[ranks.length - 1];

  // 顺子:5 张起,全是单牌,连着,最大到 A
  if (n >= 5 && entries.every((e) => e.count === 1) && maxRank <= MAX_CHAIN_RANK && isRun(ranks)) {
    return done({ type: "straight", main: maxRank, len: n });
  }
  // 连对:3 对起
  if (n >= 6 && n % 2 === 0 && entries.every((e) => e.count === 2) && maxRank <= MAX_CHAIN_RANK && isRun(ranks)) {
    return done({ type: "double_straight", main: maxRank, len: n / 2 });
  }

  const plane = tryPlane(entries, n);
  if (plane) return done(plane);

  // 四带二:四张 + 两张单牌(不许拿王炸来当那两张)
  if (n === 6 && fours.length === 1) {
    const restIds = ids.filter((id) => cardRank(id) !== fours[0].rank);
    if (restIds.length === 2 && !(restIds[0] === SMALL_JOKER && restIds[1] === BIG_JOKER)) {
      return done({ type: "four_two_single", main: fours[0].rank, len: 1 });
    }
  }
  // 四带两对
  if (n === 8 && fours.length === 1) {
    const rest = entries.filter((e) => e.rank !== fours[0].rank);
    if (rest.length === 2 && rest.every((e) => e.count === 2)) {
      return done({ type: "four_two_pair", main: fours[0].rank, len: 1 });
    }
  }

  return null;
}

/** 这一手能不能压过上一手(prev 为 null 表示自己是先手,随便出) */
export function beats(play: Play, prev: Play | null): boolean {
  if (!prev) return true;
  if (play.type === "rocket") return prev.type !== "rocket";
  if (prev.type === "rocket") return false;
  if (play.type === "bomb") return prev.type === "bomb" ? play.main > prev.main : true;
  if (prev.type === "bomb") return false;
  return play.type === prev.type && play.len === prev.len && play.main > prev.main;
}

/** 炸弹和王炸都算「炸」,要翻倍 */
export function isBombLike(play: Play): boolean {
  return play.type === "bomb" || play.type === "rocket";
}

/** 一手牌的中文说法,例如「顺子 3-7」「炸弹 K」 */
export function describePlay(play: Play): string {
  const name = PLAY_NAMES[play.type];
  if (play.type === "rocket") return name;
  if (play.type === "straight") return `${name} ${rankLabel(play.main - play.len + 1)}-${rankLabel(play.main)}`;
  if (play.type === "double_straight" || play.type.startsWith("plane")) {
    return `${name} ${rankLabel(play.main - play.len + 1)}-${rankLabel(play.main)}`;
  }
  return `${name} ${rankLabel(play.main)}`;
}

/**
 * 出牌被拒时给一句温和的话(绝不说「错」「不行」这种词)。
 * 纯函数,方便单测把每种情况的口气都钉住。
 */
export function gentleHint(cards: readonly number[], prev: Play | null): string {
  if (cards.length === 0) return "先挑几张牌吧,点一下牌它就会跳起来～";
  const play = parsePlay(cards);
  if (!play) return "这几张凑不成牌型呢,试试单张、对子,或者连着的顺子～";
  if (!prev) return "这手可以出啦!";
  if (prev.type === "rocket") return "王炸最大啦,这一轮谁都压不住,先过一手吧～";
  if (play.type === prev.type && play.len === prev.len && play.main <= prev.main) {
    return `一样是${PLAY_NAMES[play.type]},可惜小了一点点,换张大的试试～`;
  }
  if (prev.type === "bomb" && play.type !== "bomb") return "上家是炸弹,得用更大的炸弹或者王炸才行哦～";
  return `上家出的是${describePlay(prev)},要用同样的${PLAY_NAMES[prev.type]}才压得住～`;
}

// ---------------------------------------------------------------------------
// 叫分
// ---------------------------------------------------------------------------

/**
 * 手牌强度打分(0..100,越大越想当地主):
 * 大牌、炸弹、王都加分,散张多了减分。给 AI 叫分和关卡难度校准共用。
 */
export function handStrength(hand: readonly number[]): number {
  const entries = rankEntries(hand);
  let score = 0;
  for (const e of entries) {
    if (e.rank === RANK_BIG_JOKER) score += 14;
    else if (e.rank === RANK_SMALL_JOKER) score += 10;
    else if (e.rank === 15) score += 5 * e.count;
    else if (e.rank === 14) score += 3 * e.count;
    else if (e.rank === 13) score += 2 * e.count;
    if (e.count === 4) score += 12;
  }
  if (hand.includes(SMALL_JOKER) && hand.includes(BIG_JOKER)) score += 10;
  const singles = entries.filter((e) => e.count === 1 && e.rank <= 12).length;
  score -= Math.max(0, singles - 4) * 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** 按手牌强度给出想叫的分(0=不叫);current 是场上已经叫到的分 */
export function suggestBid(hand: readonly number[], current: number): 0 | 1 | 2 | 3 {
  const s = handStrength(hand);
  const want: 0 | 1 | 2 | 3 = s >= 34 ? 3 : s >= 24 ? 2 : s >= 15 ? 1 : 0;
  return want > current ? want : 0;
}

// ---------------------------------------------------------------------------
// 春天与算分
// ---------------------------------------------------------------------------

export interface SpringState {
  /** 春天:地主赢了,而且两个农民一张牌都没出过 */
  spring: boolean;
  /** 反春天:农民赢了,而且地主只出过第一手 */
  antiSpring: boolean;
}

/**
 * 判断春天 / 反春天。
 * farmerPlays 是两个农民出牌次数之和,landlordPlays 是地主出牌次数。
 */
export function springState(landlordWon: boolean, farmerPlays: number, landlordPlays: number): SpringState {
  return {
    spring: landlordWon && farmerPlays === 0,
    antiSpring: !landlordWon && landlordPlays <= 1,
  };
}

export interface SettleInput {
  landlordWon: boolean;
  /** 叫的分(1..3) */
  base: number;
  /** 本局出过的炸弹 + 王炸总数 */
  bombs: number;
  spring: boolean;
  antiSpring: boolean;
}

export interface SettleResult extends SettleInput {
  /** 总倍数:每个炸翻一倍,春天/反春天再翻一倍 */
  multiplier: number;
  /** 地主这一局的输赢分(正数是地主赢) */
  score: number;
}

/** 结算:底分 × 倍数,地主赢是正、输是负 */
export function settleScore(input: SettleInput): SettleResult {
  const bombs = Math.max(0, Math.round(input.bombs));
  const base = Math.max(1, Math.min(3, Math.round(input.base)));
  const multiplier = 2 ** bombs * (input.spring || input.antiSpring ? 2 : 1);
  const score = base * multiplier * (input.landlordWon ? 1 : -1);
  return { ...input, base, bombs, multiplier, score };
}

/** 结算面板上那句「底分 2 × 炸弹 2 倍 × 春天 2 倍 = 8 分」 */
export function multiplierLine(res: SettleResult): string {
  const parts = [`底分 ${res.base}`];
  if (res.bombs > 0) parts.push(`${res.bombs} 个炸 ×${2 ** res.bombs}`);
  if (res.spring) parts.push("春天 ×2");
  if (res.antiSpring) parts.push("反春天 ×2");
  return `${parts.join(" · ")} = ${Math.abs(res.score)} 分`;
}
