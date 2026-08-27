/**
 * 梨康地产 · 四档本机 AI。
 *
 * | 档 | 打法 |
 * | --- | --- |
 * | 菜鸟 | 见地就买，买到没钱为止；从不留周转金 |
 * | 普通 | 会优先补齐同色组，留一点周转金 |
 * | 高手 | 卡住对手的关键色组、会抵押周转、按租金期望估值 |
 * | 地狱 | 拍卖会抬价、会花钱把关键地换过来（有让步上限，不会死循环） |
 *
 * AI 只实现 `economy.ts` 的 `Policy` 接口，一行 DOM 都不碰。
 */
import { GROUP_TILES, MAX_HOUSES, groupInfo, houseCostOf, mortgageValue, tileAt, unmortgageCost } from "./board";
import {
  BANK,
  deedsOf,
  fullSetActive,
  ownsColorSet,
  stationCount,
  utilCount,
  type EstateState
} from "./rent";
import {
  FULL_RULES,
  advanceTurn,
  createState,
  playTurn,
  runMatch,
  type JailChoice,
  type MatchResult,
  type MatchRules,
  type Policy,
  type SeatSpec,
  type TurnContext
} from "./economy";
import { makeDeck } from "./cards";
import { mulberry32 } from "../level99";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟糯糯",
  normal: "普通云云",
  pro: "高手康康",
  hell: "地狱月月"
};

export const AI_TIER_DESC: Record<AiTier, string> = {
  rookie: "见地就买，很快就没现金了。",
  normal: "会先补齐同色组，手里留一点周转金。",
  pro: "会卡你的关键色组，缺钱就抵押周转。",
  hell: "拍卖抬价、花钱换关键地，非常难缠。"
};

interface TierParams {
  /** 手上至少留多少现金 */
  reserve: number;
  /** 拍卖时最多出到估值的几倍 */
  bidRatio: number;
  /** 会不会盖房 */
  builds: boolean;
  /** 会不会抵押周转、赎回 */
  manages: boolean;
  /** 会不会花钱去换关键地 */
  trades: boolean;
  /** 换地时最多加价到估值的几倍（让步上限，避免两个 AI 无限抬价） */
  tradeCap: number;
}

const PARAMS: Record<AiTier, TierParams> = {
  // 菜鸟连房子都不盖:钱全变成空地,收不到几个租
  rookie: { reserve: 0, bidRatio: 1, builds: false, manages: false, trades: false, tradeCap: 1 },
  normal: { reserve: 140, bidRatio: 1, builds: true, manages: false, trades: false, tradeCap: 1 },
  pro: { reserve: 170, bidRatio: 1.1, builds: true, manages: true, trades: true, tradeCap: 1.15 },
  hell: { reserve: 200, bidRatio: 1.25, builds: true, manages: true, trades: true, tradeCap: 1.5 }
};

/** 谁离垄断这个色组最近（返回持有块数最多的对手持有数） */
function rivalBest(state: EstateState, playerId: number, pos: number): number {
  const group = tileAt(pos).group;
  if (!group) return 0;
  const counts = new Map<number, number>();
  for (const p of GROUP_TILES[group]) {
    const o = state.tiles[p].owner;
    if (o !== BANK && o !== playerId) counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  return counts.size === 0 ? 0 : Math.max(...counts.values());
}

/**
 * 一块地在某人眼里值多少星币。
 * 底价是售价，按「补齐色组的进度」「能不能卡住对手」「车站设施的规模效应」往上加。
 */
export function valueOf(state: EstateState, playerId: number, pos: number, tier: AiTier): number {
  const tile = tileAt(pos);
  const price = tile.price ?? 0;
  if (price <= 0) return 0;
  // 菜鸟根本不估值:标价多少就是多少
  if (tier === "rookie") return price;
  const par = PARAMS[tier];
  let mult = 1;

  if (tile.kind === "prop" && tile.group) {
    const all = GROUP_TILES[tile.group];
    const mine = all.filter((p) => state.tiles[p].owner === playerId).length;
    const need = all.length - mine;
    if (need <= 1) mult += 1.1;
    else if (need === 2 && all.length === 3) mult += 0.35;
    // 高手 / 地狱还会算「拦下对手」的价值
    if (par.trades) {
      const rival = rivalBest(state, playerId, pos);
      if (rival >= all.length - 1) mult += 0.7;
      else if (rival > 0) mult += 0.15;
      // 租金越高的色组越值钱
      mult += Math.min(0.4, ((tile.rent?.[3] ?? 0) / 1600) * 0.4);
    }
  } else if (tile.kind === "station") {
    mult += 0.25 * stationCount(state, playerId);
  } else if (tile.kind === "util") {
    mult += 0.2 * utilCount(state, playerId);
  }
  return Math.round(price * mult);
}

/** 每档 AI 的买地判断 */
export function wantBuy(state: EstateState, playerId: number, pos: number, tier: AiTier): boolean {
  const p = state.players[playerId];
  const price = tileAt(pos).price ?? 0;
  if (!p || price <= 0 || p.cash < price) return false;
  if (tier === "rookie") return true;
  const par = PARAMS[tier];
  const value = valueOf(state, playerId, pos, tier);
  // 留够周转金；这块地明显划算时可以少留一点
  const keep = value >= price * 1.6 ? Math.round(par.reserve * 0.4) : par.reserve;
  return p.cash - price >= keep;
}

/** 拍卖心理价位 */
export function bidLimit(state: EstateState, playerId: number, pos: number, tier: AiTier): number {
  const p = state.players[playerId];
  if (!p) return 0;
  const par = PARAMS[tier];
  const value = valueOf(state, playerId, pos, tier);
  const raw = Math.round(value * par.bidRatio);
  const affordable = Math.max(0, p.cash - Math.round(par.reserve * 0.5));
  return Math.max(0, Math.min(raw, affordable));
}

/**
 * 掷骰前想盖的房：只在自己垄断且没抵押的色组里，从房子最少的那块开始盖，
 * 一路盖到现金掉到周转金为止。返回的是「按顺序尝试」的格号列表。
 */
export function buildPlan(state: EstateState, playerId: number, tier: AiTier): number[] {
  const par = PARAMS[tier];
  if (!par.builds) return [];
  const p = state.players[playerId];
  if (!p) return [];
  const groups = new Set(
    deedsOf(state, playerId)
      .map((pos) => tileAt(pos).group)
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
  );
  const owned = [...groups].filter((g) => fullSetActive(state, playerId, g));
  if (owned.length === 0) return [];

  // 优先把租金最高的色组堆起来
  owned.sort((a, b) => {
    const ra = Math.max(...GROUP_TILES[a].map((pos) => tileAt(pos).rent?.[3] ?? 0));
    const rb = Math.max(...GROUP_TILES[b].map((pos) => tileAt(pos).rent?.[3] ?? 0));
    return rb - ra;
  });

  const houses = new Map<number, number>();
  for (const g of owned) for (const pos of GROUP_TILES[g]) houses.set(pos, state.tiles[pos].houses);
  let cash = p.cash;
  const plan: number[] = [];

  for (let guard = 0; guard < 24; guard++) {
    let picked = -1;
    for (const g of owned) {
      const tiles = GROUP_TILES[g];
      const cost = groupInfo(g).houseCost;
      if (cash - cost < par.reserve) continue;
      const min = Math.min(...tiles.map((pos) => houses.get(pos) ?? 0));
      if (min >= MAX_HOUSES) continue;
      const target = tiles.find((pos) => (houses.get(pos) ?? 0) === min);
      if (target === undefined) continue;
      picked = target;
      cash -= cost;
      houses.set(target, min + 1);
      break;
    }
    if (picked < 0) break;
    plan.push(picked);
  }
  return plan;
}

/** 手头宽裕就把自己的抵押地赎回来（只有高手 / 地狱会做） */
export function redeemPlan(state: EstateState, playerId: number, tier: AiTier): number[] {
  const par = PARAMS[tier];
  if (!par.manages) return [];
  const p = state.players[playerId];
  if (!p) return [];
  let cash = p.cash;
  const out: number[] = [];
  const mine = deedsOf(state, playerId)
    .filter((pos) => state.tiles[pos].mortgaged)
    .sort((a, b) => unmortgageCost(a) - unmortgageCost(b));
  for (const pos of mine) {
    const cost = unmortgageCost(pos);
    if (cash - cost < par.reserve + 200) break;
    cash -= cost;
    out.push(pos);
  }
  return out;
}

/**
 * 抵押周转：手上已经有垄断色组、却凑不出房钱时，
 * 把「不在任何垄断组里」的零散地皮抵押掉换现金去盖房。
 * 空地租金再高也比不过一排小屋，这一手是高手和地狱的主要优势。
 */
export function financePlan(state: EstateState, playerId: number, tier: AiTier): number[] {
  const par = PARAMS[tier];
  if (!par.manages || !par.builds) return [];
  const p = state.players[playerId];
  if (!p) return [];

  const mine = deedsOf(state, playerId);
  const hot = mine.filter((pos) => {
    const g = tileAt(pos).group;
    return g && fullSetActive(state, playerId, g) && state.tiles[pos].houses < MAX_HOUSES;
  });
  if (hot.length === 0) return [];
  const cheapestHouse = Math.min(...hot.map((pos) => houseCostOf(pos)));
  // 目标：凑出两栋房的钱，还留住周转金
  const want = cheapestHouse * 2 + par.reserve;
  if (p.cash >= want) return [];

  const spare = mine
    .filter((pos) => {
      const st = state.tiles[pos];
      if (st.mortgaged || st.houses > 0) return false;
      const g = tileAt(pos).group;
      return !g || !ownsColorSet(state, playerId, g);
    })
    .sort((a, b) => mortgageValue(a) - mortgageValue(b));

  const out: number[] = [];
  let cash = p.cash;
  for (const pos of spare) {
    if (cash >= want) break;
    cash += mortgageValue(pos);
    out.push(pos);
  }
  return out;
}

/** 在小黑屋里怎么出来 */
export function jailChoice(state: EstateState, playerId: number, tier: AiTier): JailChoice {
  const p = state.players[playerId];
  if (!p) return "roll";
  if (p.outCards > 0) return "card";
  // 开局地还没买完，早点出来抢地；后期在里面反而安全，先靠掷骰碰运气
  const bought = state.tiles.filter((t) => t.owner !== BANK).length;
  const early = bought < 14;
  if (tier === "rookie") return p.cash >= 50 ? "pay" : "roll";
  if (early && p.cash >= 300) return "pay";
  return "roll";
}

/**
 * 别人走投无路要卖地，这一档愿意花多少钱接。
 * 只有高手 / 地狱会接，而且有让步上限：最多加到估值的 tradeCap 倍，绝不无限抬价。
 */
export function rescueOffer(state: EstateState, playerId: number, pos: number, tier: AiTier): number {
  const par = PARAMS[tier];
  const p = state.players[playerId];
  if (!p) return 0;
  if (!par.trades) {
    // 菜鸟见地就买，但只肯出抵押价那点钱
    return tier === "rookie" && p.cash > mortgageValue(pos) ? mortgageValue(pos) : 0;
  }
  const value = valueOf(state, playerId, pos, tier);
  const cap = Math.round(Math.min(value * par.tradeCap, Math.max(0, p.cash - par.reserve)));
  return cap > 0 ? cap : 0;
}

/** 接手别人的抵押地时，钱够就当场赎回，让它马上能收租 */
export function redeemOnTake(state: EstateState, playerId: number, pos: number, tier: AiTier): boolean {
  const p = state.players[playerId];
  if (!p) return false;
  const par = PARAMS[tier];
  if (!par.manages) return false;
  return p.cash - unmortgageCost(pos) >= par.reserve;
}

/** 组装一档 AI 的完整策略 */
export function makePolicy(tier: AiTier): Policy {
  return {
    wantBuy: (state, id, pos) => wantBuy(state, id, pos, tier),
    bidLimit: (state, id, pos) => bidLimit(state, id, pos, tier),
    buildPlan: (state, id) => buildPlan(state, id, tier),
    jailChoice: (state, id) => jailChoice(state, id, tier),
    rescueOffer: (state, id, pos) => rescueOffer(state, id, pos, tier),
    redeemOnTake: (state, id, pos) => redeemOnTake(state, id, pos, tier),
    redeemPlan: (state, id) => redeemPlan(state, id, tier),
    financePlan: (state, id) => financePlan(state, id, tier)
  };
}

// ---------------------------------------------------------------------------
// 无头对局：AI 强度对比、188 关可解性验证都用它
// ---------------------------------------------------------------------------

export interface HeadlessOptions {
  seed: number;
  tiers: AiTier[];
  cash?: number;
  rules?: Partial<MatchRules>;
  /** 固定骰序（教学关用） */
  scriptedDice?: Array<[number, number]>;
  /** 预置地契 */
  preset?: Array<{ tile: number; owner: number; houses?: number; mortgaged?: boolean }>;
  /** 每个座位单独的起始现金（留空的座位用统一的 cash） */
  cashes?: Array<number | undefined>;
  names?: string[];
}

export function buildContext(state: EstateState, opts: HeadlessOptions): TurnContext {
  const rand = mulberry32(opts.seed >>> 0);
  const policies = opts.tiers.map((t) => makePolicy(t));
  const cursor = { i: 0 };
  return {
    rand,
    policyOf: (id) => policies[id] ?? policies[0],
    decks: { chance: makeDeck("chance", rand), fate: makeDeck("fate", rand) },
    rules: { ...FULL_RULES, ...(opts.rules ?? {}) },
    scriptedDice: opts.scriptedDice,
    diceCursor: cursor
  };
}

const SEAT_EMOJI = ["🌸", "⭐", "🍡", "☁️"];
const SEAT_NAME = ["鸭梨", "康康", "糯糯", "云云"];

export function buildState(opts: HeadlessOptions): EstateState {
  const seats: SeatSpec[] = opts.tiers.map((_, i) => ({
    name: opts.names?.[i] ?? SEAT_NAME[i % SEAT_NAME.length],
    emoji: SEAT_EMOJI[i % SEAT_EMOJI.length],
    cash: opts.cashes?.[i] ?? opts.cash
  }));
  const state = createState(seats, opts.cash);
  for (const pre of opts.preset ?? []) {
    const st = state.tiles[pre.tile];
    if (!st) continue;
    st.owner = pre.owner;
    st.houses = Math.max(0, Math.min(MAX_HOUSES, pre.houses ?? 0));
    st.mortgaged = Boolean(pre.mortgaged);
  }
  return state;
}

/** 跑一整局，返回结果 */
export function headlessMatch(opts: HeadlessOptions): MatchResult & { state: EstateState } {
  const state = buildState(opts);
  const ctx = buildContext(state, opts);
  const result = runMatch(state, ctx);
  return { ...result, state };
}

/** 跑 n 局，统计每个座位赢了几次（固定 seed 可复现） */
export function tierSeries(tiers: AiTier[], games: number, baseSeed = 4100, rules?: Partial<MatchRules>): number[] {
  const wins = new Array<number>(tiers.length).fill(0);
  for (let g = 0; g < games; g++) {
    const r = headlessMatch({ seed: baseSeed + g * 97, tiers, rules });
    if (r.winner >= 0) wins[r.winner]++;
  }
  return wins;
}

/** 让某一个座位手动走一步（界面用），其余交给 AI */
export function stepOneTurn(state: EstateState, ctx: TurnContext): void {
  playTurn(state, state.turn, ctx);
  if (!state.over) advanceTurn(state);
}

/** 一句话介绍这一档 */
export function tierLine(tier: AiTier): string {
  return `${AI_TIER_LABELS[tier]}：${AI_TIER_DESC[tier]}`;
}

/** AI 会不会在这一局里主动垄断（给攻略与测试读） */
export function tierBuilds(tier: AiTier): boolean {
  return PARAMS[tier].builds;
}

/** 这一档的周转金底线 */
export function tierReserve(tier: AiTier): number {
  return PARAMS[tier].reserve;
}

/** 这一档换地时的让步上限倍数 */
export function tierTradeCap(tier: AiTier): number {
  return PARAMS[tier].tradeCap;
}

/** 某人现在垄断了几个色组（界面徽章 + 测试都用） */
export function fullSetCount(state: EstateState, playerId: number): number {
  let n = 0;
  for (const g of GROUP_TILES.cotton.length ? Object.keys(GROUP_TILES) : []) {
    if (ownsColorSet(state, playerId, g as keyof typeof GROUP_TILES)) n++;
  }
  return n;
}

/** 这一格盖满一栋要多少钱（界面按钮上要显示） */
export function buildCostAt(pos: number): number {
  return houseCostOf(pos);
}
