/**
 * 朵星地产 · 188 关残局战役（纯数据 + 纯函数）。
 *
 * 八章把整套经济系统一件一件拆开教：先只买地，再垄断加倍，然后平均建屋、
 * 机会命运、小黑屋、抵押周转、拍卖行，最后是逼对手破产的残局。
 *
 * 每一关都是「给定局面 + 固定 seed（部分关另给固定骰序）+ N 回合内达成目标」，
 * 所以「这一关到底解不解得开」是可以用参考解法一关一关跑出来的，
 * `levels.test.ts` 会把 188 关全部回放一遍。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import { COLOR_GROUPS, GROUP_TILES, START_CASH, STATION_TILES, type ColorGroup } from "./board";
import { advanceTurn, playTurn, type MatchRules } from "./economy";
import { deedsOf, netWorth, type EstateState } from "./rent";
import { buildContext, buildState, type AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "买地入门", emoji: "🏷️", color: "#FDE8D2", desc: "先只练一件事：看清价钱，把划算的地买下来。", size: 24 },
  { name: "同色小巷", emoji: "🎨", color: "#F7DCE8", desc: "凑齐一整条街，空地租金立刻翻倍。", size: 24 },
  { name: "小屋工地", emoji: "🏠", color: "#DCEFDA", desc: "垄断之后开始盖屋，而且必须平均着盖。", size: 24 },
  { name: "机会命运", emoji: "🎡", color: "#DFE6F8", desc: "抽卡会打乱计划，学会给意外留一点钱。", size: 24 },
  { name: "小黑屋", emoji: "🪑", color: "#E7E2F2", desc: "被请进反思角照样能收租，出来的方式有三种。", size: 22 },
  { name: "抵押周转", emoji: "🏦", color: "#D6EAF2", desc: "现金见底不等于输，抵押是用来救急的。", size: 22 },
  { name: "拍卖行", emoji: "🔨", color: "#F9E7C0", desc: "你不买，它就上拍卖台，喊价要留分寸。", size: 24 },
  { name: "破产终局", emoji: "🏆", color: "#FBDDD3", desc: "残局：算准租金，把对手的钱包一点点收干净。", size: 24 }
];

/** 关号（0 起）→ 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 章节第一关的关号（0 起） */
export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

export type LevelGoal =
  | { kind: "netWorth"; target: number; minBuys: number }
  | { kind: "bankrupt"; who: number; minBuys: number };

export interface PresetDeed {
  tile: number;
  owner: number;
  houses?: number;
  mortgaged?: boolean;
}

export interface EstateLevel {
  level: number;
  chapter: number;
  seed: number;
  /** 座位数（含朵朵） */
  seats: number;
  /** 每个座位的起始现金 */
  cashes: number[];
  /** 对手档位（下标 0 是朵朵自己，参考解法用高手打） */
  tiers: AiTier[];
  preset: PresetDeed[];
  rules: MatchRules;
  goal: LevelGoal;
  /** 几个回合之内要达成 */
  rounds: number;
  /** 教学关的固定骰序 */
  scriptedDice?: Array<[number, number]>;
}

/** 参考解法用的档位：朵朵这一格永远按「高手」打 */
const SOLVER_TIER: AiTier = "pro";

/** 每一章开放哪些机制 */
function rulesFor(ci: number, rounds: number): MatchRules {
  return {
    build: ci >= 2,
    cards: ci >= 3,
    jail: ci >= 4,
    mortgage: ci >= 5,
    auction: ci >= 6,
    fullSetDouble: ci >= 1,
    maxRounds: rounds
  };
}

/** 每一章配几个对手、什么档位 */
function seatsFor(ci: number, lv: number): { seats: number; tiers: AiTier[] } {
  const seats = ci <= 1 ? 2 : ci <= 5 ? 3 : 4;
  const ladder: AiTier[][] = [
    ["rookie"],
    ["rookie"],
    ["rookie", "normal"],
    ["normal", "rookie"],
    ["normal", "normal"],
    ["normal", "pro"],
    ["pro", "normal", "rookie"],
    ["pro", "hell", "normal"]
  ];
  const base = ladder[ci];
  const tiers: AiTier[] = [SOLVER_TIER];
  for (let i = 0; i < seats - 1; i++) tiers.push(base[(i + lv) % base.length]);
  return { seats, tiers };
}

function groupAt(i: number): ColorGroup {
  return COLOR_GROUPS[((i % COLOR_GROUPS.length) + COLOR_GROUPS.length) % COLOR_GROUPS.length].id;
}

/**
 * 预置局面。八章各有各的开局形状，
 * 但都由关号推导，所以同一关每次开出来一模一样。
 */
function presetFor(ci: number, lv: number, inCh: number, seats: number): PresetDeed[] {
  const mine = groupAt(lv);
  const theirs = groupAt(lv + 3);
  const third = groupAt(lv + 5);
  const out: PresetDeed[] = [];
  const push = (tiles: readonly number[], owner: number, houses = 0): void => {
    for (const t of tiles) out.push({ tile: t, owner, houses });
  };

  switch (ci) {
    case 0:
      // 只买地：双方各拿一块，剩下的靠自己去买
      out.push({ tile: GROUP_TILES[mine][0], owner: 0 });
      out.push({ tile: GROUP_TILES[theirs][0], owner: 1 });
      break;
    case 1:
      // 同色小巷：朵朵差一块就垄断，对手已经垄断了另一组
      push(GROUP_TILES[mine].slice(0, GROUP_TILES[mine].length - 1), 0);
      push(GROUP_TILES[theirs], 1);
      break;
    case 2:
      // 小屋工地：朵朵开局就垄断，可以马上开工
      push(GROUP_TILES[mine], 0);
      push(GROUP_TILES[theirs].slice(0, 1), 1);
      break;
    case 3:
      // 机会命运：两边都有一组，抽卡决定谁更顺
      push(GROUP_TILES[mine], 0);
      push(GROUP_TILES[theirs], 1);
      out.push({ tile: STATION_TILES[inCh % STATION_TILES.length], owner: 0 });
      break;
    case 4:
      // 小黑屋：朵朵有一组带房，对手守着车站
      push(GROUP_TILES[mine], 0, 1);
      push(GROUP_TILES[theirs].slice(0, 2), 1);
      out.push({ tile: STATION_TILES[inCh % STATION_TILES.length], owner: 1 });
      break;
    case 5:
      // 抵押周转：地不少，现金很紧，不抵押撑不过去
      push(GROUP_TILES[mine], 0, 1);
      push(GROUP_TILES[third], 0);
      push(GROUP_TILES[theirs], 1, 1);
      break;
    case 6:
      // 拍卖行：场上留着大片无主地，谁喊价有分寸谁赢
      push(GROUP_TILES[mine], 0);
      push(GROUP_TILES[theirs].slice(0, 1), 1);
      if (seats > 3) push(GROUP_TILES[third].slice(0, 1), 2);
      break;
    default:
      // 破产终局：朵朵手上是带房的大街，对手兜里只剩一点点钱
      push(GROUP_TILES[mine], 0, 3);
      push(GROUP_TILES[third], 0, 2);
      out.push({ tile: STATION_TILES[inCh % STATION_TILES.length], owner: 0 });
      out.push({ tile: STATION_TILES[(inCh + 1) % STATION_TILES.length], owner: 0 });
      break;
  }
  return out;
}

/** 每一章朵朵的起始现金 */
const START_CASH_BY_CHAPTER = [START_CASH, START_CASH, 1200, 1200, 1100, 320, 1400, 900];

/** 净资产目标的涨幅：越往后要求越高 */
const GROWTH_BASE = [0.05, 0.06, 0.07, 0.06, 0.06, 0.1, 0.07, 0];
const GROWTH_RAMP = [0.05, 0.06, 0.07, 0.06, 0.06, 0.12, 0.07, 0];

/** 每一章给多少回合 */
const ROUNDS_BY_CHAPTER = [14, 14, 16, 16, 18, 18, 18, 26];

/**
 * 本关至少要自己掏钱拿下几处产业。
 *
 * 只看净资产的话，绕圈领工资就能把线蹭过去：棋盘 40 格、过起点白拿 200 星币，
 * 而各章的涨幅只有 5% ～ 22%，一圈工资往往就够了。加这道门是要孩子
 * 至少真的下场买两块地，本章教的东西才用得上。
 * 数的是 `deedsBought`（买地 / 拍到 / 接盘），开局赠地和对手收摊后转过来的地都不算 ——
 * 第 8 章残局尤其要紧：坐着等对手自己付破产，地会整批转到朵朵名下。
 * 第 6 章「抵押周转」开局只有 320 星币，买第二块地会直接把自己压破产，所以只要 1 处。
 * 188 关都能在回合预算内买够，由 `levels.test.ts` 的逐关回放兜底。
 */
const BUYS_BY_CHAPTER = [2, 2, 2, 2, 2, 1, 2, 2];

/**
 * 第 8 章残局给对手的起始现金底数。
 *
 * 原来是 150：对手常常第 1 ～ 2 个回合就把自己付破产了，朵朵还没轮到第二次掷骰，
 * 这一章要教的「算准租金、一点点收干净」根本来不及发生。抬到这个数之后，
 * 对手至少扛得住几脚租金，残局才有得算。
 */
const CH8_RIVAL_CASH = 320;

/**
 * 少数关卡按公式生成后跑不通（骰运太差 / 对手开局就抢走关键地），
 * 这里给它们换一个 seed。数值由 `levels.test.ts` 的回放测试反查出来。
 */
const SEED_FIX: Readonly<Record<number, number>> = {
  59: 1,
  60: 4,
  61: 3,
  62: 1,
  63: 1,
  76: 4,
  79: 2,
  81: 5,
  82: 1,
  84: 4,
  86: 1,
  88: 2,
  90: 1,
  92: 3,
  93: 1,
  95: 2,
  100: 2,
  101: 2,
  116: 1,
  118: 4,
  122: 1,
  123: 1,
  124: 3,
  126: 2,
  127: 2,
  129: 4,
  131: 3,
  132: 1,
  134: 5,
  135: 4,
  136: 1,
  137: 2,
  138: 3,
  139: 3,
  182: 1
};

export function levelConfig(level: number): EstateLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - chapterStartOf(ci);
  const size = Math.max(1, CHAPTERS[ci].size);
  const ramp = inCh / Math.max(1, size - 1);

  const { seats, tiers } = seatsFor(ci, lv);
  const preset = presetFor(ci, lv, inCh, seats);
  const rounds = ROUNDS_BY_CHAPTER[ci] + Math.round(ramp * 4);
  const rules = rulesFor(ci, rounds);

  const myCash = Math.round(START_CASH_BY_CHAPTER[ci] * (1 - ramp * 0.15));
  const cashes = [myCash];
  for (let i = 1; i < seats; i++) {
    cashes.push(ci === 7 ? Math.round(CH8_RIVAL_CASH + inCh * 6 + i * 40) : Math.round(START_CASH * (0.9 + ramp * 0.25)));
  }

  const seed = 9300 + lv * 137 + (SEED_FIX[lv] ?? 0);
  const goal: LevelGoal =
    ci === 7
      ? { kind: "bankrupt", who: 1, minBuys: BUYS_BY_CHAPTER[ci] }
      : { kind: "netWorth", target: 0, minBuys: BUYS_BY_CHAPTER[ci] };

  const cfg: EstateLevel = { level: lv, chapter: ci, seed, seats, cashes, tiers, preset, rules, goal, rounds };

  if (goal.kind === "netWorth") {
    const start = startingNetWorth(cfg);
    const growth = GROWTH_BASE[ci] + ramp * GROWTH_RAMP[ci];
    goal.target = Math.round(start * (1 + growth));
  }
  return cfg;
}

/** 开局摆在朵朵名下的产业有几处 */
export function startingDeeds(cfg: EstateLevel): number {
  return cfg.preset.filter((d) => d.owner === 0).length;
}

/**
 * 达标判定：钱到线**而且**本局真的自己买够了地。
 *
 * 只看净资产的话，一直点「掷骰」绕圈领工资就能把线蹭过去 ——
 * 这一款教的买地 / 建屋 / 抵押 / 拍卖一次都用不上。所以每关都另外要求
 * 朵朵在本关**自己掏钱拿下 `goal.minBuys` 处产业**；
 * 开局赠地、对手收摊后转过来的地都不算数。
 */
export function goalReached(cfg: EstateLevel, state: EstateState): boolean {
  if ((state.players[0]?.deedsBought ?? 0) < cfg.goal.minBuys) return false;
  if (cfg.goal.kind === "bankrupt") return Boolean(state.players[cfg.goal.who]?.bankrupt);
  return netWorth(state, 0) >= cfg.goal.target;
}

/** 开局时朵朵的净资产（目标线以它为基准） */
export function startingNetWorth(cfg: EstateLevel): number {
  const state = buildState({
    seed: cfg.seed,
    tiers: cfg.tiers,
    cashes: cfg.cashes,
    preset: cfg.preset
  });
  return netWorth(state, 0);
}

export interface LevelRun {
  win: boolean;
  /** 达成时是第几回合 */
  rounds: number;
  /** 朵朵最终净资产 */
  netWorth: number;
  /** 最高摸到过多少净资产 */
  peak: number;
  note: string;
}

/**
 * 参考解法回放：朵朵这一格交给「高手」策略自动打，看能不能在限定回合内达标。
 * 测试拿它证明 188 关每一关都真的解得开。
 */
export function solveLevel(level: number): LevelRun {
  const cfg = levelConfig(level);
  const state = buildState({
    seed: cfg.seed,
    tiers: cfg.tiers,
    cashes: cfg.cashes,
    preset: cfg.preset
  });
  const ctx = buildContext(state, {
    seed: cfg.seed,
    tiers: cfg.tiers,
    rules: cfg.rules,
    scriptedDice: cfg.scriptedDice
  });

  let peak = netWorth(state, 0);
  const reached = (): boolean => goalReached(cfg, state);

  let guard = 0;
  const maxSteps = cfg.rounds * cfg.seats + 8;
  while (!state.over && state.round <= cfg.rounds && guard < maxSteps) {
    guard++;
    playTurn(state, state.turn, ctx);
    peak = Math.max(peak, netWorth(state, 0));
    if (state.players[0].bankrupt) {
      return { win: false, rounds: state.round, netWorth: 0, peak, note: "朵朵先破产了" };
    }
    if (reached()) {
      return { win: true, rounds: state.round, netWorth: netWorth(state, 0), peak, note: "达标" };
    }
    if (state.over) break;
    advanceTurn(state);
  }

  const nw = netWorth(state, 0);
  const short = Math.max(0, cfg.goal.minBuys - (state.players[0]?.deedsBought ?? 0));
  return {
    win: reached(),
    rounds: state.round,
    netWorth: nw,
    peak,
    note:
      cfg.goal.kind === "bankrupt"
        ? `${cfg.rounds} 回合内没能把对手清空（还差买 ${short} 处产业）`
        : `净资产 ${nw}，差目标 ${Math.max(0, cfg.goal.target - peak)}，还差买 ${short} 处产业`
  };
}

/** 关卡目标写成一句话 */
export function goalLine(cfg: EstateLevel): string {
  const deeds = `自己买下 ${cfg.goal.minBuys} 处产业`;
  if (cfg.goal.kind === "bankrupt") {
    return `${cfg.rounds} 回合内让对手的钱包见底，同时${deeds}`;
  }
  return `${cfg.rounds} 回合内把净资产做到 ${cfg.goal.target} 星币，同时${deeds}`;
}

/** 本关开放了哪些机制，写成一行小字 */
export function rulesLine(cfg: EstateLevel): string {
  const on: string[] = ["买地收租"];
  if (cfg.rules.fullSetDouble) on.push("垄断加倍");
  if (cfg.rules.build) on.push("平均建屋");
  if (cfg.rules.cards) on.push("机会命运");
  if (cfg.rules.jail) on.push("小黑屋");
  if (cfg.rules.mortgage) on.push("抵押赎回");
  if (cfg.rules.auction) on.push("无底价拍卖");
  return on.join(" · ");
}

/** 三星：达标一星，回合省一半 / 净资产超目标一成再各加一星 */
export function starsFor(cfg: EstateLevel, got: { win: boolean; rounds: number; netWorth: number }): 1 | 2 | 3 {
  if (!got.win) return 1;
  const quick = got.rounds <= Math.ceil(cfg.rounds * 0.6);
  const rich = cfg.goal.kind === "netWorth" ? got.netWorth >= cfg.goal.target * 1.1 : got.rounds <= cfg.rounds * 0.75;
  if (quick && rich) return 3;
  if (quick || rich) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 无尽：短盘连胜
// ---------------------------------------------------------------------------

export interface EndlessConfig {
  seats: number;
  tiers: AiTier[];
  cash: number;
  rounds: number;
}

/** 连胜越长，对手越强、盘越短 */
export function endlessConfig(streak: number): EndlessConfig {
  const s = Math.max(0, Math.round(streak));
  const tier: AiTier = s >= 9 ? "hell" : s >= 5 ? "pro" : s >= 2 ? "normal" : "rookie";
  return {
    seats: 2,
    tiers: [SOLVER_TIER, tier],
    cash: Math.max(900, START_CASH - s * 50),
    rounds: Math.max(12, 22 - Math.floor(s / 2))
  };
}

// ---------------------------------------------------------------------------
// 对战 / 双人同屏
// ---------------------------------------------------------------------------

export interface VersusConfig {
  seats: number;
  tiers: AiTier[];
  cash: number;
  rules: MatchRules;
}

export function versusConfig(tier: AiTier, humans = 1): VersusConfig {
  const seats = 4;
  const tiers: AiTier[] = [];
  for (let i = 0; i < seats; i++) tiers.push(i < humans ? SOLVER_TIER : tier);
  return {
    seats,
    tiers,
    cash: START_CASH,
    rules: { build: true, cards: true, jail: true, mortgage: true, auction: true, fullSetDouble: true, maxRounds: 80 }
  };
}
