/**
 * 花色接龙 · 整局自动回放。
 *
 * 界面是玩家一步一步点出来的,但关卡可解性、AI 档位强弱这些事只能靠机器跑:
 * 给定座位档位与种子,这里把一整局(含质疑、叠加、点破忘喊)完整走完,
 * 结果完全确定 —— 同一个种子永远跑出同一局。
 */
import { handScore } from "./score";
import { aiCallsOneCard, aiCatchesOneCard, aiPlay, type AiTier } from "./ai";
import {
  callOneCard,
  createGame,
  drawFromDeck,
  oneCardPenalty,
  passAfterDraw,
  playCard,
  resolveChallenge,
  takeChain,
  type CreateOpts,
  type HueState,
} from "./rules";
import { canPlay, topCard } from "./rules";

export interface SimOptions extends Omit<CreateOpts, "players"> {
  /** 每个座位的 AI 档位,长度就是人数 */
  seats: AiTier[];
  /** 最多走多少个动作,防止牌堆打完之后大家一直互相过牌 */
  maxSteps?: number;
}

export interface SimResult {
  winner: number;
  /** 没人出完手牌就结束(牌堆耗尽或步数用光) */
  stalled: boolean;
  steps: number;
  /** 每个座位一共动了几手,关卡的「N 步内出完」就是照这个定的 */
  actions: number[];
  /** 每个座位最后剩的手牌分 */
  scores: number[];
  state: HueState;
}

/** 有人忘按「就一张」时,让会点破的 AI 点破他 */
function catchForgotten(state: HueState, seats: AiTier[]): void {
  const window = state.oneCard;
  if (!window) return;
  for (let i = 0; i < seats.length; i++) {
    if (i === window.player) continue;
    if (aiCatchesOneCard(seats[i])) {
      oneCardPenalty(state, window.player);
      return;
    }
  }
}

/** 一个座位走一步(出牌 / 抽牌 / 抽整条链 / 质疑) */
function stepOnce(state: HueState, seats: AiTier[]): void {
  const me = state.turn;
  const tier = seats[me];
  const action = aiPlay(state, tier);

  if (action.type === "challenge") {
    resolveChallenge(state, me);
    return;
  }
  if (action.type === "take") {
    takeChain(state, me);
    return;
  }
  if (action.type === "play") {
    const res = playCard(state, me, action.cardId, action.color);
    if (!res.ok) {
      // 理论上不会发生;真发生了就当他接不上,抽一张免得卡死
      drawFromDeck(state, me);
      passAfterDraw(state, me);
      return;
    }
    if (state.players[me].hand.length === 1 && aiCallsOneCard(tier)) callOneCard(state, me);
    return;
  }

  const drew = drawFromDeck(state, me);
  if (drew.playable && drew.card) {
    const res = playCard(state, me, drew.card.id, undefined);
    if (res.ok) {
      if (state.players[me].hand.length === 1 && aiCallsOneCard(tier)) callOneCard(state, me);
      return;
    }
  }
  passAfterDraw(state, me);
}

/** 把一整局跑完 */
export function simulateGame(opts: SimOptions): SimResult {
  const seats = opts.seats;
  const state = createGame({ ...opts, players: seats.length });
  const maxSteps = opts.maxSteps ?? 700;
  const actions = seats.map(() => 0);
  let steps = 0;

  while (!state.finished && steps < maxSteps) {
    catchForgotten(state, seats);
    if (state.finished) break;
    const actor = state.turn;
    stepOnce(state, seats);
    actions[actor]++;
    steps++;
  }

  const scores = state.players.map((p) => handScore(p.hand));
  if (state.finished && state.winner >= 0) {
    return { winner: state.winner, stalled: false, steps, actions, scores, state };
  }
  // 牌打不动了(步数用光,或者牌真的用完判了平局):手牌分最少的人算赢下这一局。
  // 「牌用完」这一路以前会一直空转到 maxSteps 才落到这儿,现在提前收口,落点还是同一个 ——
  // 谁也接不上就意味着手牌一张都不会再变,所以算出来的赢家与改前一模一样。
  let winner = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] < scores[winner]) winner = i;
  }
  return { winner, stalled: true, steps, actions, scores, state };
}

export interface MatchRound {
  winner: number;
  /** 赢家这一局收了多少分 */
  gained: number;
  /** 打完这一局之后各家的总分 */
  totals: number[];
}

export interface MatchOptions extends Omit<SimOptions, "deck"> {
  rounds: number;
  /** 第 r 局用哪一副牌(顺序固定) */
  deckFor?: (round: number) => SimOptions["deck"];
}

/**
 * 连打若干局的积分赛回放:每局赢家把其他人手上剩的牌收成分。
 * 只跑不判胜负,目标分由调用方按这份轨迹去挑。
 */
export function simulateMatch(opts: MatchOptions): MatchRound[] {
  const totals = opts.seats.map(() => 0);
  const out: MatchRound[] = [];
  for (let r = 0; r < opts.rounds; r++) {
    const res = simulateGame({
      ...opts,
      deck: opts.deckFor?.(r),
      seed: opts.seed + r * 7919,
      startTurn: r % opts.seats.length,
    });
    let gained = 0;
    for (let i = 0; i < res.scores.length; i++) {
      if (i !== res.winner) gained += res.scores[i];
    }
    totals[res.winner] += gained;
    out.push({ winner: res.winner, gained, totals: totals.slice() });
  }
  return out;
}

/**
 * 从一份积分轨迹里挑一个「玩家一定会先摸到」的目标分:
 * 找最早那一局,玩家的总分严格高过所有人,把这个总分当目标分。
 * 别人的总分只增不减,那一刻他们都还没到这个数,所以玩家一定先到。
 */
export function firstLeadScore(rounds: readonly MatchRound[], seat = 0): number | null {
  for (const round of rounds) {
    const mine = round.totals[seat];
    if (mine <= 0) continue;
    const best = Math.max(...round.totals.filter((_, i) => i !== seat));
    if (mine > best) return mine;
  }
  return null;
}

export interface DuelReport {
  /** 各座位赢了几局 */
  wins: number[];
  games: number;
  stalls: number;
}

/** 让两个档位打 n 局(每局换先手,座位固定),统计胜场 */
export function duel(a: AiTier, b: AiTier, games: number, baseSeed = 20250808): DuelReport {
  const wins = [0, 0];
  let stalls = 0;
  for (let i = 0; i < games; i++) {
    const res = simulateGame({
      seats: [a, b],
      seed: baseSeed + i * 7919,
      startTurn: i % 2,
    });
    if (res.stalled) stalls++;
    if (res.winner >= 0) wins[res.winner]++;
  }
  return { wins, games, stalls };
}

/** 台面上这张牌现在能不能接(界面提示与残局求解共用) */
export function playableNow(state: HueState, card: Parameters<typeof canPlay>[0]): boolean {
  return canPlay(card, topCard(state), state.color);
}

/**
 * 这一副牌发下去,某个座位开局手上有没有接得上的牌。
 * 开局一张都接不上只能先摸牌,不致命但很扫兴 —— 无尽 / 对战换牌重开时拿它筛一道。
 */
export function hasOpeningPlay(opts: CreateOpts, seat = 0): boolean {
  const state = createGame(opts);
  const top = topCard(state);
  return (state.players[seat]?.hand ?? []).some((c) => canPlay(c, top, state.color));
}
