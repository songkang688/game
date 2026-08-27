/**
 * 花开麻将 · 四人牌桌状态机（无 DOM，可直接跑模拟）。
 *
 * 对战 / 无尽 / 关卡残局 / AI 强度实验都用这一份引擎，界面只负责把它画出来。
 * 一局（一盘）的流程：
 *   摸牌 → 自家可选（暗杠 / 加杠 / 自摸和 / 打牌）→ 打出去
 *   → 其余三家报吃碰杠胡 → 按「胡 > 碰杠 > 吃」定优先级，胡按下家 > 对家 > 上家截和
 *   → 有人鸣牌就轮到他，没人就轮到下家摸牌；牌墙摸空算荒庄。
 *
 * 所有推进都要显式调用，方便界面按动画节奏一步一步走。
 */
import {
  DEFAULT_FAN_FLOOR,
  canHuWithFloor,
  ronPriority,
  scoreFans,
  settle,
  settleFalseHu,
  type FanHit
} from "./fan";
import { isHu } from "./hu";
import {
  chiOptions,
  kanOptions,
  makeChi,
  makeKan,
  makePon,
  ponOk,
  type Meld
} from "./melds";
import { isFlower, sortTiles, windId } from "./tiles";
import { deal, shuffleWall } from "./wall";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export const AI_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

export interface SeatState {
  seat: number;
  name: string;
  /** 手里的暗牌（不含刚摸到那张） */
  hand: number[];
  /** 刚摸到还没入手的那张，没有就是 -1 */
  drawn: number;
  melds: Meld[];
  discards: number[];
  flowers: number[];
  score: number;
  /** 人类玩家：鸭梨用 WASD+F/G，康康用方向键 +L/K */
  human?: "duo" | "star";
  tier: AiTier;
  /** 门风 1..4 */
  wind: number;
}

export type TablePhase = "draw" | "discard" | "claim" | "over";

export interface HandResult {
  kind: "hu" | "draw" | "falseHu";
  winner: number;
  discarder: number;
  selfDraw: boolean;
  fans: FanHit[];
  points: number;
  flowerPoints: number;
  delta: number[];
  /** 给界面直接用的一句话 */
  line: string;
}

export interface TableState {
  wall: number[];
  seats: SeatState[];
  turn: number;
  phase: TablePhase;
  roundWind: number;
  dealer: number;
  floor: number;
  lastDiscard: number;
  lastDiscardSeat: number;
  /** 刚才那一下是不是杠后补牌（决定杠上开花） */
  afterKan: boolean;
  /** 有人正在加杠，别家可以抢 */
  robbing: { seat: number; tile: number } | null;
  result: HandResult | null;
  /** 已经打出去几张（界面显示进度用） */
  turnCount: number;
}

export interface SeatSetup {
  name: string;
  tier?: AiTier;
  human?: "duo" | "star";
}

export interface TableOptions {
  seed: number;
  dealer?: number;
  roundWind?: number;
  floor?: number;
  seats: SeatSetup[];
  /** 直接指定牌墙（关卡残局用），给了就不洗牌 */
  wall?: number[];
  /** 直接指定四家起手（关卡残局用） */
  hands?: number[][];
  /** 直接指定四家副露（关卡残局用） */
  melds?: Meld[][];
}

const DEFAULT_NAMES = ["鸭梨", "糯糯", "康康", "云云"];

/** 开一盘 */
export function createTable(opts: TableOptions): TableState {
  const dealer = ((opts.dealer ?? 0) % 4 + 4) % 4;
  const roundWind = opts.roundWind ?? 1;
  const floor = opts.floor ?? DEFAULT_FAN_FLOOR;

  let wall: number[];
  let hands: number[][];
  let flowers: number[][] = [[], [], [], []];
  if (opts.wall && opts.hands) {
    wall = opts.wall.slice();
    hands = opts.hands.map((h) => sortTiles(h));
  } else {
    const dealt = deal(opts.wall ?? shuffleWall(opts.seed), dealer);
    wall = dealt.wall;
    hands = dealt.hands;
    flowers = dealt.flowers;
  }

  const seats: SeatState[] = [];
  for (let s = 0; s < 4; s++) {
    const setup = opts.seats[s] ?? {};
    const hand = hands[s] ?? [];
    const isDealer = s === dealer;
    seats.push({
      seat: s,
      name: setup.name ?? DEFAULT_NAMES[s],
      hand: isDealer && hand.length > 13 ? sortTiles(hand.slice(0, hand.length - 1)) : sortTiles(hand),
      drawn: isDealer && hand.length > 13 ? hand[hand.length - 1] : -1,
      melds: (opts.melds?.[s] ?? []).slice(),
      discards: [],
      flowers: flowers[s] ?? [],
      score: 0,
      human: setup.human,
      tier: setup.tier ?? "normal",
      wind: ((s - dealer + 4) % 4) + 1
    });
  }

  return {
    wall,
    seats,
    turn: dealer,
    phase: "discard",
    roundWind,
    dealer,
    floor,
    lastDiscard: -1,
    lastDiscardSeat: -1,
    afterKan: false,
    robbing: null,
    result: null,
    turnCount: 0
  };
}

/** 某家手上的全部暗牌（含刚摸到那张） */
export function fullHand(seat: SeatState): number[] {
  return seat.drawn >= 0 ? sortTiles([...seat.hand, seat.drawn]) : sortTiles(seat.hand);
}

/** 牌墙还剩几张 */
export function wallCount(state: TableState): number {
  return state.wall.length;
}

/** 摸到的是不是牌墙最后一张 */
function isLastWallTile(state: TableState): boolean {
  return state.wall.length === 0;
}

/**
 * 给某家摸一张（自动补花，花牌从牌尾补）。牌墙空了返回 null 并进入荒庄。
 * `fromBack` 为真时从牌尾摸（杠后补牌）。
 */
export function drawTile(state: TableState, seat: number, fromBack = false): number | null {
  const s = state.seats[seat];
  if (!s) return null;
  let guard = 0;
  for (;;) {
    const t = fromBack || guard > 0 ? state.wall.pop() : state.wall.shift();
    if (t === undefined) return null;
    if (isFlower(t)) {
      s.flowers.push(t);
      guard++;
      if (guard > 16) return null;
      continue;
    }
    s.drawn = t;
    return t;
  }
}

/** 自家摸完之后能做什么：暗杠 / 加杠 / 自摸和 */
export interface SelfOption {
  kind: "ankan" | "kakan" | "tsumo";
  tile: number;
}

export function selfOptions(state: TableState, seat: number): SelfOption[] {
  const s = state.seats[seat];
  if (!s || s.drawn < 0) return [];
  const hand = fullHand(s);
  const out: SelfOption[] = [];
  if (isHu(hand, null, s.melds)) {
    const r = scoreFans(huContext(state, seat, s.drawn, true));
    if (canHuWithFloor(r.points, state.floor)) out.push({ kind: "tsumo", tile: s.drawn });
  }
  for (const k of kanOptions(hand, s.melds)) {
    if (k.kind === "ankan" || k.kind === "kakan") out.push({ kind: k.kind, tile: k.tile });
  }
  return out;
}

/** 别人打出一张之后，某家能做什么 */
export interface ClaimOption {
  kind: "chi" | "pon" | "kan" | "ron";
  tile: number;
  /** 吃的时候要从手里拿出来的两张 */
  pair?: number[];
}

export function claimOptions(state: TableState, seat: number): ClaimOption[] {
  const tile = state.robbing ? state.robbing.tile : state.lastDiscard;
  const from = state.robbing ? state.robbing.seat : state.lastDiscardSeat;
  if (tile < 0 || from < 0 || from === seat) return [];
  const s = state.seats[seat];
  if (!s) return [];
  const out: ClaimOption[] = [];

  if (isHu(s.hand, tile, s.melds)) {
    const r = scoreFans(huContext(state, seat, tile, false, from));
    if (canHuWithFloor(r.points, state.floor)) out.push({ kind: "ron", tile });
  }
  // 抢杠只能和，不能吃碰
  if (state.robbing) return out;

  for (const k of kanOptions(s.hand, s.melds, tile, seat, from)) {
    out.push({ kind: "kan", tile });
    void k;
  }
  if (ponOk(s.hand, tile, seat, from)) out.push({ kind: "pon", tile });
  for (const pair of chiOptions(s.hand, tile, seat, from)) out.push({ kind: "chi", tile, pair });
  return out;
}

/** 组一份算番用的上下文 */
export function huContext(
  state: TableState,
  seat: number,
  winTile: number,
  selfDraw: boolean,
  discarder = -1
): Parameters<typeof scoreFans>[0] {
  const s = state.seats[seat];
  const hand = selfDraw ? fullHand(s) : sortTiles([...s.hand, winTile]);
  return {
    hand,
    melds: s.melds,
    winTile,
    selfDraw,
    seatWind: s.wind,
    roundWind: state.roundWind,
    flowers: s.flowers.length,
    afterKan: state.afterKan,
    robKan: Boolean(state.robbing),
    lastDraw: selfDraw && isLastWallTile(state),
    lastDiscard: !selfDraw && isLastWallTile(state),
    lastTile: !selfDraw && visibleCopies(state, winTile, discarder) >= 4
  };
}

/** 这张牌在场面上已经露了几张（判「和绝张」用） */
function visibleCopies(state: TableState, tile: number, discarder: number): number {
  let n = 0;
  for (const s of state.seats) {
    for (const d of s.discards) if (d === tile) n++;
    for (const m of s.melds) for (const t of m.tiles) if (t === tile) n++;
  }
  void discarder;
  return n;
}

/** 打出一张牌 */
export function discard(state: TableState, seat: number, tile: number): boolean {
  const s = state.seats[seat];
  if (!s || state.phase === "over") return false;
  if (s.drawn === tile) {
    s.drawn = -1;
  } else {
    const i = s.hand.indexOf(tile);
    if (i < 0) return false;
    s.hand.splice(i, 1);
    if (s.drawn >= 0) {
      s.hand.push(s.drawn);
      s.drawn = -1;
    }
  }
  s.hand = sortTiles(s.hand);
  s.discards.push(tile);
  state.lastDiscard = tile;
  state.lastDiscardSeat = seat;
  state.afterKan = false;
  state.turnCount++;
  state.phase = "claim";
  return true;
}

/** 执行一次鸣牌（吃 / 碰 / 明杠）。返回鸣牌之后该谁打牌 */
export function applyClaim(state: TableState, seat: number, opt: ClaimOption): boolean {
  const s = state.seats[seat];
  const from = state.lastDiscardSeat;
  if (!s || from < 0 || state.phase === "over") return false;
  const tile = opt.tile;

  const take = (ids: readonly number[]): boolean => {
    for (const id of ids) {
      const i = s.hand.indexOf(id);
      if (i < 0) return false;
      s.hand.splice(i, 1);
    }
    return true;
  };

  if (opt.kind === "chi") {
    if (!opt.pair || !take(opt.pair)) return false;
    s.melds.push(makeChi(tile, opt.pair, from));
  } else if (opt.kind === "pon") {
    if (!take([tile, tile])) return false;
    s.melds.push(makePon(tile, from));
  } else if (opt.kind === "kan") {
    if (!take([tile, tile, tile])) return false;
    s.melds.push(makeKan(tile, "minkan", from));
  } else {
    return false;
  }

  // 被鸣走的那张从牌河里拿掉，免得算「和绝张」时重复数
  const river = state.seats[from].discards;
  if (river[river.length - 1] === tile) river.pop();

  s.hand = sortTiles(s.hand);
  state.lastDiscard = -1;
  state.lastDiscardSeat = -1;
  state.turn = seat;

  if (opt.kind === "kan") {
    const got = drawTile(state, seat, true);
    state.afterKan = true;
    if (got === null) {
      finishDraw(state);
      return true;
    }
  }
  state.phase = "discard";
  return true;
}

/** 暗杠 / 加杠 */
export function applySelfKan(state: TableState, seat: number, opt: SelfOption): boolean {
  const s = state.seats[seat];
  if (!s || (opt.kind !== "ankan" && opt.kind !== "kakan")) return false;
  const hand = fullHand(s);
  if (opt.kind === "ankan") {
    let left = 4;
    const next: number[] = [];
    for (const t of hand) {
      if (t === opt.tile && left > 0) {
        left--;
        continue;
      }
      next.push(t);
    }
    if (left !== 0) return false;
    s.hand = sortTiles(next);
    s.drawn = -1;
    s.melds.push(makeKan(opt.tile, "ankan", seat));
  } else {
    const m = s.melds.find((x) => x.kind === "pon" && x.tiles[0] === opt.tile);
    if (!m) return false;
    const i = hand.indexOf(opt.tile);
    if (i < 0) return false;
    const next = hand.slice();
    next.splice(i, 1);
    s.hand = sortTiles(next);
    s.drawn = -1;
    m.kind = "kakan";
    m.tiles = [opt.tile, opt.tile, opt.tile, opt.tile];
    // 加杠可以被抢
    state.robbing = { seat, tile: opt.tile };
    state.phase = "claim";
    return true;
  }
  const got = drawTile(state, seat, true);
  state.afterKan = true;
  if (got === null) {
    finishDraw(state);
    return true;
  }
  state.phase = "discard";
  return true;
}

/** 抢杠没人要，补牌继续 */
export function resolveRobbing(state: TableState): void {
  if (!state.robbing) return;
  const seat = state.robbing.seat;
  state.robbing = null;
  const got = drawTile(state, seat, true);
  state.afterKan = true;
  if (got === null) {
    finishDraw(state);
    return;
  }
  state.turn = seat;
  state.phase = "discard";
}

/** 和牌结算 */
export function applyHu(state: TableState, seat: number, selfDraw: boolean, discarder = -1): HandResult {
  const winTile = selfDraw
    ? state.seats[seat].drawn
    : state.robbing
      ? state.robbing.tile
      : state.lastDiscard;
  const ctx = huContext(state, seat, winTile, selfDraw, discarder);
  const scored = scoreFans(ctx);
  const from = selfDraw ? -1 : state.robbing ? state.robbing.seat : state.lastDiscardSeat;
  const s = settle(seat, selfDraw, scored.points, from, scored.flowerPoints);
  for (let i = 0; i < 4; i++) state.seats[i].score += s.delta[i];
  const result: HandResult = {
    kind: "hu",
    winner: seat,
    discarder: from,
    selfDraw,
    fans: scored.fans,
    points: scored.points,
    flowerPoints: scored.flowerPoints,
    delta: s.delta,
    line: selfDraw
      ? `${state.seats[seat].name} 自摸开花,${scored.points} 番！`
      : `${state.seats[seat].name} 和了 ${state.seats[from]?.name ?? ""} 打的牌,${scored.points} 番！`
  };
  state.result = result;
  state.phase = "over";
  state.robbing = null;
  return result;
}

/** 错和：够不着门槛还喊胡，赔每家罚分 */
export function applyFalseHu(state: TableState, seat: number, each?: number): HandResult {
  const s = settleFalseHu(seat, each);
  for (let i = 0; i < 4; i++) state.seats[i].score += s.delta[i];
  const result: HandResult = {
    kind: "falseHu",
    winner: -1,
    discarder: -1,
    selfDraw: false,
    fans: [],
    points: 0,
    flowerPoints: 0,
    delta: s.delta,
    line: `${state.seats[seat].name} 的番数还不够,这局差一点点,下一局把番凑够就好啦。`
  };
  state.result = result;
  state.phase = "over";
  return result;
}

/** 荒庄 */
export function finishDraw(state: TableState): HandResult {
  const result: HandResult = {
    kind: "draw",
    winner: -1,
    discarder: -1,
    selfDraw: false,
    fans: [],
    points: 0,
    flowerPoints: 0,
    delta: [0, 0, 0, 0],
    line: "牌墙摸完啦,这一盘算平局,大家都不丢分。"
  };
  state.result = result;
  state.phase = "over";
  return result;
}

/** 轮到下一家摸牌；牌墙空了就荒庄 */
export function nextTurn(state: TableState): void {
  if (state.phase === "over") return;
  state.turn = (state.turn + 1) % 4;
  state.lastDiscard = -1;
  state.lastDiscardSeat = -1;
  state.afterKan = false;
  const got = drawTile(state, state.turn);
  if (got === null) {
    finishDraw(state);
    return;
  }
  state.phase = "discard";
}

/**
 * 把四家对「刚打出那张牌」的意向收齐，按国标定优先级：
 * 和 > 碰 / 杠 > 吃；多家同时报和时按下家 > 对家 > 上家截和。
 */
export function resolveClaims(
  state: TableState,
  wants: Array<{ seat: number; opt: ClaimOption } | null>
): { seat: number; opt: ClaimOption } | null {
  const from = state.robbing ? state.robbing.seat : state.lastDiscardSeat;
  const real = wants.filter((w): w is { seat: number; opt: ClaimOption } => Boolean(w));
  const rons = real.filter((w) => w.opt.kind === "ron");
  if (rons.length > 0) {
    const pick = ronPriority(rons.map((r) => r.seat), from);
    return rons.find((r) => r.seat === pick) ?? rons[0];
  }
  const kan = real.find((w) => w.opt.kind === "kan");
  if (kan) return kan;
  const pon = real.find((w) => w.opt.kind === "pon");
  if (pon) return pon;
  const chi = real.find((w) => w.opt.kind === "chi");
  return chi ?? null;
}

/** 名次（花分从高到低），并列按座位号 */
export function ranking(state: TableState): number[] {
  return state.seats
    .map((s) => ({ seat: s.seat, score: s.score }))
    .sort((a, b) => b.score - a.score || a.seat - b.seat)
    .map((x) => x.seat);
}

/** 圈风 / 门风的中文名 */
export const WIND_NAMES = ["东", "南", "西", "北"];

export function windName(n: number): string {
  return WIND_NAMES[(((n - 1) % 4) + 4) % 4];
}

/** 门风 id（算番用） */
export function seatWindId(seat: SeatState): number {
  return windId(seat.wind);
}
