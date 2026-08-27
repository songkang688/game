/**
 * 花开麻将 · 番种识别与结算（纯函数，没有 DOM）。
 *
 * 本款用的是**国标（中国麻将竞赛规则）的可玩简化落地**：81 个番种全表都在
 * `FAN_TABLE` 里，识别器覆盖全部 81 项。计分守国标三条原则：
 *
 * 1. **不重复计**：一个番种已经把另一个包含进去了，被包含的那个不再单算
 *    （靠 `SUPPRESS` 互斥表实现，能按条数扣，例如清龙只吃掉两个连六）；
 * 2. **不拆移**：一副面子只能属于一种拆法，一套拆解从头算到尾，中途不换；
 * 3. **就高不就低**：所有合法拆解各算一遍，取总分最高的那一套。
 *
 * 花牌每张 1 分，不计番，所以起和门槛只看 `points`，`flowerPoints` 单独记。
 */
import { isKan, isOpenKan, type Meld } from "./melds";
import {
  chiTiles,
  huParses,
  knittedInfo,
  setTiles,
  type HuForm,
  type HuParse,
  type SetPart
} from "./hu";
import {
  isDragon,
  isHonor,
  isNumber,
  isTerminal,
  isTerminalOrHonor,
  isWind,
  rankOf,
  suitOf,
  windId,
  type Suit
} from "./tiles";

export interface FanDef {
  name: string;
  points: number;
  /** 有没有写识别器。本款 81 项全部有，留这个字段是为了以后加番种时一眼看出缺口 */
  detector: boolean;
  /** 同一手牌里可以重复计几次（例如一般高可以两个） */
  repeatable?: boolean;
}

/**
 * 国标 81 个番种全表，按分值档 88/64/48/32/24/16/12/8/6/4/2/1 排。
 * `detector: false` 表示「未实现识别器」——本款目前一个都没有，全部实现了。
 */
export const FAN_TABLE: FanDef[] = [
  { name: "大四喜", points: 88, detector: true },
  { name: "大三元", points: 88, detector: true },
  { name: "绿一色", points: 88, detector: true },
  { name: "九莲宝灯", points: 88, detector: true },
  { name: "四杠", points: 88, detector: true },
  { name: "连七对", points: 88, detector: true },
  { name: "十三幺", points: 88, detector: true },

  { name: "清幺九", points: 64, detector: true },
  { name: "小四喜", points: 64, detector: true },
  { name: "小三元", points: 64, detector: true },
  { name: "字一色", points: 64, detector: true },
  { name: "四暗刻", points: 64, detector: true },
  { name: "一色双龙会", points: 64, detector: true },

  { name: "一色四同顺", points: 48, detector: true },
  { name: "一色四节高", points: 48, detector: true },

  { name: "一色四步高", points: 32, detector: true },
  { name: "三杠", points: 32, detector: true },
  { name: "混幺九", points: 32, detector: true },

  { name: "七对", points: 24, detector: true },
  { name: "七星不靠", points: 24, detector: true },
  { name: "全双刻", points: 24, detector: true },
  { name: "清一色", points: 24, detector: true },
  { name: "一色三同顺", points: 24, detector: true },
  { name: "一色三节高", points: 24, detector: true },
  { name: "全大", points: 24, detector: true },
  { name: "全中", points: 24, detector: true },
  { name: "全小", points: 24, detector: true },

  { name: "清龙", points: 16, detector: true },
  { name: "三色双龙会", points: 16, detector: true },
  { name: "一色三步高", points: 16, detector: true },
  { name: "全带五", points: 16, detector: true },
  { name: "三同刻", points: 16, detector: true },
  { name: "三暗刻", points: 16, detector: true },

  { name: "全不靠", points: 12, detector: true },
  { name: "组合龙", points: 12, detector: true },
  { name: "大于五", points: 12, detector: true },
  { name: "小于五", points: 12, detector: true },
  { name: "三风刻", points: 12, detector: true },

  { name: "花龙", points: 8, detector: true },
  { name: "推不倒", points: 8, detector: true },
  { name: "三色三同顺", points: 8, detector: true },
  { name: "三色三节高", points: 8, detector: true },
  { name: "无番和", points: 8, detector: true },
  { name: "妙手回春", points: 8, detector: true },
  { name: "海底捞月", points: 8, detector: true },
  { name: "杠上开花", points: 8, detector: true },
  { name: "抢杠和", points: 8, detector: true },

  { name: "碰碰和", points: 6, detector: true },
  { name: "混一色", points: 6, detector: true },
  { name: "三色三步高", points: 6, detector: true },
  { name: "五门齐", points: 6, detector: true },
  { name: "全求人", points: 6, detector: true },
  { name: "双暗杠", points: 6, detector: true },
  { name: "双箭刻", points: 6, detector: true },

  { name: "全带幺", points: 4, detector: true },
  { name: "不求人", points: 4, detector: true },
  { name: "双明杠", points: 4, detector: true },
  { name: "和绝张", points: 4, detector: true },

  { name: "箭刻", points: 2, detector: true, repeatable: true },
  { name: "圈风刻", points: 2, detector: true },
  { name: "门风刻", points: 2, detector: true },
  { name: "门前清", points: 2, detector: true },
  { name: "平和", points: 2, detector: true },
  { name: "四归一", points: 2, detector: true, repeatable: true },
  { name: "双同刻", points: 2, detector: true, repeatable: true },
  { name: "双暗刻", points: 2, detector: true },
  { name: "暗杠", points: 2, detector: true, repeatable: true },
  { name: "断幺", points: 2, detector: true },

  { name: "一般高", points: 1, detector: true, repeatable: true },
  { name: "喜相逢", points: 1, detector: true, repeatable: true },
  { name: "连六", points: 1, detector: true, repeatable: true },
  { name: "老少副", points: 1, detector: true, repeatable: true },
  { name: "幺九刻", points: 1, detector: true, repeatable: true },
  { name: "明杠", points: 1, detector: true, repeatable: true },
  { name: "缺一门", points: 1, detector: true },
  { name: "无字", points: 1, detector: true },
  { name: "边张", points: 1, detector: true },
  { name: "坎张", points: 1, detector: true },
  { name: "单钓将", points: 1, detector: true },
  { name: "自摸", points: 1, detector: true },
  // 花牌是全表第 81 项，每张 1 分。它**不计番**，所以不会出现在 `fans` 里，
  // 而是单独记在 `ScoreResult.flowerPoints`，起和门槛只看番、不看花。
  { name: "花牌", points: 1, detector: true, repeatable: true }
];

/** 番种名 → 分值 */
export const FAN_POINTS: Record<string, number> = Object.fromEntries(
  FAN_TABLE.map((f) => [f.name, f.points])
);

/** 全表一共多少个番种（国标是 81） */
export const FAN_COUNT = FAN_TABLE.length;

/** 还没写识别器的番种名（本款为空） */
export function undetectedFans(): string[] {
  return FAN_TABLE.filter((f) => !f.detector).map((f) => f.name);
}

interface Suppression {
  name: string;
  /** 最多吃掉几条，不写就是全吃 */
  count?: number;
}

/**
 * 不重复计：键这个番种成立时，值里列的番种要按条数扣掉。
 * 只写国标里明确「已包含」的那些，别的照常各算各的。
 */
const SUPPRESS: Record<string, Suppression[]> = {
  大四喜: [{ name: "小四喜" }, { name: "三风刻" }, { name: "圈风刻" }, { name: "门风刻" }, { name: "碰碰和" }, { name: "幺九刻" }],
  小四喜: [{ name: "三风刻" }],
  大三元: [{ name: "双箭刻" }, { name: "箭刻" }],
  小三元: [{ name: "双箭刻" }, { name: "箭刻" }],
  四暗刻: [{ name: "三暗刻" }, { name: "双暗刻" }, { name: "碰碰和" }, { name: "门前清" }],
  三暗刻: [{ name: "双暗刻" }],
  四杠: [{ name: "三杠" }, { name: "双明杠" }, { name: "双暗杠" }, { name: "明杠" }, { name: "暗杠" }, { name: "碰碰和" }],
  三杠: [{ name: "双明杠" }, { name: "双暗杠" }],
  双明杠: [{ name: "明杠", count: 2 }],
  双暗杠: [{ name: "暗杠", count: 2 }],
  清一色: [{ name: "无字" }, { name: "缺一门" }],
  混一色: [{ name: "缺一门" }],
  字一色: [{ name: "碰碰和" }, { name: "混幺九" }, { name: "全带幺" }, { name: "缺一门" }, { name: "幺九刻" }],
  混幺九: [{ name: "碰碰和" }, { name: "全带幺" }, { name: "幺九刻" }],
  清幺九: [{ name: "碰碰和" }, { name: "全带幺" }, { name: "幺九刻" }, { name: "无字" }, { name: "混幺九" }],
  断幺: [{ name: "无字" }],
  绿一色: [{ name: "缺一门" }],
  九莲宝灯: [{ name: "清一色" }, { name: "无字" }, { name: "缺一门" }, { name: "门前清" }],
  七对: [{ name: "门前清" }, { name: "单钓将" }],
  连七对: [{ name: "七对" }, { name: "清一色" }, { name: "无字" }, { name: "缺一门" }, { name: "门前清" }, { name: "单钓将" }],
  十三幺: [{ name: "门前清" }, { name: "单钓将" }, { name: "五门齐" }, { name: "全带幺" }],
  七星不靠: [{ name: "全不靠" }, { name: "五门齐" }],
  全不靠: [{ name: "五门齐" }],
  一色四同顺: [{ name: "一色三同顺" }, { name: "一般高" }, { name: "四归一" }],
  一色三同顺: [{ name: "一般高", count: 2 }],
  一色四节高: [{ name: "一色三节高" }],
  一色四步高: [{ name: "一色三步高" }, { name: "连六", count: 2 }, { name: "老少副" }],
  清龙: [{ name: "连六", count: 2 }, { name: "老少副" }],
  一色双龙会: [{ name: "清一色" }, { name: "一般高", count: 2 }, { name: "老少副", count: 2 }, { name: "平和" }, { name: "连六" }],
  三色双龙会: [{ name: "喜相逢", count: 2 }, { name: "老少副", count: 2 }, { name: "平和" }, { name: "三色三同顺" }],
  三色三同顺: [{ name: "喜相逢", count: 3 }],
  三同刻: [{ name: "双同刻", count: 3 }],
  全双刻: [{ name: "碰碰和" }, { name: "断幺" }],
  全大: [{ name: "大于五" }],
  全小: [{ name: "小于五" }],
  大于五: [{ name: "无字" }],
  小于五: [{ name: "无字" }],
  全中: [{ name: "无字" }, { name: "断幺" }],
  不求人: [{ name: "门前清" }, { name: "自摸" }],
  全求人: [{ name: "单钓将" }],
  妙手回春: [{ name: "自摸" }],
  杠上开花: [{ name: "自摸" }],
  抢杠和: [{ name: "和绝张" }]
};

export interface HuContext {
  /** 手里的牌，**含和牌张** */
  hand: number[];
  melds: Meld[];
  winTile: number;
  selfDraw: boolean;
  /** 门风 1..4（1=东） */
  seatWind: number;
  /** 圈风 1..4 */
  roundWind: number;
  /** 补到的花牌张数 */
  flowers?: number;
  /** 杠后补牌自摸 */
  afterKan?: boolean;
  /** 抢别人加杠那张 */
  robKan?: boolean;
  /** 摸的是牌墙最后一张 */
  lastDraw?: boolean;
  /** 和的是牌墙摸完之后打出的那张 */
  lastDiscard?: boolean;
  /** 和牌张是场上第 4 张（前三张都已明示） */
  lastTile?: boolean;
}

export interface FanHit {
  name: string;
  points: number;
}

export interface ScoreResult {
  fans: FanHit[];
  names: string[];
  /** 番数合计（不含花牌） */
  points: number;
  /** 花牌分，每张 1 分 */
  flowerPoints: number;
  form: HuForm | null;
}

const EMPTY: ScoreResult = { fans: [], names: [], points: 0, flowerPoints: 0, form: null };

function meldToSet(m: Meld): SetPart {
  if (m.kind === "chi") {
    return { kind: "chi", tile: Math.min(...m.tiles), concealed: false, fromMeld: true };
  }
  if (m.kind === "ankan") return { kind: "kan", tile: m.tiles[0], concealed: true, fromMeld: true };
  if (isKan(m)) return { kind: "kan", tile: m.tiles[0], concealed: false, fromMeld: true };
  return { kind: "pon", tile: m.tiles[0], concealed: false, fromMeld: true };
}

function allTilesOf(parse: HuParse, melds: readonly Meld[]): number[] {
  const out: number[] = [];
  for (const m of melds) out.push(...m.tiles.slice(0, isKan(m) ? 4 : 3));
  if (parse.form === "standard" || parse.form === "knittedDragon") {
    for (const s of parse.sets) out.push(...setTiles(s));
    out.push(parse.pair, parse.pair);
    out.push(...(parse.singles ?? []));
  } else if (parse.form === "sevenPairs") {
    for (const p of parse.pairs ?? []) out.push(p, p);
  } else {
    out.push(...(parse.singles ?? []));
    if (parse.form === "thirteenOrphans") out.push(parse.pair);
  }
  return out;
}

function isPung(s: SetPart): boolean {
  return s.kind === "pon" || s.kind === "kan";
}

/** 三条计分主原则里的「不重复计」：按互斥表扣条数 */
export function applyExclusions(hits: FanHit[]): FanHit[] {
  let cur = hits;
  for (let round = 0; round < 3; round++) {
    const budget = new Map<string, number>();
    for (const h of cur) {
      for (const r of SUPPRESS[h.name] ?? []) {
        if (r.name === h.name) continue;
        budget.set(r.name, (budget.get(r.name) ?? 0) + (r.count ?? 99));
      }
    }
    const next: FanHit[] = [];
    for (const h of cur) {
      const left = budget.get(h.name) ?? 0;
      if (left > 0) {
        budget.set(h.name, left - 1);
        continue;
      }
      next.push(h);
    }
    if (next.length === cur.length) return next;
    cur = next;
  }
  return cur;
}

function add(hits: FanHit[], name: string, times = 1): void {
  const p = FAN_POINTS[name];
  if (p === undefined) return;
  for (let i = 0; i < times; i++) hits.push({ name, points: p });
}

/** 一套拆解 + 一个和牌张落点，算出这一套的番 */
function scoreOne(ctx: HuContext, parse: HuParse, winSlot: number): FanHit[] {
  const hits: FanHit[] = [];
  const melds = ctx.melds ?? [];
  const meldSets = melds.map(meldToSet);
  const sets: SetPart[] = [...meldSets, ...parse.sets];
  const tiles = allTilesOf(parse, melds);
  const openMelds = melds.filter((m) => m.kind !== "ankan");
  const concealedHand = openMelds.length === 0;

  // ---- 牌面成分 ----
  const numberSuits = new Set<Suit>();
  let hasHonor = false;
  let hasWind = false;
  let hasDragon = false;
  for (const t of tiles) {
    if (isNumber(t)) numberSuits.add(suitOf(t));
    else if (isHonor(t)) {
      hasHonor = true;
      if (isWind(t)) hasWind = true;
      else hasDragon = true;
    }
  }
  const allTerminalOrHonor = tiles.every(isTerminalOrHonor);
  const noTerminalOrHonor = tiles.every((t) => !isTerminalOrHonor(t));
  const ranks = tiles.filter(isNumber).map(rankOf);

  /** 门清与自摸这两条各种牌型都要算 */
  const addHandStyle = (): void => {
    if (concealedHand) add(hits, ctx.selfDraw ? "不求人" : "门前清");
    if (ctx.selfDraw) add(hits, "自摸");
  };

  // ---- 特殊牌型先走 ----
  if (parse.form === "thirteenOrphans") {
    add(hits, "十三幺");
    add(hits, "单钓将");
    addHandStyle();
    addSituational(hits, ctx);
    return applyExclusions(hits);
  }
  if (parse.form === "knitted") {
    const info = knittedInfo(parse.singles ?? []);
    if (info.allSevenHonors) add(hits, "七星不靠");
    else add(hits, "全不靠");
    if (info.fullDragon) add(hits, "组合龙");
    if (numberSuits.size + (hasWind ? 1 : 0) + (hasDragon ? 1 : 0) >= 5) add(hits, "五门齐");
    addHandStyle();
    addSituational(hits, ctx);
    return applyExclusions(hits);
  }
  if (parse.form === "knittedDragon") {
    add(hits, "组合龙");
    if (numberSuits.size < 3) add(hits, "缺一门");
    if (!hasHonor) add(hits, "无字");
    if (numberSuits.size === 3 && hasWind && hasDragon) add(hits, "五门齐");
    addHandStyle();
    addSituational(hits, ctx);
    return applyExclusions(hits);
  }
  if (parse.form === "sevenPairs") {
    const pairs = (parse.pairs ?? []).slice().sort((a, b) => a - b);
    if (isSevenSisters(pairs)) add(hits, "连七对");
    else add(hits, "七对");
    scoreColorFans(hits, numberSuits, hasHonor, tiles, noTerminalOrHonor, ranks);
    addHandStyle();
    add(hits, "单钓将");
    for (const p of pairs) {
      if (countIn(tiles, p) === 4) add(hits, "四归一");
    }
    addSituational(hits, ctx);
    return applyExclusions(hits);
  }

  // ---- 基本型 ----
  const pair = parse.pair;
  const chis = sets.filter((s) => s.kind === "chi");
  const pungs = sets.filter(isPung);
  // 点和时，和牌张落在哪一副，那一副就不算暗刻了
  let concealedPungs = 0;
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (!isPung(s) || !s.concealed) continue;
    if (!ctx.selfDraw && i === winSlot) continue;
    concealedPungs++;
  }

  // 面子结构类
  scoreChiFans(hits, chis);
  scorePungFans(hits, pungs, ctx);
  scoreSmallTriples(hits, pungs, pair);
  scoreDoubleDragonFans(hits, chis, pair);

  if (pungs.length === 4) add(hits, "碰碰和");
  if (chis.length === 4 && isNumber(pair)) add(hits, "平和");

  if (concealedPungs === 2) add(hits, "双暗刻");
  else if (concealedPungs === 3) add(hits, "三暗刻");
  else if (concealedPungs >= 4) add(hits, "四暗刻");

  // 杠
  const kanCount = melds.filter(isKan).length;
  const openKan = melds.filter((m) => isKan(m) && isOpenKan(m)).length;
  const closedKan = melds.filter((m) => m.kind === "ankan").length;
  if (kanCount >= 4) add(hits, "四杠");
  else if (kanCount === 3) add(hits, "三杠");
  if (openKan === 2) add(hits, "双明杠");
  if (closedKan === 2) add(hits, "双暗杠");
  add(hits, "明杠", openKan);
  add(hits, "暗杠", closedKan);

  // 颜色 / 幺九 / 数段
  scoreColorFans(hits, numberSuits, hasHonor, tiles, noTerminalOrHonor, ranks);

  // 九莲宝灯
  if (concealedHand && numberSuits.size === 1 && !hasHonor && isNineGates(tiles)) add(hits, "九莲宝灯");

  // 全带幺 / 全带五 / 混幺九 / 清幺九
  const blocks: number[][] = [...sets.map(setTiles), [pair, pair]];
  if (blocks.every((b) => b.some(isTerminalOrHonor))) add(hits, "全带幺");
  if (blocks.every((b) => b.some((t) => isNumber(t) && rankOf(t) === 5))) add(hits, "全带五");
  if (allTerminalOrHonor && pungs.length === 4 && hasHonor) add(hits, "混幺九");
  if (allTerminalOrHonor && pungs.length === 4 && !hasHonor) add(hits, "清幺九");
  if (pungs.length === 4 && tiles.every((t) => isNumber(t) && rankOf(t) % 2 === 0)) add(hits, "全双刻");

  // 四归一：四张一样的牌分散在三副牌与将牌里（不是以杠的形式）
  const seen = new Set<number>();
  for (const t of tiles) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (countIn(tiles, t) !== 4) continue;
    if (melds.some((m) => isKan(m) && m.tiles[0] === t)) continue;
    add(hits, "四归一");
  }

  // 门清 / 求人
  if (concealedHand) add(hits, ctx.selfDraw ? "不求人" : "门前清");
  if (
    !ctx.selfDraw &&
    melds.length === 4 &&
    melds.every((m) => m.kind !== "ankan") &&
    ctx.winTile === pair
  ) {
    add(hits, "全求人");
  }
  if (ctx.selfDraw) add(hits, "自摸");

  // 听牌形状：单钓 / 坎张 / 边张，三者互斥，看和牌张落在哪
  if (winSlot === -1) {
    add(hits, "单钓将");
  } else if (winSlot >= 0) {
    const s = sets[winSlot];
    if (s && s.kind === "chi") {
      const t = chiTiles(s.tile);
      if (ctx.winTile === t[1]) add(hits, "坎张");
      else if ((s.tile % 10 === 1 && ctx.winTile === t[2]) || (s.tile % 10 === 7 && ctx.winTile === t[0])) {
        add(hits, "边张");
      }
    }
  }

  addSituational(hits, ctx);

  const cleaned = applyExclusions(hits);
  if (cleaned.length === 0) return [{ name: "无番和", points: FAN_POINTS["无番和"] }];
  return cleaned;
}

/** 场况类：杠上开花 / 抢杠和 / 妙手回春 / 海底捞月 / 和绝张 */
function addSituational(hits: FanHit[], ctx: HuContext): void {
  if (ctx.afterKan && ctx.selfDraw) add(hits, "杠上开花");
  if (ctx.robKan) add(hits, "抢杠和");
  if (ctx.lastDraw && ctx.selfDraw) add(hits, "妙手回春");
  if (ctx.lastDiscard && !ctx.selfDraw) add(hits, "海底捞月");
  if (ctx.lastTile) add(hits, "和绝张");
}

function countIn(tiles: readonly number[], id: number): number {
  let n = 0;
  for (const t of tiles) if (t === id) n++;
  return n;
}

/** 连七对：同一花色七个连号对子 */
function isSevenSisters(pairs: readonly number[]): boolean {
  if (pairs.length !== 7) return false;
  const s = suitOf(pairs[0]);
  if (s !== "m" && s !== "p" && s !== "s") return false;
  for (let i = 0; i < 7; i++) {
    if (suitOf(pairs[i]) !== s) return false;
    if (rankOf(pairs[i]) !== rankOf(pairs[0]) + i) return false;
  }
  return true;
}

/** 九莲宝灯：一门花色的 1112345678999 再加同花色任意一张 */
function isNineGates(tiles: readonly number[]): boolean {
  if (tiles.length !== 14) return false;
  const s = suitOf(tiles[0]);
  if (s !== "m" && s !== "p" && s !== "s") return false;
  const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  const got = new Array<number>(9).fill(0);
  for (const t of tiles) {
    if (suitOf(t) !== s) return false;
    got[rankOf(t) - 1]++;
  }
  let extra = 0;
  for (let i = 0; i < 9; i++) {
    const d = got[i] - need[i];
    if (d < 0) return false;
    extra += d;
  }
  return extra === 1;
}

function scoreColorFans(
  hits: FanHit[],
  numberSuits: Set<Suit>,
  hasHonor: boolean,
  tiles: readonly number[],
  noTerminalOrHonor: boolean,
  ranks: readonly number[]
): void {
  if (numberSuits.size === 0 && hasHonor) add(hits, "字一色");
  if (numberSuits.size === 1 && !hasHonor) add(hits, "清一色");
  if (numberSuits.size === 1 && hasHonor) add(hits, "混一色");
  if (numberSuits.size < 3) add(hits, "缺一门");
  if (!hasHonor) add(hits, "无字");
  if (noTerminalOrHonor) add(hits, "断幺");
  if (numberSuits.size === 3 && tiles.some(isWind) && tiles.some(isDragon)) add(hits, "五门齐");
  if (isGreen(tiles)) add(hits, "绿一色");
  if (isReversible(tiles)) add(hits, "推不倒");

  if (!hasHonor && ranks.length === tiles.length && ranks.length > 0) {
    const mn = Math.min(...ranks);
    const mx = Math.max(...ranks);
    if (mn >= 7) add(hits, "全大");
    else if (mn >= 6) add(hits, "大于五");
    if (mx <= 3) add(hits, "全小");
    else if (mx <= 4) add(hits, "小于五");
    if (mn >= 4 && mx <= 6) add(hits, "全中");
  }
}

const GREEN = new Set([22, 23, 24, 26, 28, 36]);
const REVERSIBLE = new Set([11, 12, 13, 14, 15, 18, 19, 22, 24, 25, 26, 28, 29, 37]);

function isGreen(tiles: readonly number[]): boolean {
  return tiles.length > 0 && tiles.every((t) => GREEN.has(t));
}

function isReversible(tiles: readonly number[]): boolean {
  return tiles.length > 0 && tiles.every((t) => REVERSIBLE.has(t));
}

function scoreChiFans(hits: FanHit[], chis: readonly SetPart[]): void {
  if (chis.length === 0) return;
  const heads = chis.map((c) => c.tile);
  const bySuit = new Map<Suit, number[]>();
  for (const h of heads) {
    const s = suitOf(h);
    const arr = bySuit.get(s) ?? [];
    arr.push(rankOf(h));
    bySuit.set(s, arr);
  }

  // 一般高 / 一色三同顺 / 一色四同顺
  const same = new Map<number, number>();
  for (const h of heads) same.set(h, (same.get(h) ?? 0) + 1);
  for (const [, c] of same) {
    if (c >= 4) add(hits, "一色四同顺");
    else if (c === 3) add(hits, "一色三同顺");
    else if (c === 2) add(hits, "一般高");
  }

  // 喜相逢 / 三色三同顺：同点数、不同花色
  const byRank = new Map<number, Set<Suit>>();
  for (const h of heads) {
    const set = byRank.get(rankOf(h)) ?? new Set<Suit>();
    set.add(suitOf(h));
    byRank.set(rankOf(h), set);
  }
  for (const [, suits] of byRank) {
    if (suits.size >= 3) add(hits, "三色三同顺");
    else if (suits.size === 2) add(hits, "喜相逢");
  }

  // 同花色内：清龙 / 连六 / 老少副 / 一色三步高 / 一色四步高
  for (const [, arr] of bySuit) {
    const uniq = [...new Set(arr)].sort((a, b) => a - b);
    if (uniq.includes(1) && uniq.includes(4) && uniq.includes(7)) add(hits, "清龙");
    for (const r of uniq) if (uniq.includes(r + 3)) add(hits, "连六");
    if (uniq.includes(1) && uniq.includes(7)) add(hits, "老少副");
    for (const step of [1, 2]) {
      for (const r of uniq) {
        if (uniq.includes(r + step) && uniq.includes(r + 2 * step) && uniq.includes(r + 3 * step)) {
          add(hits, "一色四步高");
          break;
        }
      }
    }
    for (const step of [1, 2]) {
      let found = false;
      for (const r of uniq) {
        if (uniq.includes(r + step) && uniq.includes(r + 2 * step)) {
          found = true;
          break;
        }
      }
      if (found) {
        add(hits, "一色三步高");
        break;
      }
    }
  }

  // 花龙：123 / 456 / 789 分属三门
  if (hasFlowerDragon(heads)) add(hits, "花龙");

  // 三色三步高：三门起点连着走
  const suitHeads: Record<string, number[]> = {};
  for (const h of heads) {
    const s = suitOf(h);
    (suitHeads[s] ??= []).push(rankOf(h));
  }
  const suitKeys = Object.keys(suitHeads);
  if (suitKeys.length === 3) {
    for (const a of suitHeads[suitKeys[0]]) {
      for (const b of suitHeads[suitKeys[1]]) {
        for (const c of suitHeads[suitKeys[2]]) {
          const arr = [a, b, c].sort((x, y) => x - y);
          if (arr[1] === arr[0] + 1 && arr[2] === arr[1] + 1) {
            add(hits, "三色三步高");
            return;
          }
        }
      }
    }
  }
}

function hasFlowerDragon(heads: readonly number[]): boolean {
  const bySeg: Record<number, Set<Suit>> = { 1: new Set(), 4: new Set(), 7: new Set() };
  for (const h of heads) {
    const r = rankOf(h);
    if (r === 1 || r === 4 || r === 7) bySeg[r].add(suitOf(h));
  }
  const perms = [
    ["m", "p", "s"],
    ["m", "s", "p"],
    ["p", "m", "s"],
    ["p", "s", "m"],
    ["s", "m", "p"],
    ["s", "p", "m"]
  ] as Suit[][];
  for (const p of perms) {
    if (bySeg[1].has(p[0]) && bySeg[4].has(p[1]) && bySeg[7].has(p[2])) {
      // 三门各一段才算花龙，同门凑齐那是清龙
      if (new Set(p).size === 3) return true;
    }
  }
  return false;
}

function scorePungFans(hits: FanHit[], pungs: readonly SetPart[], ctx: HuContext): void {
  if (pungs.length === 0) return;
  const tilesOf = pungs.map((p) => p.tile);

  // 箭刻 / 大三元 / 小三元 —— 小三元还要看将
  const dragons = tilesOf.filter(isDragon);
  if (dragons.length >= 3) add(hits, "大三元");
  else if (dragons.length === 2) add(hits, "双箭刻");
  add(hits, "箭刻", dragons.length);

  // 风刻
  const winds = tilesOf.filter(isWind);
  if (winds.length >= 4) add(hits, "大四喜");
  else if (winds.length === 3) add(hits, "三风刻");
  if (tilesOf.includes(windId(ctx.roundWind))) add(hits, "圈风刻");
  if (tilesOf.includes(windId(ctx.seatWind))) add(hits, "门风刻");

  // 幺九刻：序数牌 1/9 或风牌的刻子（箭刻另算）
  add(hits, "幺九刻", tilesOf.filter((t) => isTerminal(t) || isWind(t)).length);

  // 双同刻 / 三同刻：同点数不同花色的刻子
  const byRank = new Map<number, Set<Suit>>();
  for (const t of tilesOf) {
    if (!isNumber(t)) continue;
    const set = byRank.get(rankOf(t)) ?? new Set<Suit>();
    set.add(suitOf(t));
    byRank.set(rankOf(t), set);
  }
  for (const [, suits] of byRank) {
    if (suits.size >= 3) add(hits, "三同刻");
    else if (suits.size === 2) add(hits, "双同刻");
  }

  // 一色三节高 / 一色四节高 / 三色三节高
  const bySuit = new Map<Suit, number[]>();
  for (const t of tilesOf) {
    if (!isNumber(t)) continue;
    const arr = bySuit.get(suitOf(t)) ?? [];
    arr.push(rankOf(t));
    bySuit.set(suitOf(t), arr);
  }
  for (const [, arr] of bySuit) {
    const uniq = [...new Set(arr)].sort((a, b) => a - b);
    let four = false;
    for (const r of uniq) {
      if (uniq.includes(r + 1) && uniq.includes(r + 2) && uniq.includes(r + 3)) four = true;
    }
    if (four) add(hits, "一色四节高");
    else {
      for (const r of uniq) {
        if (uniq.includes(r + 1) && uniq.includes(r + 2)) {
          add(hits, "一色三节高");
          break;
        }
      }
    }
  }
  const numberPungs = tilesOf.filter(isNumber);
  if (new Set(numberPungs.map(suitOf)).size === 3) {
    for (const a of numberPungs) {
      const r = rankOf(a);
      const sa = suitOf(a);
      const second = numberPungs.find((t) => rankOf(t) === r + 1 && suitOf(t) !== sa);
      if (!second) continue;
      const third = numberPungs.find(
        (t) => rankOf(t) === r + 2 && suitOf(t) !== sa && suitOf(t) !== suitOf(second)
      );
      if (third) {
        add(hits, "三色三节高");
        break;
      }
    }
  }
}

/** 小三元 / 小四喜要连将一起看，所以单独一步 */
function scoreSmallTriples(hits: FanHit[], pungs: readonly SetPart[], pair: number): void {
  const tilesOf = pungs.map((p) => p.tile);
  const dragons = tilesOf.filter(isDragon).length;
  if (dragons === 2 && isDragon(pair)) add(hits, "小三元");
  const winds = tilesOf.filter(isWind).length;
  if (winds === 3 && isWind(pair)) add(hits, "小四喜");
}

/** 一色双龙会 / 三色双龙会 */
function scoreDoubleDragonFans(hits: FanHit[], chis: readonly SetPart[], pair: number): void {
  if (chis.length !== 4 || !isNumber(pair) || rankOf(pair) !== 5) return;
  const key = chis.map((c) => `${suitOf(c.tile)}${rankOf(c.tile)}`).sort();
  const ps = suitOf(pair);
  const oneSuit = [`${ps}1`, `${ps}1`, `${ps}7`, `${ps}7`].sort();
  if (key.join() === oneSuit.join()) {
    add(hits, "一色双龙会");
    return;
  }
  const suits = new Set(chis.map((c) => suitOf(c.tile)));
  if (suits.size === 2 && !suits.has(ps)) {
    const [a, b] = [...suits];
    const want = [`${a}1`, `${a}7`, `${b}1`, `${b}7`].sort();
    if (key.join() === want.join()) add(hits, "三色双龙会");
  }
}

/**
 * 算番主入口：所有拆解 × 所有和牌张落点各算一遍，取分最高的一套（就高不就低）。
 * 没胡就返回一个空结果，绝不抛异常。
 */
export function scoreFans(ctx: HuContext): ScoreResult {
  const hand = [...ctx.hand].sort((a, b) => a - b);
  const parses = huParses(hand, ctx.melds ?? []);
  if (parses.length === 0) return { ...EMPTY, flowerPoints: Math.max(0, ctx.flowers ?? 0) };

  let best: FanHit[] | null = null;
  let bestTotal = -1;
  let bestForm: HuForm = parses[0].form;
  for (const parse of parses) {
    for (const slot of winSlots(ctx, parse)) {
      const hits = scoreOne(ctx, parse, slot);
      const total = hits.reduce((a, b) => a + b.points, 0);
      if (total > bestTotal) {
        best = hits;
        bestTotal = total;
        bestForm = parse.form;
      }
    }
  }
  const fans = best ?? [];
  return {
    fans,
    names: fans.map((f) => f.name),
    points: fans.reduce((a, b) => a + b.points, 0),
    flowerPoints: Math.max(0, ctx.flowers ?? 0),
    form: bestForm
  };
}

/** 和牌张可能落在哪：-1 表示落在将上（单钓），>=0 是 sets 的下标，落不下就返回 [-2] */
function winSlots(ctx: HuContext, parse: HuParse): number[] {
  if (parse.form !== "standard") return [-2];
  const sets = [...(ctx.melds ?? []).map(meldToSet), ...parse.sets];
  const out: number[] = [];
  const meldCount = (ctx.melds ?? []).length;
  for (let i = meldCount; i < sets.length; i++) {
    if (setTiles(sets[i]).includes(ctx.winTile)) out.push(i);
  }
  if (parse.pair === ctx.winTile) out.push(-1);
  return out.length > 0 ? out : [-2];
}

// ---------------------------------------------------------------------------
// 起和门槛 / 错和 / 截和 / 结算
// ---------------------------------------------------------------------------

/** 对战默认门槛：8 番起和 */
export const DEFAULT_FAN_FLOOR = 8;

/** 闯关前三章的教学门槛：1 / 2 / 4 番，第 7 章起恢复 8 番 */
export const TEACH_FLOORS = [1, 2, 4];

/** 错和罚分：赔每家这么多花分 */
export const FALSE_HU_PENALTY_EACH = 10;

/** 够不够门槛（番数看 `points`，花牌分不算番） */
export function canHuWithFloor(points: number, floor: number = DEFAULT_FAN_FLOOR): boolean {
  return Number.isFinite(points) && points >= Math.max(0, floor);
}

/** 错和罚分：返回本人要赔出去的总花分（三家各赔 each） */
export function falseHuPenalty(each: number = FALSE_HU_PENALTY_EACH, players = 3): number {
  return Math.max(0, Math.round(each)) * Math.max(0, Math.round(players));
}

/**
 * 截和顺序：一炮只和一家，按「下家 > 对家 > 上家」取最靠前那一位。
 * 没人和返回 -1。
 */
export function ronPriority(claimers: readonly number[], discarder: number): number {
  for (let step = 1; step <= 3; step++) {
    const seat = (discarder + step) % 4;
    if (claimers.includes(seat)) return seat;
  }
  return -1;
}

export interface Settlement {
  /** 四家各自的花分增减，下标就是座位号 */
  delta: number[];
  /** 和牌那家一共进账多少 */
  gain: number;
}

/**
 * 结算：自摸时其余三家各付 `8 + 番`；点炮时点炮者付 `8 + 番`，另两家各付 8。
 * 花牌分直接加给和牌那家，不参与「谁付」的计算。
 */
export function settle(
  winner: number,
  isSelfDraw: boolean,
  points: number,
  discarder = -1,
  flowerPoints = 0
): Settlement {
  const delta = [0, 0, 0, 0];
  const p = Math.max(0, Math.round(points));
  if (winner < 0 || winner > 3) return { delta, gain: 0 };
  if (isSelfDraw) {
    for (let s = 0; s < 4; s++) {
      if (s === winner) continue;
      delta[s] -= 8 + p;
      delta[winner] += 8 + p;
    }
  } else {
    for (let s = 0; s < 4; s++) {
      if (s === winner) continue;
      const pay = s === discarder ? 8 + p : 8;
      delta[s] -= pay;
      delta[winner] += pay;
    }
  }
  const f = Math.max(0, Math.round(flowerPoints));
  delta[winner] += f;
  return { delta, gain: delta[winner] };
}

/** 错和结算：错和那家赔每家 each */
export function settleFalseHu(seat: number, each: number = FALSE_HU_PENALTY_EACH): Settlement {
  const delta = [0, 0, 0, 0];
  if (seat < 0 || seat > 3) return { delta, gain: 0 };
  const e = Math.max(0, Math.round(each));
  for (let s = 0; s < 4; s++) {
    if (s === seat) continue;
    delta[s] += e;
    delta[seat] -= e;
  }
  return { delta, gain: delta[seat] };
}
