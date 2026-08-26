// 朵朵抢地主 —— 电脑对手(三档)与「出牌提示」的候选生成。
//
// 全是纯函数:给同样的手牌与同样的随机数发生器,永远给出同样的选择,
// 所以 sim.test.ts 才能用固定 seed 跑 200 局自对弈,把「困难比简单强」钉成一条测试。
//
// 三档的差距不是靠改数值,是靠「想不想得到」:
//  - 简单:永远先甩最小的单张,跟牌只会挑刚好压住的那一手,农民之间还互相压;
//  - 普通:会先走顺子连对,农民之间基本不互压,对手快走完了会拦;
//  - 困难:每一手都算「打完之后我还剩几手牌」,尽量不拆对子不拆顺子,
//         农民之间配合,地主只剩一两张时全力拦截,能一把走完就直接走完。
import {
  BIG_JOKER,
  MAX_CHAIN_RANK,
  MIN_RANK,
  RANK_BIG_JOKER,
  RANK_SMALL_JOKER,
  SMALL_JOKER,
  cardRank,
  parsePlay,
  type Play,
} from "./logic";

export type AiLevel = "easy" | "normal" | "hard";

export const AI_LEVEL_NAMES: Record<AiLevel, string> = {
  easy: "轻松",
  normal: "认真",
  hard: "厉害",
};

export const AI_LEVEL_ORDER: AiLevel[] = ["easy", "normal", "hard"];

/** 决策要用到的桌面信息 */
export interface AiContext {
  /** 我坐第几家(0/1/2) */
  seat: number;
  /** 地主坐第几家 */
  landlord: number;
  hand: number[];
  /** 需要压过的那一手;null 表示这一轮我先手,随便出 */
  prev: Play | null;
  /** 上一手是谁出的(prev 为 null 时无意义) */
  prevSeat: number;
  /** 三家各自剩几张牌 */
  counts: number[];
  rand: () => number;
}

// ---------------------------------------------------------------------------
// 手牌整理
// ---------------------------------------------------------------------------

interface HandInfo {
  /** byRank[点数] = 该点数的牌 id(升序) */
  byRank: number[][];
  /** counts[点数] = 张数 */
  counts: number[];
}

const TOP_RANK = RANK_BIG_JOKER;

export function handInfo(hand: readonly number[]): HandInfo {
  const byRank: number[][] = Array.from({ length: TOP_RANK + 1 }, () => []);
  for (const id of hand) byRank[cardRank(id)].push(id);
  for (const list of byRank) list.sort((a, b) => a - b);
  return { byRank, counts: byRank.map((l) => l.length) };
}

/** 从某个点数里取 k 张(取 id 最小的那几张,保证确定性) */
function take(info: HandInfo, rank: number, k: number): number[] {
  return info.byRank[rank].slice(0, k);
}

// ---------------------------------------------------------------------------
// 手牌拆解:这副牌大概要几手才能走完
// ---------------------------------------------------------------------------

function countsOf(hand: readonly number[]): number[] {
  const c = new Array<number>(TOP_RANK + 1).fill(0);
  for (const id of hand) c[cardRank(id)]++;
  return c;
}

/** 反复抽走「最长的一条链」;need 是每档至少要几张(顺子 1、连对 2、飞机 3) */
function stripChains(counts: number[], need: number, minLen: number, maxLen: number): number {
  let groups = 0;
  for (;;) {
    let hit = false;
    for (let len = maxLen; len >= minLen && !hit; len--) {
      for (let s = MIN_RANK; s + len - 1 <= MAX_CHAIN_RANK; s++) {
        let ok = true;
        for (let r = s; r < s + len; r++) {
          if (counts[r] < need) {
            ok = false;
            break;
          }
        }
        if (ok) {
          for (let r = s; r < s + len; r++) counts[r] -= need;
          groups++;
          hit = true;
          break;
        }
      }
    }
    if (!hit) return groups;
  }
}

function greedySplit(counts: number[], straightFirst: boolean): number {
  let groups = 0;
  if (counts[RANK_SMALL_JOKER] > 0 && counts[RANK_BIG_JOKER] > 0) {
    groups++;
    counts[RANK_SMALL_JOKER] = 0;
    counts[RANK_BIG_JOKER] = 0;
  }
  for (let r = MIN_RANK; r <= 15; r++) {
    if (counts[r] === 4) {
      groups++;
      counts[r] = 0;
    }
  }
  groups += stripChains(counts, 3, 2, 6); // 飞机
  if (straightFirst) {
    groups += stripChains(counts, 1, 5, 12);
    groups += stripChains(counts, 2, 3, 10);
  } else {
    groups += stripChains(counts, 2, 3, 10);
    groups += stripChains(counts, 1, 5, 12);
  }

  let triples = 0;
  for (let r = MIN_RANK; r <= TOP_RANK; r++) {
    if (counts[r] >= 3) {
      triples++;
      counts[r] -= 3;
    }
  }
  let pairs = 0;
  let singles = 0;
  for (let r = MIN_RANK; r <= TOP_RANK; r++) {
    if (counts[r] === 2) pairs++;
    else if (counts[r] === 1) singles++;
  }
  // 三张顺手带一个单张或一对,不用多花一手
  const absorbSingle = Math.min(triples, singles);
  singles -= absorbSingle;
  const absorbPair = Math.min(triples - absorbSingle, pairs);
  pairs -= absorbPair;

  return groups + triples + pairs + singles;
}

/** 这副手牌大概还要出几手才能走完(越小越好) */
export function splitCount(hand: readonly number[]): number {
  if (hand.length === 0) return 0;
  return Math.min(greedySplit(countsOf(hand), true), greedySplit(countsOf(hand), false));
}

/** 手上「能拿回出牌权」的大牌分:2、王、炸弹越多越安心 */
export function controlScore(hand: readonly number[]): number {
  const counts = countsOf(hand);
  let s = 0;
  if (counts[RANK_BIG_JOKER] > 0) s += 4;
  if (counts[RANK_SMALL_JOKER] > 0) s += 3;
  s += counts[15] * 2;
  s += counts[14];
  for (let r = MIN_RANK; r <= 15; r++) if (counts[r] === 4) s += 5;
  if (counts[RANK_SMALL_JOKER] > 0 && counts[RANK_BIG_JOKER] > 0) s += 4;
  return s;
}

/** 手牌好坏(越小越好):手数是主要矛盾,大牌是次要加分 */
export function evalHand(hand: readonly number[]): number {
  if (hand.length === 0) return -1000;
  return splitCount(hand) * 10 - controlScore(hand);
}

// ---------------------------------------------------------------------------
// 候选牌型生成
// ---------------------------------------------------------------------------

function pushPlay(out: Play[], cards: number[]): void {
  if (cards.length === 0) return;
  const p = parsePlay(cards);
  if (p) out.push(p);
}

/** 从手里挑 k 张「最不心疼」的单张当翅膀(避开 exclude 里的点数和大牌) */
function pickWings(info: HandInfo, exclude: Set<number>, k: number, size: 1 | 2): number[] | null {
  const wings: number[] = [];
  for (let r = MIN_RANK; r <= TOP_RANK && wings.length < k * size; r++) {
    if (exclude.has(r)) continue;
    if (size === 1) {
      if (info.counts[r] >= 1 && info.counts[r] !== 2 && info.counts[r] !== 3) wings.push(...take(info, r, 1));
    } else if (info.counts[r] === 2) {
      wings.push(...take(info, r, 2));
    }
  }
  if (wings.length < k * size) {
    // 挑不够就放宽:允许拆对子 / 拆三张
    for (let r = MIN_RANK; r <= TOP_RANK && wings.length < k * size; r++) {
      if (exclude.has(r)) continue;
      const have = info.counts[r];
      const already = wings.filter((id) => cardRank(id) === r).length;
      if (size === 1 && have - already >= 1) wings.push(...info.byRank[r].slice(already, already + 1));
      else if (size === 2 && have - already >= 2) wings.push(...info.byRank[r].slice(already, already + 2));
    }
  }
  return wings.length === k * size ? wings : null;
}

/** 本轮我先手,能出的所有像样的牌型 */
export function leadCandidates(hand: readonly number[]): Play[] {
  const info = handInfo(hand);
  const out: Play[] = [];
  const { counts } = info;

  for (let r = MIN_RANK; r <= TOP_RANK; r++) {
    if (counts[r] >= 1) pushPlay(out, take(info, r, 1));
    if (counts[r] >= 2) pushPlay(out, take(info, r, 2));
    if (counts[r] >= 3) {
      pushPlay(out, take(info, r, 3));
      const w1 = pickWings(info, new Set([r]), 1, 1);
      if (w1) pushPlay(out, [...take(info, r, 3), ...w1]);
      const w2 = pickWings(info, new Set([r]), 1, 2);
      if (w2) pushPlay(out, [...take(info, r, 3), ...w2]);
    }
    if (counts[r] === 4) {
      pushPlay(out, take(info, r, 4));
      const s2 = pickWings(info, new Set([r]), 2, 1);
      if (s2) pushPlay(out, [...take(info, r, 4), ...s2]);
      const p2 = pickWings(info, new Set([r]), 2, 2);
      if (p2) pushPlay(out, [...take(info, r, 4), ...p2]);
    }
  }
  if (counts[RANK_SMALL_JOKER] > 0 && counts[RANK_BIG_JOKER] > 0) pushPlay(out, [SMALL_JOKER, BIG_JOKER]);

  // 顺子 / 连对 / 飞机(含翅膀)
  for (let len = 5; len <= 12; len++) {
    for (let s = MIN_RANK; s + len - 1 <= MAX_CHAIN_RANK; s++) {
      let ok = true;
      const cards: number[] = [];
      for (let r = s; r < s + len; r++) {
        if (counts[r] < 1) {
          ok = false;
          break;
        }
        cards.push(...take(info, r, 1));
      }
      if (ok) pushPlay(out, cards);
    }
  }
  for (let len = 3; len <= 10; len++) {
    for (let s = MIN_RANK; s + len - 1 <= MAX_CHAIN_RANK; s++) {
      let ok = true;
      const cards: number[] = [];
      for (let r = s; r < s + len; r++) {
        if (counts[r] < 2) {
          ok = false;
          break;
        }
        cards.push(...take(info, r, 2));
      }
      if (ok) pushPlay(out, cards);
    }
  }
  for (let len = 2; len <= 6; len++) {
    for (let s = MIN_RANK; s + len - 1 <= MAX_CHAIN_RANK; s++) {
      let ok = true;
      const body: number[] = [];
      const bodyRanks = new Set<number>();
      for (let r = s; r < s + len; r++) {
        if (counts[r] < 3) {
          ok = false;
          break;
        }
        body.push(...take(info, r, 3));
        bodyRanks.add(r);
      }
      if (!ok) continue;
      pushPlay(out, body);
      const w1 = pickWings(info, bodyRanks, len, 1);
      if (w1) pushPlay(out, [...body, ...w1]);
      const w2 = pickWings(info, bodyRanks, len, 2);
      if (w2) pushPlay(out, [...body, ...w2]);
    }
  }
  return out;
}

/** 能压过 prev 的所有牌型(包含炸弹与王炸) */
export function beatCandidates(hand: readonly number[], prev: Play): Play[] {
  const info = handInfo(hand);
  const { counts } = info;
  const out: Play[] = [];

  const addBombs = (): void => {
    for (let r = MIN_RANK; r <= 15; r++) {
      if (counts[r] === 4 && (prev.type !== "bomb" || r > prev.main)) pushPlay(out, take(info, r, 4));
    }
    if (counts[RANK_SMALL_JOKER] > 0 && counts[RANK_BIG_JOKER] > 0) pushPlay(out, [SMALL_JOKER, BIG_JOKER]);
  };

  if (prev.type === "rocket") return out;
  if (prev.type === "bomb") {
    addBombs();
    return out;
  }

  const hi = prev.main;
  switch (prev.type) {
    case "single":
      for (let r = hi + 1; r <= TOP_RANK; r++) if (counts[r] >= 1) pushPlay(out, take(info, r, 1));
      break;
    case "pair":
      for (let r = hi + 1; r <= 15; r++) if (counts[r] >= 2) pushPlay(out, take(info, r, 2));
      break;
    case "triple":
      for (let r = hi + 1; r <= 15; r++) if (counts[r] >= 3) pushPlay(out, take(info, r, 3));
      break;
    case "triple_single":
      for (let r = hi + 1; r <= 15; r++) {
        if (counts[r] < 3) continue;
        const w = pickWings(info, new Set([r]), 1, 1);
        if (w) pushPlay(out, [...take(info, r, 3), ...w]);
      }
      break;
    case "triple_pair":
      for (let r = hi + 1; r <= 15; r++) {
        if (counts[r] < 3) continue;
        const w = pickWings(info, new Set([r]), 1, 2);
        if (w) pushPlay(out, [...take(info, r, 3), ...w]);
      }
      break;
    case "straight":
      for (let s = MIN_RANK; s + prev.len - 1 <= MAX_CHAIN_RANK; s++) {
        if (s + prev.len - 1 <= hi) continue;
        const cards: number[] = [];
        let ok = true;
        for (let r = s; r < s + prev.len; r++) {
          if (counts[r] < 1) {
            ok = false;
            break;
          }
          cards.push(...take(info, r, 1));
        }
        if (ok) pushPlay(out, cards);
      }
      break;
    case "double_straight":
      for (let s = MIN_RANK; s + prev.len - 1 <= MAX_CHAIN_RANK; s++) {
        if (s + prev.len - 1 <= hi) continue;
        const cards: number[] = [];
        let ok = true;
        for (let r = s; r < s + prev.len; r++) {
          if (counts[r] < 2) {
            ok = false;
            break;
          }
          cards.push(...take(info, r, 2));
        }
        if (ok) pushPlay(out, cards);
      }
      break;
    case "plane":
    case "plane_single":
    case "plane_pair":
      for (let s = MIN_RANK; s + prev.len - 1 <= MAX_CHAIN_RANK; s++) {
        if (s + prev.len - 1 <= hi) continue;
        const body: number[] = [];
        const bodyRanks = new Set<number>();
        let ok = true;
        for (let r = s; r < s + prev.len; r++) {
          if (counts[r] < 3) {
            ok = false;
            break;
          }
          body.push(...take(info, r, 3));
          bodyRanks.add(r);
        }
        if (!ok) continue;
        if (prev.type === "plane") pushPlay(out, body);
        else {
          const size = prev.type === "plane_single" ? 1 : 2;
          const w = pickWings(info, bodyRanks, prev.len, size);
          if (w) pushPlay(out, [...body, ...w]);
        }
      }
      break;
    case "four_two_single":
    case "four_two_pair":
      for (let r = hi + 1; r <= 15; r++) {
        if (counts[r] !== 4) continue;
        const size = prev.type === "four_two_single" ? 1 : 2;
        const w = pickWings(info, new Set([r]), 2, size);
        if (w) pushPlay(out, [...take(info, r, 4), ...w]);
      }
      break;
    default:
      break;
  }
  addBombs();
  return out;
}

/**
 * 「提示」按钮用的候选:先手给整理过的牌型,跟牌给能压住的牌型;
 * 一律按「小的、拆得少的排前面」,小朋友照着点就不会一上来甩大牌。
 */
export function hintPlays(hand: readonly number[], prev: Play | null): Play[] {
  const list = prev ? beatCandidates(hand, prev) : leadCandidates(hand);
  const seen = new Set<string>();
  const uniq: Play[] = [];
  for (const p of list) {
    const key = p.cards.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(p);
  }
  const bombRank = (p: Play): number => (p.type === "rocket" ? 2 : p.type === "bomb" ? 1 : 0);
  uniq.sort(
    (a, b) =>
      bombRank(a) - bombRank(b) ||
      a.main - b.main ||
      b.cards.length - a.cards.length ||
      a.cards[0] - b.cards[0]
  );
  return uniq;
}

// ---------------------------------------------------------------------------
// 三档决策
// ---------------------------------------------------------------------------

/** 同阵营:两个农民是一伙的 */
export function sameTeam(a: number, b: number, landlord: number): boolean {
  return a === b || (a !== landlord && b !== landlord);
}

/**
 * 农民配合的让牌线:队友手上不多于这么多张时,困难档一律不压队友。
 * 队友一口气就能走完,抢回出牌权只会把自己的牌拖在手里。
 */
export const FARMER_YIELD_CARDS = 3;

function lowestPlay(list: Play[]): Play | null {
  if (list.length === 0) return null;
  let best = list[0];
  for (const p of list) {
    const bombA = p.type === "bomb" || p.type === "rocket" ? 1 : 0;
    const bombB = best.type === "bomb" || best.type === "rocket" ? 1 : 0;
    if (bombA < bombB || (bombA === bombB && (p.main < best.main || (p.main === best.main && p.cards.length > best.cards.length)))) {
      best = p;
    }
  }
  return best;
}

function withoutCards(hand: readonly number[], cards: readonly number[]): number[] {
  const drop = new Set(cards);
  return hand.filter((id) => !drop.has(id));
}

/** 一手牌的权重:全是自对弈量出来的,改动请重跑 sim.test.ts 的 200 局对照 */
const W = {
  /** 每多留一张牌的代价:让「一口气走 8 张」明显优于「甩一张」 */
  card: 1.6,
  /** 牌越大越舍不得出 */
  rank: 0.3,
  /** 2 和王额外舍不得:它们是抢回出牌权的本钱 */
  bigCard: 2.5,
  bomb: 26,
  rocket: 34,
  /** 对手只剩一两张时的拦截冲动 */
  urgentBomb: 40,
  urgentRocket: 50,
  urgentRank: 0.7,
  /**
   * 「不要」的门槛:负数表示困难档默认「压得住就压」。
   * 出牌权在斗地主里比省牌值钱得多,一味忍牌会被对手一路甩到底。
   */
  passMargin: -32,
  urgentPassMargin: -60,
};

/**
 * 局面分(越小越好):还要出几手是主要矛盾,牌张数是次要项。
 * 加上张数这一项,手数打平时就会先走长牌型。
 */
export function positionScore(hand: readonly number[]): number {
  if (hand.length === 0) return -10000;
  return evalHand(hand) + hand.length * W.card;
}

/** 对手(不同阵营)里剩牌最少的那家还剩几张 */
function dangerLevel(ctx: AiContext): number {
  const foes = ctx.counts.filter((_, i) => i !== ctx.seat && !sameTeam(i, ctx.seat, ctx.landlord));
  return foes.length > 0 ? Math.min(...foes) : 99;
}

/**
 * 困难档的打分:出完这手之后我的局面好不好,再加上「别乱甩大牌」的小惩罚。
 * 牌力提示(hint.ts)也用这把尺,所以「教练推荐的」就是「厉害档会打的」。
 */
export function scoreChoice(hand: readonly number[], play: Play, ctx: AiContext): number {
  const rest = withoutCards(hand, play.cards);
  if (rest.length === 0) return -10000;
  let s = positionScore(rest) + play.main * W.rank;
  if (play.type !== "bomb" && play.type !== "rocket") s += Math.max(0, play.main - 13) * W.bigCard;
  if (play.type === "bomb") s += W.bomb;
  if (play.type === "rocket") s += W.rocket;
  // 对手快走完了,炸弹与大牌就该出手
  if (dangerLevel(ctx) <= 2) {
    if (play.type === "bomb") s -= W.urgentBomb;
    if (play.type === "rocket") s -= W.urgentRocket;
    s -= play.main * W.urgentRank;
  }
  return s;
}

/** 我这一轮先手,出什么 */
function decideLead(ctx: AiContext, level: AiLevel): number[] {
  const list = leadCandidates(ctx.hand);
  if (list.length === 0) return ctx.hand.slice(0, 1);

  // 一把能走完就直接走完(三档都会)
  const finisher = list.find((p) => p.cards.length === ctx.hand.length);
  if (finisher) return finisher.cards;

  if (level === "easy") {
    // 永远先甩最小的单张,没有单张才退而求其次
    const singles = list.filter((p) => p.type === "single");
    const pick = lowestPlay(singles.length > 0 ? singles : list);
    return pick ? pick.cards : ctx.hand.slice(0, 1);
  }

  if (level === "normal") {
    // 先走长牌型(顺子/连对/飞机),再走小单张,别一上来就甩 2 和王
    const chains = list.filter(
      (p) => (p.type === "straight" || p.type === "double_straight" || p.type.startsWith("plane")) && p.main <= 13
    );
    if (chains.length > 0) {
      chains.sort((a, b) => b.cards.length - a.cards.length || a.main - b.main);
      return chains[0].cards;
    }
    const soft = list.filter((p) => p.type !== "bomb" && p.type !== "rocket" && p.main <= 14);
    const pick = lowestPlay(soft.length > 0 ? soft : list);
    return pick ? pick.cards : ctx.hand.slice(0, 1);
  }

  let best = list[0];
  let bestScore = Infinity;
  for (const p of list) {
    const s = scoreChoice(ctx.hand, p, ctx);
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best.cards;
}

/** 上家出了牌,我压还是不压 */
function decideFollow(ctx: AiContext, level: AiLevel): number[] {
  const prev = ctx.prev;
  if (!prev) return decideLead(ctx, level);
  const list = beatCandidates(ctx.hand, prev);
  if (list.length === 0) return [];

  const finisher = list.find((p) => p.cards.length === ctx.hand.length);
  if (finisher) return finisher.cards;

  const teammatePlayed = sameTeam(ctx.seat, ctx.prevSeat, ctx.landlord) && ctx.seat !== ctx.prevSeat;
  const nonBomb = list.filter((p) => p.type !== "bomb" && p.type !== "rocket");
  const danger = dangerLevel(ctx);

  if (level === "easy") {
    // 只会挑刚好压住的那一手,连队友都压;炸弹全凭手气
    if (nonBomb.length > 0) {
      const pick = lowestPlay(nonBomb);
      return pick ? pick.cards : [];
    }
    return ctx.rand() < 0.2 ? (lowestPlay(list)?.cards ?? []) : [];
  }

  if (level === "normal") {
    if (teammatePlayed && danger > 2) return [];
    if (nonBomb.length > 0) {
      const pick = lowestPlay(nonBomb);
      return pick ? pick.cards : [];
    }
    if (danger <= 2) return lowestPlay(list)?.cards ?? [];
    return ctx.rand() < 0.15 ? (lowestPlay(list)?.cards ?? []) : [];
  }

  // 困难档
  if (teammatePlayed) {
    // 队友已经压住了就别再抢,除非对手马上要走完、或者队友这手压根不牢
    const teammateCards = ctx.counts[ctx.prevSeat];
    // 队友只剩三张以内,一口气就能收尾:彻底让路,连炸弹都不抢
    if (danger > 2 && teammateCards <= FARMER_YIELD_CARDS) return [];
    if (danger > 2 && teammateCards <= ctx.hand.length) return [];
    if (danger > 3 && prev.main >= 14) return [];
  }
  const margin = danger <= 2 ? W.urgentPassMargin : W.passMargin;
  const passScore = positionScore(ctx.hand) - margin;
  let best: Play | null = null;
  let bestScore = passScore;
  for (const p of list) {
    const s = scoreChoice(ctx.hand, p, ctx);
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best ? best.cards : [];
}

/** AI 这一手出什么;返回空数组表示「不要」 */
export function chooseAiPlay(ctx: AiContext, level: AiLevel): number[] {
  if (ctx.hand.length === 0) return [];
  const cards = ctx.prev ? decideFollow(ctx, level) : decideLead(ctx, level);
  // 兜底:先手时绝不能不出牌
  if (cards.length === 0 && !ctx.prev) {
    const single = ctx.hand.slice().sort((a, b) => cardRank(a) - cardRank(b))[0];
    return [single];
  }
  return cards;
}
