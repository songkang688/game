/**
 * 花色接龙 · 规则与整局状态机。
 *
 * 这一层是纯数据 + 纯逻辑,不碰任何 DOM,所以单测能把 108 张牌、质疑、叠加链、
 * 「就一张」罚抽全都跑一遍。界面只负责把 state 画出来、把玩家的动作转成这里的函数调用。
 *
 * 规则一句话:颜色相同、数字相同、或者同一种功能牌就能接上;万能牌随时能出并指定新颜色;
 * 万能加四只有手上没有当前颜色时才该打,打了会被质疑;剩最后一张要按「就一张」。
 */
import {
  COLORS,
  cardsByIds,
  isDrawCard,
  isWild,
  nextRandom,
  shuffle,
  shuffledDeck,
  type Card,
  type Color,
  type DrawKind,
} from "./deck";

// ---------------------------------------------------------------------------
// 规则开关(全部写成常量,改一处全场生效)
// ---------------------------------------------------------------------------

export const RULES = {
  /** 每人起手几张 */
  START_HAND: 7,
  /** 加二能不能叠加二 */
  STACK_DRAW2: true,
  /** 加四能不能叠加四 */
  STACK_DRAW4: true,
  /** 加二链与加四链能不能互叠(规格要求两条链分开,所以是 false) */
  CROSS_STACK: false,
  /** 一条链最多叠几张:加二链上限 8 张牌,加四链上限 16 张牌 */
  MAX_STACK: 4,
  /** 抽到能出的牌,允许立刻出 */
  PLAY_AFTER_DRAW: true,
  /** 忘按「就一张」被点破,罚抽几张 */
  ONE_CARD_PENALTY: 2,
  /** 质疑成立:打加四的人自己抽几张 */
  W4_BLUFF_DRAW: 4,
  /** 质疑失败:质疑的人抽几张 */
  W4_FAIL_DRAW: 6,
  /** 2 人局的反转等于跳过 */
  REVERSE_IS_SKIP_AT_TWO: true,
  /** 允许「明知手上有当前色也硬打加四」——冒险搏对手不质疑,不然质疑就没意义了 */
  ALLOW_W4_BLUFF: true,
  /** 积分赛先到多少分赢下整场 */
  TARGET_SCORE: 200,
} as const;

// ---------------------------------------------------------------------------
// 七个系统函数(规格第七节)
// ---------------------------------------------------------------------------

/** 这张牌能不能接在台面牌后头。chosenColor 是「现在是什么颜色」,万能牌打完由出牌者指定 */
export function canPlay(card: Card, top: Card, chosenColor: Color): boolean {
  if (isWild(card)) return true;
  if (card.color === chosenColor) return true;
  if (card.kind === "num") return top.kind === "num" && card.num === top.num;
  return card.kind === top.kind;
}

/** 万能加四合法吗:手上一张当前颜色都没有才算合法(万能牌不算颜色) */
export function wildDraw4Legal(hand: readonly Card[], chosenColor: Color): boolean {
  return !hand.some((c) => c.color === chosenColor);
}

export interface ChallengeOutcome {
  /** 质疑成立 = 出牌者确实在诈唬 */
  bluffed: boolean;
  /** 谁抽牌:player 是打加四的人,challenger 是质疑的人 */
  drawer: "player" | "challenger";
  /** 抽几张 */
  count: number;
  /** 这张加四生不生效 */
  applied: boolean;
}

/**
 * 质疑万能加四。
 * hand 是打加四那个人打完之后手上剩的牌,top 给出打之前的当前颜色。
 *  - 质疑成立(他手上确实有当前色)→ 他自己抽 4,加四不生效;
 *  - 质疑失败 → 质疑的人抽 6。
 */
export function challengeW4(hand: readonly Card[], top: Card | Color): ChallengeOutcome {
  const color = typeof top === "string" ? top : (top.color as Color);
  const bluffed = !wildDraw4Legal(hand, color);
  return bluffed
    ? { bluffed: true, drawer: "player", count: RULES.W4_BLUFF_DRAW, applied: false }
    : { bluffed: false, drawer: "challenger", count: RULES.W4_FAIL_DRAW, applied: true };
}

/** 一条叠加链一共要抽几张:加二算 2,加四算 4 */
export function drawStack(chain: readonly Card[]): number {
  let n = 0;
  for (const card of chain) n += card.kind === "wild4" ? 4 : card.kind === "draw2" ? 2 : 0;
  return n;
}

/** 这张牌能不能续在当前的叠加链上(两条链分开,不能互叠,还有张数上限) */
export function canStack(chain: readonly Card[], chainKind: DrawKind | null, card: Card): boolean {
  if (!isDrawCard(card)) return false;
  if (!chainKind || chain.length === 0) return true;
  if (chain.length >= RULES.MAX_STACK) return false;
  if (card.kind !== chainKind) return RULES.CROSS_STACK;
  return card.kind === "draw2" ? RULES.STACK_DRAW2 : RULES.STACK_DRAW4;
}

export interface TurnLike {
  turn: number;
  dir: 1 | -1;
  /** 人数,或者直接给玩家数组 */
  players: number | readonly unknown[];
}

function seatCount(state: TurnLike): number {
  return typeof state.players === "number" ? state.players : state.players.length;
}

/**
 * 方向与跳过:算出打完这张牌之后轮到谁。
 *  - 跳过:跳过下一家;
 *  - 反转:4 人时改变方向,2 人时等于跳过;
 *  - 加二 / 加四:先轮到下一家,由他决定续叠还是抽完整条链(抽完之后引擎再跳过他);
 *  - card 传 null 表示「什么都没打,单纯换下一家」。
 */
export function advanceTurn(state: TurnLike, card: Card | null): { turn: number; dir: 1 | -1 } {
  const n = Math.max(1, seatCount(state));
  let dir = state.dir;
  let steps = 1;
  if (card) {
    if (card.kind === "skip") {
      steps = 2;
    } else if (card.kind === "reverse") {
      if (n === 2 && RULES.REVERSE_IS_SKIP_AT_TWO) steps = 2;
      else dir = (dir === 1 ? -1 : 1) as 1 | -1;
    }
  }
  const turn = (((state.turn + dir * steps) % n) + n) % n;
  return { turn, dir };
}

// ---------------------------------------------------------------------------
// 整局状态
// ---------------------------------------------------------------------------

export interface HuePlayer {
  hand: Card[];
  /** 这一轮已经按过「就一张」 */
  called: boolean;
  /** 别人看在眼里的「他缺这些颜色」(抽牌时暴露的信息,高手与地狱 AI 会用) */
  lacks: Color[];
}

export interface PendingW4 {
  /** 谁打的加四 */
  by: number;
  /** 打之前的当前颜色 */
  prevColor: Color;
  /** 打完之后他手上剩的牌 */
  hand: Card[];
  /** 谁有权质疑 */
  target: number;
}

/** 手上只剩一张、又还没喊的那个人,正处在「可以被点破」的窗口里 */
export interface OneCardWindow {
  player: number;
}

export interface HueState {
  players: HuePlayer[];
  /** 抽牌堆,末尾是堆顶 */
  deck: Card[];
  /** 弃牌堆,末尾是台面上那张 */
  pile: Card[];
  /** 现在是什么颜色 */
  color: Color;
  turn: number;
  dir: 1 | -1;
  /** 正在叠的加牌链 */
  chain: Card[];
  chainKind: DrawKind | null;
  pendingW4: PendingW4 | null;
  oneCard: OneCardWindow | null;
  /** 刚抽上来、还能立刻出的那张牌(抽到能出开关打开时才有) */
  drawnId: number | null;
  finished: boolean;
  winner: number;
  seed: number;
  /** 一共走了多少个动作,用来给关卡限步数 */
  moves: number;
  log: string[];
}

export interface CreateOpts {
  players: number;
  seed: number;
  /** 指定每个人的手牌(残局关用);不给就按 handSize 发 */
  hands?: Card[][];
  /** 指定抽牌堆顺序(末尾是堆顶) */
  deck?: Card[];
  /** 指定台面起始牌 */
  top?: Card;
  /** 指定起始颜色(top 是万能牌时必须给) */
  color?: Color;
  startTurn?: number;
  handSize?: number;
}

function emptyPlayer(hand: Card[]): HuePlayer {
  return { hand, called: false, lacks: [] };
}

/** 台面上那张牌 */
export function topCard(state: HueState): Card {
  return state.pile[state.pile.length - 1];
}

/** 开一局。不给 hands / deck 就自己洗一副 108 张发牌,起始牌一定是数字牌 */
export function createGame(opts: CreateOpts): HueState {
  const seats = Math.max(2, Math.min(4, Math.round(opts.players)));
  let seed = opts.seed;
  let deck: Card[];
  if (opts.deck) {
    deck = opts.deck.map((c) => ({ ...c }));
  } else {
    const s = shuffledDeck(seed);
    deck = s.cards;
    seed = s.seed;
  }

  const hands: Card[][] = [];
  if (opts.hands) {
    for (let i = 0; i < seats; i++) hands.push((opts.hands[i] ?? []).map((c) => ({ ...c })));
  } else {
    const size = opts.handSize ?? RULES.START_HAND;
    for (let i = 0; i < seats; i++) hands.push([]);
    for (let k = 0; k < size; k++) {
      for (let i = 0; i < seats; i++) {
        const card = deck.pop();
        if (card) hands[i].push(card);
      }
    }
  }

  let top = opts.top ? { ...opts.top } : null;
  if (!top) {
    // 起始牌翻到数字牌为止:开局就撞上功能牌的边角情况一律绕开
    while (deck.length > 0) {
      const card = deck.pop() as Card;
      if (card.kind === "num") {
        top = card;
        break;
      }
      deck.unshift(card);
    }
  }
  const first = top ?? { id: 999, kind: "num", color: "pink", num: 0 };
  const color = opts.color ?? (first.color as Color) ?? "pink";

  return {
    players: hands.map(emptyPlayer),
    deck,
    pile: [first],
    color,
    turn: Math.max(0, Math.min(seats - 1, opts.startTurn ?? 0)),
    dir: 1,
    chain: [],
    chainKind: null,
    pendingW4: null,
    oneCard: null,
    drawnId: null,
    finished: false,
    winner: -1,
    seed,
    moves: 0,
    log: [],
  };
}

function note(state: HueState, line: string): void {
  state.log.push(line);
  if (state.log.length > 40) state.log.shift();
}

/** 抽牌堆空了就把弃牌堆(留下台面那张)重新洗成新的抽牌堆 */
function refill(state: HueState): void {
  if (state.deck.length > 0 || state.pile.length <= 1) return;
  const top = state.pile[state.pile.length - 1];
  const rest = state.pile.slice(0, -1);
  const s = shuffle(rest, state.seed);
  state.deck = s.cards;
  state.seed = s.seed;
  state.pile = [top];
  note(state, "牌堆抽空啦,把打出去的牌洗一洗接着用。");
}

/** 从牌堆摸一张塞进某人手里;牌真的用完了返回 null */
function pullCard(state: HueState, player: number): Card | null {
  refill(state);
  const card = state.deck.pop();
  if (!card) return null;
  state.players[player].hand.push(card);
  if (state.players[player].hand.length > 1) state.players[player].called = false;
  return card;
}

/** 连抽 n 张,回真正抽到的张数 */
export function drawMany(state: HueState, player: number, n: number): number {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!pullCard(state, player)) break;
    got++;
  }
  if (got > 0 && state.oneCard?.player === player) state.oneCard = null;
  return got;
}

function stepTurn(state: HueState, card: Card | null): void {
  const next = advanceTurn({ turn: state.turn, dir: state.dir, players: state.players.length }, card);
  state.turn = next.turn;
  state.dir = next.dir;
  state.drawnId = null;
}

/** 现在轮到的人必须先处理叠加链吗 */
export function chainPending(state: HueState): boolean {
  return state.chainKind !== null && state.chain.length > 0;
}

/** 某人现在能出的牌 */
export function legalPlays(state: HueState, player: number): Card[] {
  const hand = state.players[player]?.hand ?? [];
  if (chainPending(state)) {
    return hand.filter((c) => canStack(state.chain, state.chainKind, c));
  }
  const top = topCard(state);
  return hand.filter((c) => canPlay(c, top, state.color));
}

/** 接不上整条链,只能一次抽完 */
export function mustTakeChain(state: HueState, player: number): boolean {
  return chainPending(state) && legalPlays(state, player).length === 0;
}

export interface PlayResult {
  ok: boolean;
  /** 出不了时的一句温柔提示 */
  reason?: string;
  /** 这一手打完是不是赢了 */
  won?: boolean;
  /** 打的是不是一张有诈唬嫌疑的加四(界面据此提醒) */
  risky?: boolean;
}

/**
 * 出牌。万能牌要带 chosenColor;不带就默认沿用当前颜色。
 * 加四允许硬打(诈唬),合不合法交给对手质疑。
 */
export function playCard(
  state: HueState,
  player: number,
  cardId: number,
  chosenColor?: Color
): PlayResult {
  if (state.finished) return { ok: false, reason: "这一局已经打完啦。" };
  if (player !== state.turn) return { ok: false, reason: "还没轮到你,先等一下。" };
  const me = state.players[player];
  const idx = me.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, reason: "你手上没有这张牌。" };
  const card = me.hand[idx];

  if (chainPending(state)) {
    if (!canStack(state.chain, state.chainKind, card)) {
      const need = state.chainKind === "draw2" ? "加二" : "加四";
      return {
        ok: false,
        reason:
          state.chain.length >= RULES.MAX_STACK
            ? `这条链已经叠到 ${RULES.MAX_STACK} 张,接不下去了,先抽完吧。`
            : `现在只能续${need},或者一次抽完这条链。`,
      };
    }
  } else if (!canPlay(card, topCard(state), state.color)) {
    return { ok: false, reason: "颜色和数字都对不上,换一张试试。" };
  }

  const risky = card.kind === "wild4" && !wildDraw4Legal(me.hand.filter((c) => c.id !== cardId), state.color);
  if (risky && !RULES.ALLOW_W4_BLUFF) {
    return { ok: false, reason: "手上还有当前颜色,这张加四先留着。" };
  }

  const prevColor = state.color;
  me.hand.splice(idx, 1);
  state.pile.push(card);
  state.color = isWild(card) ? chosenColor ?? prevColor : (card.color as Color);
  state.moves++;
  state.drawnId = null;
  if (me.hand.length !== 1) me.called = false;
  if (state.oneCard?.player === player) state.oneCard = null;

  if (card.kind === "wild4") {
    const target = advanceTurn(
      { turn: state.turn, dir: state.dir, players: state.players.length },
      null
    ).turn;
    state.pendingW4 = { by: player, prevColor, hand: me.hand.map((c) => ({ ...c })), target };
  } else {
    state.pendingW4 = null;
  }

  if (isDrawCard(card)) {
    state.chain.push(card);
    state.chainKind = card.kind;
  }

  if (me.hand.length === 0) {
    state.finished = true;
    state.winner = player;
    note(state, "手牌出完啦!");
    return { ok: true, won: true, risky };
  }
  if (me.hand.length === 1 && !me.called) state.oneCard = { player };

  stepTurn(state, card);
  return { ok: true, risky };
}

export interface DrawResult {
  card: Card | null;
  /** 抽到的这张能不能立刻出(开关关掉时永远是 false) */
  playable: boolean;
}

/** 摸一张。抽到能出的牌时,按开关决定要不要留给他立刻出 */
export function drawFromDeck(state: HueState, player: number): DrawResult {
  if (state.finished || player !== state.turn) return { card: null, playable: false };
  if (chainPending(state)) return { card: null, playable: false };
  const before = state.color;
  const card = pullCard(state, player);
  state.moves++;
  if (!card) {
    stepTurn(state, null);
    return { card: null, playable: false };
  }
  // 抽牌等于告诉全场「我刚才接不上这个颜色」
  const me = state.players[player];
  if (!me.lacks.includes(before)) me.lacks.push(before);
  const playable = RULES.PLAY_AFTER_DRAW && canPlay(card, topCard(state), state.color);
  if (playable) {
    state.drawnId = card.id;
  } else {
    stepTurn(state, null);
  }
  return { card, playable };
}

/** 抽完之后不想出(或者本来就出不了),把这一手过掉 */
export function passAfterDraw(state: HueState, player: number): boolean {
  if (state.finished || player !== state.turn || state.drawnId === null) return false;
  stepTurn(state, null);
  return true;
}

/** 接不上整条链:一次抽完,然后这一家被跳过 */
export function takeChain(state: HueState, player: number): number {
  if (!chainPending(state) || player !== state.turn) return 0;
  const count = drawStack(state.chain);
  const got = drawMany(state, player, count);
  note(state, `一次抽了 ${got} 张,这条链断在这里。`);
  state.chain = [];
  state.chainKind = null;
  state.pendingW4 = null;
  state.moves++;
  stepTurn(state, null);
  return got;
}

/** 按下「就一张」。手上正好剩一张才算数 */
export function callOneCard(state: HueState, player: number): boolean {
  const me = state.players[player];
  if (!me || me.hand.length !== 1) return false;
  me.called = true;
  if (state.oneCard?.player === player) state.oneCard = null;
  note(state, "就一张!");
  return true;
}

export interface PenaltyResult {
  penalized: boolean;
  drawn: number;
}

/**
 * 点破「忘喊」。手上只剩一张、又没按过「就一张」的人被罚抽 2 张。
 * (函数名不带任何商标缩写,喊牌一律叫「就一张」。)
 */
export function oneCardPenalty(state: HueState, player: number): PenaltyResult {
  const me = state.players[player];
  if (!me || me.hand.length !== 1 || me.called) return { penalized: false, drawn: 0 };
  const drawn = drawMany(state, player, RULES.ONE_CARD_PENALTY);
  me.called = false;
  state.oneCard = null;
  note(state, `忘按「就一张」,罚抽 ${drawn} 张。`);
  return { penalized: true, drawn };
}

export interface ChallengeResult extends ChallengeOutcome {
  /** 真正抽牌的座位号 */
  seat: number;
  /** 真的抽到了几张 */
  drawn: number;
}

/** 质疑刚打出来的那张加四 */
export function resolveChallenge(state: HueState, challenger: number): ChallengeResult | null {
  const pending = state.pendingW4;
  if (!pending || pending.target !== challenger) return null;
  const outcome = challengeW4(pending.hand, pending.prevColor);
  let seat: number;
  let count: number;
  if (outcome.bluffed) {
    // 诈唬被抓:加四不生效,颜色退回原来的,出牌者自己抽 4
    seat = pending.by;
    count = RULES.W4_BLUFF_DRAW;
    state.chain = [];
    state.chainKind = null;
    state.color = pending.prevColor;
  } else {
    // 质疑失败:整条链照抽,再多抽 2 张,然后这一家被跳过
    seat = challenger;
    count = drawStack(state.chain) + (RULES.W4_FAIL_DRAW - RULES.W4_BLUFF_DRAW);
    state.chain = [];
    state.chainKind = null;
  }
  const drawn = drawMany(state, seat, count);
  state.pendingW4 = null;
  state.moves++;
  if (!outcome.bluffed) stepTurn(state, null);
  note(state, outcome.bluffed ? `质疑成立,加四不算数。` : `质疑失败,抽了 ${drawn} 张。`);
  return { ...outcome, count, seat, drawn };
}

/** 谁是下一家(界面显示「下一个轮到谁」用) */
export function nextSeat(state: HueState, from: number = state.turn): number {
  const n = state.players.length;
  return (((from + state.dir) % n) + n) % n;
}

/** 万能牌默认换成什么颜色:手上最多的那一色 */
export function bestColor(hand: readonly Card[], fallback: Color): Color {
  const count = new Map<Color, number>();
  for (const c of hand) {
    if (c.color) count.set(c.color, (count.get(c.color) ?? 0) + 1);
  }
  let best: Color | null = null;
  for (const color of COLORS) {
    const n = count.get(color) ?? 0;
    if (n > 0 && (best === null || n > (count.get(best) ?? 0))) best = color;
  }
  return best ?? fallback;
}

/** 把一串 id 还原成牌(关卡表里手牌是用 id 存的) */
export const idsToCards = cardsByIds;

/** 随机挑一个座位号(洗牌用的确定性随机) */
export function randomSeat(state: HueState, seats: number): number {
  const r = nextRandom(state.seed);
  state.seed = r.seed;
  return Math.floor(r.value * seats);
}
