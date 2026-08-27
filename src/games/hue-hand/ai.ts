/**
 * 花色接龙 · 四个 AI 档位。
 *
 * | 档位 | 打法 |
 * | --- | --- |
 * | 新手 | 有什么出什么,从来记不住按「就一张」 |
 * | 普通 | 留着功能牌,优先出手上最多的那个颜色 |
 * | 高手 | 记别人缺什么色、会质疑加四、会看下家还剩几张 |
 * | 大师 | 会堵下家(专挑下家缺的颜色)、会卡叠加链、会点破你忘喊 |
 *
 * AI 只用公开信息:台面、各家手牌张数、谁抽过什么颜色的牌。不偷看别人的手。
 * 屏幕上的四个字是 `TIER_NAMES`,配表与存档用的一直是 `AiTier` 的 id,两者分开。
 */
import { COLORS, isDrawCard, isWild, type Card, type Color } from "./deck";
import {
  bestColor,
  chainPending,
  legalPlays,
  mustTakeChain,
  nextSeat,
  type HueState,
} from "./rules";

export type AiTier = "rookie" | "normal" | "expert" | "hell";

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "新手",
  normal: "普通",
  expert: "高手",
  hell: "大师",
};

export type AiAction =
  | { type: "play"; cardId: number; color?: Color }
  | { type: "draw" }
  | { type: "take" }
  | { type: "challenge" };

const TIER_RANK: Record<AiTier, number> = { rookie: 0, normal: 1, expert: 2, hell: 3 };

/** 这个档位记不记得按「就一张」 */
export function aiCallsOneCard(tier: AiTier): boolean {
  return TIER_RANK[tier] >= 1;
}

/** 这个档位会不会点破别人忘喊 */
export function aiCatchesOneCard(tier: AiTier): boolean {
  return TIER_RANK[tier] >= 2;
}

/** 手上这个颜色有几张 */
function colorCount(hand: readonly Card[], color: Color): number {
  let n = 0;
  for (const c of hand) if (c.color === color) n++;
  return n;
}

/**
 * 该不该质疑对手刚打的加四。只看得见的线索:
 * 他之前抽过这个颜色的牌吗(抽过说明他真的缺)、他手上还剩几张。
 */
export function aiShouldChallenge(state: HueState, tier: AiTier): boolean {
  const pending = state.pendingW4;
  if (!pending || TIER_RANK[tier] < 2) return false;
  const by = state.players[pending.by];
  if (!by) return false;
  let suspicion = 0;
  if (!by.lacks.includes(pending.prevColor)) suspicion += 1;
  if (by.hand.length >= 5) suspicion += 1;
  if (by.hand.length <= 2) suspicion -= 1;
  return tier === "hell" ? suspicion >= 1 : suspicion >= 2;
}

/** 打万能牌时换成什么颜色 */
export function aiPickColor(state: HueState, tier: AiTier, hand: readonly Card[]): Color {
  const mine = bestColor(hand, state.color);
  if (TIER_RANK[tier] < 3) return mine;
  // 大师档:先想着堵下家。下家明显缺的颜色里,挑自己也拿得出手的那一个
  const foe = state.players[nextSeat(state)];
  const blocked = COLORS.filter((c) => foe?.lacks.includes(c));
  if (blocked.length > 0) {
    let pick = blocked[0];
    for (const c of blocked) if (colorCount(hand, c) > colorCount(hand, pick)) pick = c;
    // 自己一张都没有的颜色别乱选,不然下一轮自己也接不上
    if (colorCount(hand, pick) > 0 || hand.every((c) => isWild(c))) return pick;
  }
  return mine;
}

/** 给每张能出的牌打分,分高的先出 */
function rate(state: HueState, tier: AiTier, card: Card, hand: readonly Card[]): number {
  const rank = TIER_RANK[tier];
  if (rank === 0) return 0;

  let score = 0;
  if (card.kind === "num") score += 10 + (card.color ? colorCount(hand, card.color) : 0);
  else if (isWild(card)) score += card.kind === "wild4" ? 1 : 2;
  else score += 6 + (card.color ? colorCount(hand, card.color) : 0);

  if (rank >= 2) {
    // 下家快出完了,先用功能牌拦一下
    const foe = state.players[nextSeat(state)];
    const foeLow = foe && foe.hand.length <= 2;
    if (foeLow && (card.kind === "skip" || card.kind === "draw2" || card.kind === "wild4")) score += 24;
    if (foeLow && card.kind === "reverse" && state.players.length === 2) score += 20;
    // 自己快出完了,别把万能牌浪费在还早的时候
    if (hand.length <= 2 && isWild(card)) score += 12;
  }
  if (rank >= 3) {
    const foe = state.players[nextSeat(state)];
    // 堵下家:他缺的颜色多打一点
    if (card.color && foe?.lacks.includes(card.color)) score += 9;
    // 加牌牌先攒着卡链,除非能直接把下家按住
    if (isDrawCard(card) && hand.length > 3 && !(foe && foe.hand.length <= 2)) score -= 5;
  }
  return score;
}

/**
 * 这一手 AI 怎么走。返回的动作交给 rules.ts 的函数执行。
 * 只对 state.turn 那个座位负责。
 */
export function aiPlay(state: HueState, tier: AiTier): AiAction {
  const me = state.turn;
  const hand = state.players[me]?.hand ?? [];

  if (chainPending(state)) {
    if (state.pendingW4?.target === me && aiShouldChallenge(state, tier)) {
      return { type: "challenge" };
    }
    if (mustTakeChain(state, me)) return { type: "take" };
    const stacks = legalPlays(state, me);
    if (stacks.length === 0) return { type: "take" };
    // 大师档会卡链:能续就续,把整摞塞给下家
    if (TIER_RANK[tier] >= 1 && stacks.length > 1) {
      const sorted = stacks.slice().sort((a, b) => rate(state, tier, b, hand) - rate(state, tier, a, hand));
      const pick = tier === "hell" ? stacks[0] : sorted[0];
      return { type: "play", cardId: pick.id, color: isWild(pick) ? aiPickColor(state, tier, hand) : undefined };
    }
    const pick = stacks[0];
    return { type: "play", cardId: pick.id, color: isWild(pick) ? aiPickColor(state, tier, hand) : undefined };
  }

  const options = legalPlays(state, me);
  if (options.length === 0) return { type: "draw" };

  let best = options[0];
  let bestScore = rate(state, tier, best, hand);
  for (const card of options.slice(1)) {
    const s = rate(state, tier, card, hand);
    if (s > bestScore) {
      best = card;
      bestScore = s;
    }
  }
  return {
    type: "play",
    cardId: best.id,
    color: isWild(best) ? aiPickColor(state, tier, hand.filter((c) => c.id !== best.id)) : undefined,
  };
}
