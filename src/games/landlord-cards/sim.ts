// 朵朵抢地主 —— 不带界面的对局引擎。
//
// 界面(index.ts)和单测(sim.test.ts)共用同一套规则:
// 谁该出牌、这一手合不合法、两家连过之后谁重新先手、春天怎么算、最后翻几倍,
// 都只在这里实现一次,所以「测试里跑通的规则」和「小朋友玩到的规则」永远是同一套。
import { mulberry32 } from "../level99";
import { chooseAiPlay, type AiLevel } from "./ai";
import {
  beats,
  dealCards,
  isBombLike,
  parsePlay,
  settleScore,
  springState,
  suggestBid,
  type Play,
  type SettleResult,
} from "./logic";

export const SEATS = 3;

export interface GameState {
  /** 三家手牌 */
  hands: number[][];
  /** 地主坐第几家 */
  landlord: number;
  /** 三张底牌(已经加进地主手里,这里留一份给界面展示) */
  bottom: number[];
  /** 叫到的分(1..3) */
  base: number;
  /** 轮到谁 */
  turn: number;
  /** 当前要压的那一手;null 表示本轮由 turn 先手 */
  prev: Play | null;
  /** prev 是谁出的 */
  prevSeat: number;
  /** 连续「不要」了几家 */
  passes: number;
  /** 本局出过几个炸(炸弹 + 王炸) */
  bombs: number;
  /** 三家各自出过几手牌(算春天用) */
  plays: number[];
  finished: boolean;
  winner: number | null;
  history: Array<{ seat: number; cards: number[]; play: Play | null }>;
}

export interface DealResult {
  hands: number[][];
  bottom: number[];
}

/** 下一家 */
export function nextSeat(seat: number): number {
  return (seat + 1) % SEATS;
}

/** 是不是农民阵营 */
export function isFarmer(seat: number, landlord: number): boolean {
  return seat !== landlord;
}

/**
 * 叫分:从 startSeat 起一人一次,谁叫得高谁当地主;叫到 3 分直接封顶。
 * 三家都不叫返回 null(流局,重新发牌)。
 */
export function runBidding(hands: readonly number[][], startSeat = 0): { landlord: number; base: number } | null {
  let best = 0;
  let landlord = -1;
  for (let i = 0; i < SEATS; i++) {
    const seat = (startSeat + i) % SEATS;
    const bid = suggestBid(hands[seat], best);
    if (bid > best) {
      best = bid;
      landlord = seat;
      if (best === 3) break;
    }
  }
  return landlord < 0 ? null : { landlord, base: best };
}

/** 开局:底牌进地主手里,地主先出 */
export function createGame(input: { hands: number[][]; bottom: number[]; landlord: number; base: number }): GameState {
  const hands = input.hands.map((h) => h.slice());
  hands[input.landlord] = hands[input.landlord].concat(input.bottom);
  return {
    hands,
    landlord: input.landlord,
    bottom: input.bottom.slice(),
    base: Math.max(1, Math.min(3, Math.round(input.base))),
    turn: input.landlord,
    prev: null,
    prevSeat: input.landlord,
    passes: 0,
    bombs: 0,
    plays: [0, 0, 0],
    finished: false,
    winner: null,
    history: [],
  };
}

export type MoveResult = { ok: true; play: Play | null } | { ok: false; reason: string };

/** 手里有没有这些牌 */
function hasAll(hand: readonly number[], cards: readonly number[]): boolean {
  const pool = new Set(hand);
  for (const id of cards) {
    if (!pool.has(id)) return false;
    pool.delete(id);
  }
  return true;
}

/**
 * 当前这一家出牌(cards 为空数组表示「不要」)。
 * 合法就直接改 state 并返回 ok,不合法只返回一句原因、不动 state。
 */
export function tryMove(state: GameState, cards: readonly number[]): MoveResult {
  if (state.finished) return { ok: false, reason: "这一局已经结束啦" };
  const seat = state.turn;

  if (cards.length === 0) {
    if (!state.prev) return { ok: false, reason: "这一轮由你先手,要出一手牌哦" };
    state.passes++;
    state.history.push({ seat, cards: [], play: null });
    state.turn = nextSeat(seat);
    if (state.passes >= SEATS - 1) {
      state.passes = 0;
      state.prev = null;
    }
    return { ok: true, play: null };
  }

  if (!hasAll(state.hands[seat], cards)) return { ok: false, reason: "这几张牌不在手里呢" };
  const play = parsePlay(cards);
  if (!play) return { ok: false, reason: "这几张凑不成牌型" };
  if (!beats(play, state.prev)) return { ok: false, reason: "压不住上一手" };

  const drop = new Set(cards);
  state.hands[seat] = state.hands[seat].filter((id) => !drop.has(id));
  state.prev = play;
  state.prevSeat = seat;
  state.passes = 0;
  state.plays[seat]++;
  if (isBombLike(play)) state.bombs++;
  state.history.push({ seat, cards: play.cards.slice(), play });

  if (state.hands[seat].length === 0) {
    state.finished = true;
    state.winner = seat;
  } else {
    state.turn = nextSeat(seat);
  }
  return { ok: true, play };
}

/** 结算:地主赢没赢、春天/反春天、炸弹翻倍、最后几分 */
export function settleGame(state: GameState): SettleResult {
  const landlordWon = state.winner === state.landlord;
  const farmerPlays = state.plays.reduce((s, n, i) => (i === state.landlord ? s : s + n), 0);
  const { spring, antiSpring } = springState(landlordWon, farmerPlays, state.plays[state.landlord]);
  return settleScore({ landlordWon, base: state.base, bombs: state.bombs, spring, antiSpring });
}

/** 让某一档 AI 替当前这一家做决定 */
export function aiDecide(state: GameState, level: AiLevel, rand: () => number): number[] {
  const seat = state.turn;
  return chooseAiPlay(
    {
      seat,
      landlord: state.landlord,
      hand: state.hands[seat],
      prev: state.prev,
      prevSeat: state.prevSeat,
      counts: state.hands.map((h) => h.length),
      rand,
    },
    level
  );
}

// ---------------------------------------------------------------------------
// 自对弈:三家全交给 AI,用来测「困难档到底强不强」
// ---------------------------------------------------------------------------

/** 一局最多走多少步,防止规则出 bug 时死循环 */
export const MAX_STEPS = 600;

export interface SimResult {
  landlord: number;
  winner: number;
  landlordWon: boolean;
  steps: number;
  settle: SettleResult;
}

export interface SimOptions {
  /** 指定地主座位(不指定就走叫分) */
  landlord?: number;
  /** 指定底分 */
  base?: number;
}

/** 发一副能开局的牌:叫分流局就换个种子重发,最多试 20 次 */
export function dealPlayable(seed: number): { deal: DealResult; landlord: number; base: number } {
  for (let i = 0; i < 20; i++) {
    const d = dealCards(seed + i * 7919);
    const bid = runBidding(d.hands, seed % SEATS);
    if (bid) return { deal: d, landlord: bid.landlord, base: bid.base };
  }
  const d = dealCards(seed);
  return { deal: d, landlord: seed % SEATS, base: 1 };
}

/** 三家 AI 打完一局(确定性:同样的 seed 与档位组合,结果永远一样) */
export function simulateGame(seed: number, levels: readonly AiLevel[], opts: SimOptions = {}): SimResult {
  const d = dealCards(seed);
  const landlord = opts.landlord ?? runBidding(d.hands, seed % SEATS)?.landlord ?? seed % SEATS;
  const base = opts.base ?? runBidding(d.hands, seed % SEATS)?.base ?? 1;
  const state = createGame({ hands: d.hands, bottom: d.bottom, landlord, base });
  const rand = mulberry32(seed ^ 0x5bd1e995);

  let steps = 0;
  while (!state.finished && steps < MAX_STEPS) {
    steps++;
    const seat = state.turn;
    const cards = aiDecide(state, levels[seat], rand);
    const res = tryMove(state, cards);
    if (!res.ok) {
      // AI 给了一手非法牌:先手就退到最小的单张,跟牌就直接过,绝不卡死
      const fallback = state.prev ? [] : [state.hands[seat][0]];
      const again = tryMove(state, fallback);
      if (!again.ok) break;
    }
  }
  if (!state.finished) {
    // 极端兜底:步数用完就算地主没走完(实际测试里不会发生)
    state.finished = true;
    state.winner = state.hands.findIndex((h) => h.length === Math.min(...state.hands.map((x) => x.length)));
  }
  return {
    landlord,
    winner: state.winner ?? landlord,
    landlordWon: state.winner === landlord,
    steps,
    settle: settleGame(state),
  };
}

/**
 * 跑一批固定 seed 的对局,统计「被观察的那一方」赢了多少局。
 * side 是 "landlord" 或 "farmer",landlord 固定坐 0 号位,方便两组配置公平对比。
 */
export function winRate(
  games: number,
  levels: readonly AiLevel[],
  side: "landlord" | "farmer",
  seed0 = 1000
): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const r = simulateGame(seed0 + i, levels, { landlord: 0, base: 2 });
    if (side === "landlord" ? r.landlordWon : !r.landlordWon) wins++;
  }
  return wins / games;
}
