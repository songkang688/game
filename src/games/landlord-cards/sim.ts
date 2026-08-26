// 朵朵抢地主 —— 不带界面的对局引擎。
//
// 界面(index.ts)和单测(sim.test.ts)共用同一套规则:
// 谁该出牌、这一手合不合法、两家连过之后谁重新先手、春天怎么算、最后翻几倍,
// 都只在这里实现一次,所以「测试里跑通的规则」和「小朋友玩到的规则」永远是同一套。
import { mulberry32 } from "../level99";
import { beatCandidates, chooseAiPlay, leadCandidates, positionScore, type AiLevel } from "./ai";
import { searchHint } from "./hint";
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

// ---------------------------------------------------------------------------
// 关卡可赢性:给定一副固定的牌,搜出一条真的能赢的出牌线路(1.2 新增)
// ---------------------------------------------------------------------------

/** 线路里的一步:谁出了哪几张(空数组是「不要」) */
export interface LineMove {
  seat: number;
  cards: number[];
}

export interface WinningLine {
  /** 第几次尝试搜到的 */
  trial: number;
  /** 这条线路里地主是谁(叫分时玩家自己可以选择抢或不抢,所以两种身份都算数) */
  landlord: number;
  /** 玩家这条线路里是地主还是农民 */
  playerIsLandlord: boolean;
  moves: LineMove[];
  /** 玩家自己出了几手(「不要」不算) */
  playerPlays: number;
  /** 玩家自己用掉几个炸(炸弹 + 王炸) */
  playerBombs: number;
}

export interface ProveInput {
  hands: number[][];
  bottom: number[];
  /** 玩家坐第几家 */
  playerSeat: number;
  /** 关卡预设的地主 */
  presetLandlord: number;
  base: number;
  /** 两个电脑对手的档位 */
  aiLevel: AiLevel;
  /** 随机源的种子(同一个种子搜出来的线路永远一样) */
  seed: number;
}

/** 线路要满足的附加目标:几手内赢 / 不许用炸 */
export interface LineGoal {
  maxHands?: number;
  noBomb?: boolean;
}

/** 默认搜多少次;绝大多数关卡前两次(纯困难档)就能搜到 */
export const PROVE_TRIES = 1600;

function withoutCards(hand: readonly number[], cards: readonly number[]): number[] {
  const drop = new Set(cards);
  return hand.filter((id) => !drop.has(id));
}

/**
 * 玩家座位这一手怎么打:
 * trial 0/1 用纯困难档(确定性),之后按 trial 换不同的噪声强度去翻别的走法。
 */
function probePlay(state: GameState, seat: number, rand: () => number, trial: number, goal: LineGoal): number[] {
  if (trial <= 1) return aiDecide(state, "hard", rand);
  const hand = state.hands[seat];
  let list = state.prev ? beatCandidates(hand, state.prev) : leadCandidates(hand);
  if (goal.noBomb) {
    const soft = list.filter((p) => !isBombLike(p));
    // 先手时一定得出牌,实在只剩炸弹就还是得炸(这条线路自然不满足 noBomb,会被判掉)
    if (soft.length > 0 || state.prev) list = soft;
  }
  if (list.length === 0) return [];

  const greed = trial % 3;
  if (greed === 0 && rand() < 0.7) return aiDecide(state, "hard", rand);
  const noise = greed === 2 ? 26 : 12;
  const scored = list
    .map((p) => ({ p, s: positionScore(withoutCards(hand, p.cards)) + rand() * noise }))
    .sort((a, b) => a.s - b.s);
  const width = Math.min(scored.length, greed === 2 ? 6 : 3);
  const pick = scored[Math.floor(rand() * width)].p;
  // 偶尔忍一手:出牌权让给对手,有时反而能把长牌型留整
  if (state.prev && rand() < 0.15) return [];
  return pick.cards;
}

function lineSatisfies(line: WinningLine, goal: LineGoal): boolean {
  if (goal.noBomb && line.playerBombs > 0) return false;
  if (goal.maxHands !== undefined && line.playerPlays > goal.maxHands) return false;
  return true;
}

/**
 * 搜一条「玩家这一方能赢」的出牌线路。
 *
 * 牌是固定的(关卡 seed 决定),变的只有玩家自己怎么打,以及叫分时抢不抢地主
 * ——这两件事在真实牌桌上本来就是玩家自己说了算,所以两种身份都算合法线路。
 * 搜到就返回完整的一串走法,`replayLine` 能把它一步不差地重放出来,这就是「可赢」的证明。
 */
export function findWinningLine(input: ProveInput, tries = PROVE_TRIES, goal: LineGoal = {}): WinningLine | null {
  const alt = input.playerSeat === input.presetLandlord ? (input.playerSeat + 1) % SEATS : input.playerSeat;
  for (let trial = 0; trial < tries; trial++) {
    const landlord = trial % 2 === 0 ? input.presetLandlord : alt;
    const state = createGame({ hands: input.hands, bottom: input.bottom, landlord, base: input.base });
    const rand = mulberry32((input.seed ^ 0x5bd1e995) + trial * 7919);
    const moves: LineMove[] = [];
    let playerPlays = 0;
    let playerBombs = 0;
    let steps = 0;

    while (!state.finished && steps < MAX_STEPS) {
      steps++;
      const seat = state.turn;
      const wanted = seat === input.playerSeat ? probePlay(state, seat, rand, trial, goal) : aiDecide(state, input.aiLevel, rand);
      let cards = wanted;
      let res = tryMove(state, cards);
      if (!res.ok) {
        cards = state.prev ? [] : [state.hands[seat][0]];
        res = tryMove(state, cards);
        if (!res.ok) break;
      }
      moves.push({ seat, cards: cards.slice() });
      if (seat === input.playerSeat && cards.length > 0) {
        playerPlays++;
        if (res.play && isBombLike(res.play)) playerBombs++;
      }
    }

    if (!state.finished) continue;
    const landlordWon = state.winner === landlord;
    const playerIsLandlord = input.playerSeat === landlord;
    if (playerIsLandlord !== landlordWon) continue;
    const line: WinningLine = { trial, landlord, playerIsLandlord, moves, playerPlays, playerBombs };
    if (!lineSatisfies(line, goal)) continue;
    return line;
  }
  return null;
}

/** 把搜到的线路一步不差地重放一遍,确认它真的能赢(单测靠它验收「可赢」) */
export function replayLine(input: ProveInput, line: WinningLine): boolean {
  const state = createGame({ hands: input.hands, bottom: input.bottom, landlord: line.landlord, base: input.base });
  for (const mv of line.moves) {
    if (state.finished) return false;
    if (state.turn !== mv.seat) return false;
    if (!tryMove(state, mv.cards).ok) return false;
  }
  if (!state.finished) return false;
  const landlordWon = state.winner === line.landlord;
  return line.playerIsLandlord === landlordWon;
}

// ---------------------------------------------------------------------------
// 教练代打:本地两人 + 1 AI 也能一路打到结算
// ---------------------------------------------------------------------------

/** 一家由谁来打:`ai` 交给电脑,`coach` 由牌力提示的搜索结果代打(模拟真人照着提示走) */
export type SeatPolicy = "ai" | "coach";

export interface TableRunResult {
  state: GameState;
  settle: SettleResult;
  /** 一共走了多少步 */
  steps: number;
}

/**
 * 把一整桌打到结算。
 * `coach` 座位走 `hint.ts` 的真实搜索——它就是双人模式里真人照着「推荐一手」出牌的样子,
 * 所以这个函数能证明「本地两人 + 1 AI 真的能玩到结算」,而不是卡在半路。
 */
export function runTable(
  input: { hands: number[][]; bottom: number[]; landlord: number; base: number },
  policies: readonly SeatPolicy[],
  aiLevel: AiLevel,
  seed = 20250822
): TableRunResult {
  const state = createGame(input);
  const rand = mulberry32(seed);
  let steps = 0;
  while (!state.finished && steps < MAX_STEPS) {
    steps++;
    const seat = state.turn;
    let cards: number[];
    if (policies[seat] === "coach") {
      const res = searchHint(
        {
          hand: state.hands[seat],
          prev: state.prev,
          seat,
          landlord: state.landlord,
          counts: state.hands.map((h) => h.length),
        },
        "coach"
      );
      cards = res.play ? res.play.cards.slice() : [];
    } else {
      cards = aiDecide(state, aiLevel, rand);
    }
    if (!tryMove(state, cards).ok) {
      const fallback = state.prev ? [] : [state.hands[seat][0]];
      if (!tryMove(state, fallback).ok) break;
    }
  }
  if (!state.finished) {
    state.finished = true;
    state.winner = state.hands.findIndex((h) => h.length === Math.min(...state.hands.map((x) => x.length)));
  }
  return { state, settle: settleGame(state), steps };
}
