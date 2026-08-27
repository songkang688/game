/**
 * 接住小水果 · 纯逻辑层（1.2 抽出）
 *
 * 1.1 的下落生成是「每隔一会儿在 30..W-30 之间随便挑个横坐标」，
 * 于是会摇出「上一颗刚落在最左，下一颗立刻落在最右」这种跑断腿也接不到的组合
 * （1.1 走查记录里那条「第 1 关两颗水果同时落在两端必掉一颗」就是它）。
 *
 * 1.2 把生成、接住判定、计分全搬到这里，做成不碰 DOM 的纯函数：
 *
 *  - 生成器先排「落地时刻」，再把落点锁在「篮子这段时间跑得过来」的区间里
 *    （只用 85% 的极限速度，孩子不用贴着极限跑）；
 *  - 捣蛋物和小辣椒不进这条链，而是**避开「照着链走的篮子」80px 以外**，
 *    所以照着链走一趟既接得满也碰不到；
 *  - 真要出现「同时落地的两颗」，第二颗一律标成奖励果：接到算白赚，
 *    漏了绝不扣爱心，1.1 那条「必掉一颗」就此消失；
 *  - 篮口有 8px 吸附，连接 5 颗给「稳稳的」倍率；
 *  - 五种水果与道具（普通 / 稀有 / 冰冻 / 磁铁 / 辣椒）；
 *  - 双人各记各的分、无尽「水果雨」的 seeded 出场表。
 *
 * 关卡数值仍然只写在 `levels.ts`，前 99 关一个字都没动。
 */

import { mulberry32 } from "../level99";
import type { CatchLevel } from "./levels";

// ---------------------------------------------------------------------------
// 一、场地尺寸与篮子
// ---------------------------------------------------------------------------

export const W = 360;
export const H = 460;
/** 水果落到这条线就进篮口 */
export const CATCH_Y = H - 20;
/** 水果从这里开始掉 */
export const SPAWN_Y = -20;
/** 篮口半宽 */
export const BASKET_HALF = 34;
/** 篮子横向速度（像素/秒） */
export const BASKET_SPEED = 260;
/** 篮子中心能走到的最左 / 最右 */
export const BASKET_MIN_X = 28;
export const BASKET_MAX_X = W - 28;
/** 吸附：差这么点也算接住 */
export const SNAP_PX = 8;
/** 掉几颗就收工 */
export const MAX_MISS = 3;
/** 水果最小直径（360px 上也看得清、抓得住） */
export const MIN_FRUIT_D = 32;
/** 可达性余量：只用篮子 85% 的极限速度 */
export const REACH_MARGIN = 0.15;
/** 链最窄也要用掉这么多「够得着的范围」——再窄水果就全挤在一条竖线上了 */
export const MIN_REACH_USE = 0.3;
/** 捣蛋物 / 辣椒离「预测中的篮子」至少这么远 */
export const HAZARD_CLEAR = 80;
/** 同时落地的奖励果离主果至少这么远（远到明摆着二选一） */
export const TWIN_GAP = 120;
/** 默认多大概率排一对「同时落地」 */
export const TWIN_CHANCE = 0.12;
/**
 * 第一颗落地的时刻。要比「一颗水果自然掉完全程」还长一点，
 * 不然生成器为了赶上时刻表会把第一颗调得飞快。
 */
export const FIRST_LAND = 3.6;

/** 这段时间里篮子最多能横着走多远（已经扣掉 15% 余量） */
export function reachSpan(dtSec: number, speed = BASKET_SPEED, margin = REACH_MARGIN): number {
  return Math.max(0, dtSec) * speed * (1 - margin);
}

/** 以 vy 下落，从出生到进篮口要多久 */
export function fallSeconds(vy: number, fromY = SPAWN_Y, toY = CATCH_Y): number {
  if (vy <= 0) return Infinity;
  return (toY - fromY) / vy;
}

export function clampBasket(x: number): number {
  return Math.max(BASKET_MIN_X, Math.min(BASKET_MAX_X, x));
}

// ---------------------------------------------------------------------------
// 二、五种水果与道具
// ---------------------------------------------------------------------------

export type FruitKind = "fruit" | "gold" | "bad" | "heavy" | "freeze" | "magnet" | "chili";

export interface FruitInfo {
  key: FruitKind;
  name: string;
  emoji: string;
  /** 接住算几颗（0 = 不算数量，只有效果） */
  gain: number;
  /** 接住会不会掉一次机会 */
  costsLife: boolean;
  /** 下落速度倍率（辣椒掉得慢，好让孩子看清躲开） */
  fallMul: number;
  /** 接住之后送几秒的效果 */
  effectSeconds: number;
  /** 是不是要画成「一眼就知道别碰」的样子 */
  warn: boolean;
  hint: string;
}

export const FRUITS: Readonly<Record<FruitKind, FruitInfo>> = {
  fruit: {
    key: "fruit", name: "小水果", emoji: "🍎", gain: 1, costsLife: false,
    fallMul: 1, effectSeconds: 0, warn: false, hint: "接住就算一颗！"
  },
  gold: {
    key: "gold", name: "稀有果", emoji: "🌟", gain: 2, costsLife: false,
    fallMul: 1, effectSeconds: 0, warn: false, hint: "亮闪闪的，一颗顶两颗！"
  },
  bad: {
    key: "bad", name: "捣蛋物", emoji: "💣", gain: 0, costsLife: true,
    fallMul: 1, effectSeconds: 0, warn: true, hint: "这个不能接，绕开它！"
  },
  heavy: {
    key: "heavy", name: "沉水果", emoji: "🍉", gain: 2, costsLife: false,
    fallMul: 1.35, effectSeconds: 0, warn: false, hint: "顶两颗，代价是篮子会慢一小段～"
  },
  freeze: {
    key: "freeze", name: "冰冻果", emoji: "🧊", gain: 1, costsLife: false,
    fallMul: 0.85, effectSeconds: 2, warn: false, hint: "接住就定住 2 秒，全场慢慢挑！"
  },
  magnet: {
    key: "magnet", name: "磁铁果", emoji: "🧲", gain: 1, costsLife: false,
    fallMul: 0.9, effectSeconds: 3, warn: false, hint: "3 秒里篮口变大，靠近就吸进来！"
  },
  chili: {
    key: "chili", name: "小辣椒", emoji: "🌶️", gain: 0, costsLife: true,
    fallMul: 0.7, effectSeconds: 0, warn: true, hint: "红红的小辣椒掉得最慢，看清楚绕开它～"
  }
};

/** 1.2 规格点名的五种（捣蛋物与沉水果是 1.0 / 1.1 留下来的老伙计） */
export const SPEC_KINDS: readonly FruitKind[] = ["fruit", "gold", "freeze", "magnet", "chili"];

export function fruitInfo(kind: FruitKind): FruitInfo {
  return FRUITS[kind];
}

/** 是不是「碰不得」的东西 */
export function isHazard(kind: FruitKind): boolean {
  return FRUITS[kind].costsLife;
}

/** 漏了这一颗要不要扣爱心（道具和碰不得的东西掉了都不算） */
export function missCostsLife(kind: FruitKind): boolean {
  return kind === "fruit" || kind === "heavy" || kind === "gold";
}

/** 磁铁生效时篮口额外的吸附范围 */
export const MAGNET_EXTRA = 22;
/** 冰冻定住的秒数 */
export const FREEZE_SECONDS = 2;
/** 磁铁生效的秒数 */
export const MAGNET_SECONDS = 3;
/** 沉水果压慢篮子的秒数与倍率 */
export const HEAVY_SLOW_S = 1.2;
export const HEAVY_SLOW_FACTOR = 0.55;

/** 接住判定：篮口半宽 + 8px 吸附（磁铁生效时再放宽一点） */
export function isCaught(
  fruitX: number,
  fruitY: number,
  basketX: number,
  opts: { half?: number; snap?: number; magnet?: boolean } = {}
): boolean {
  const half = opts.half ?? BASKET_HALF;
  const snap = (opts.snap ?? SNAP_PX) + (opts.magnet ? MAGNET_EXTRA : 0);
  if (fruitY < CATCH_Y - 14 || fruitY > CATCH_Y + 16) return false;
  return Math.abs(fruitX - basketX) <= half + snap;
}

/** 篮子当前的横向速度（沉水果压慢的那一小段） */
export function basketSpeedNow(slowLeft: number, base = BASKET_SPEED): number {
  return slowLeft > 0 ? base * HEAVY_SLOW_FACTOR : base;
}

// ---------------------------------------------------------------------------
// 三、计分：连接 5 颗给「稳稳的」倍率
// ---------------------------------------------------------------------------

export const STEADY_EVERY = 5;
/** 倍率封顶，免得后半程一颗顶一堆 */
export const STEADY_MAX = 2;

/** 连接 n 颗之后的倍率：每 5 连加 0.25，封顶 2 倍 */
export function steadyMul(combo: number): number {
  const steps = Math.floor(Math.max(0, combo) / STEADY_EVERY);
  return Math.min(STEADY_MAX, 1 + steps * 0.25);
}

/** 接住一颗在无尽里值多少分 */
export function scoreFor(kind: FruitKind, combo = 0): number {
  const base =
    kind === "gold" ? 30 : kind === "heavy" ? 24 : kind === "freeze" || kind === "magnet" ? 18 : 12;
  return Math.round(base * steadyMul(combo));
}

/** 一颗爱心都不掉才是三星 */
export function starsFor(missed: number): 1 | 2 | 3 {
  return missed === 0 ? 3 : missed === 1 ? 2 : 1;
}

/** 漏一颗时说的话：只描述、不批评 */
export function missWord(n: number): string {
  const words = [
    "这颗水果滚走啦～视线抬高一点，提前挪到落点下面等！",
    "又滚走一颗，没关系～盯着刚出现的那颗，别追已经错过的。",
    "最后一颗爱心啦，稳住！先站到下一颗的落点下面等它。"
  ];
  return words[Math.min(words.length - 1, Math.max(0, n - 1))];
}

// ---------------------------------------------------------------------------
// 四、可达性生成
// ---------------------------------------------------------------------------

export interface DropPlan {
  /** 出现时刻（秒） */
  at: number;
  /** 落到篮口那一刻的横坐标 */
  x: number;
  /** 下落速度（像素/秒） */
  vy: number;
  kind: FruitKind;
  /** 落到篮口的时刻（秒） */
  landAt: number;
  /**
   * true = 「奖励果」：它和另一颗几乎同时落地、篮子来不及两头跑。
   * 接到算白赚，漏了绝不扣爱心。
   */
  bonus: boolean;
}

export interface PlanOptions {
  count?: number;
  /** 篮子起始位置 */
  startX?: number;
  basketSpeed?: number;
  /** 落点能落在哪一段 */
  minX?: number;
  maxX?: number;
  /** 排一对「同时落地」的概率 */
  twinChance?: number;
  /** 第一颗落地的时刻（传送带关要多留一个滑行时长） */
  firstLand?: number;
  /**
   * 这一关真正用掉多少「够得着的范围」（0..1，不填就是用满）。
   *
   * 生成器排链时，下一颗的落点是在「篮子跑得到的那一段」里随机挑的。
   * 用满这一段，就等于每一关都顶着篮子的极速排——第 1 关和第 188 关
   * 要的手速一样快。乘上一个小于 1 的系数，链就收窄，
   * 「这一关最少要跑多快」这一维才真的参与难度曲线。
   */
  reachUse?: number;
  /**
   * 篮子从哪一刻开始算（默认 0）。
   *
   * 只有「接着上一段往下排」时才用得上：水果雨是一段一段续出来的，
   * 续出来那一段的 `landAt` 是接着上一段往后走的绝对时刻。若还从 0 起算，
   * 生成器会以为篮子有几百秒可以慢慢走，第一颗就能摆到屏幕另一头。
   */
  startT?: number;
}

interface Slot {
  landAt: number;
  kind: FruitKind;
  vy: number;
}

/** 按关卡配置摇一种水果 */
export function pickKind(cfg: CatchLevel, r: number): FruitKind {
  let acc = cfg.badChance;
  if (r < acc) return "bad";
  acc += cfg.goldChance;
  if (r < acc) return "gold";
  acc += cfg.heavyChance ?? 0;
  if (r < acc) return "heavy";
  acc += cfg.chiliChance ?? 0;
  if (r < acc) return "chili";
  acc += cfg.freezeChance ?? 0;
  if (r < acc) return "freeze";
  acc += cfg.magnetChance ?? 0;
  if (r < acc) return "magnet";
  return "fruit";
}

/** 两颗之间隔多久落地 */
export function slotGap(cfg: CatchLevel, i: number): number {
  return Math.max(0.45, cfg.spawnMs / 1000 - i * 0.008);
}

/**
 * 「照着链走的篮子」在 t 时刻会站在哪。
 * 它接完上一颗就立刻全速往下一颗的落点赶，到了就站着等。
 */
export function predictBasket(
  chain: ReadonlyArray<{ landAt: number; x: number }>,
  t: number,
  startX = W / 2,
  speed = BASKET_SPEED,
  startT = 0
): number {
  let px = clampBasket(startX);
  let pt = startT;
  for (const g of chain) {
    if (g.landAt >= t) {
      const d = g.x - px;
      return px + Math.sign(d) * Math.min(Math.abs(d), speed * Math.max(0, t - pt));
    }
    px = g.x;
    pt = g.landAt;
  }
  return px;
}

/** 在 [minX,maxX] 里挑一个离 away 至少 gap 远的位置（r 是 0..1 的随机数） */
function awayFrom(away: number, r: number, minX: number, maxX: number, gap: number): number {
  const leftW = Math.max(0, away - gap - minX);
  const rightW = Math.max(0, maxX - (away + gap));
  const total = leftW + rightW;
  if (total <= 0) return away >= (minX + maxX) / 2 ? minX : maxX;
  const pick = r * total;
  return pick < leftW ? minX + pick : away + gap + (pick - leftW);
}

/** 捣蛋物 / 辣椒的落点：离预测中的篮子 80px 以外 */
export function hazardX(
  basketAt: number,
  r: number,
  minX = BASKET_MIN_X,
  maxX = BASKET_MAX_X,
  clear = HAZARD_CLEAR
): number {
  return awayFrom(basketAt, r, minX, maxX, clear);
}

function makeDrop(landAt: number, x: number, vy0: number, kind: FruitKind, bonus: boolean): DropPlan {
  const fallLen = CATCH_Y - SPAWN_Y;
  let vy = vy0;
  let at = landAt - fallLen / vy;
  if (at < 0) {
    at = 0;
    vy = fallLen / Math.max(0.35, landAt);
  }
  return { at, x, vy, kind, landAt, bonus };
}

/** 把「时刻 + 种类」的时间轴摆成条条可达的落点表 */
function layoutPlan(slots: readonly Slot[], rand: () => number, opts: PlanOptions): DropPlan[] {
  const speed = opts.basketSpeed ?? BASKET_SPEED;
  const minX = opts.minX ?? BASKET_MIN_X;
  const maxX = opts.maxX ?? BASKET_MAX_X;
  const startX = clampBasket(opts.startX ?? W / 2);
  const twinChance = opts.twinChance ?? TWIN_CHANCE;
  const use = Math.max(MIN_REACH_USE, Math.min(1, opts.reachUse ?? 1));

  // 好果连成一条「篮子跑得过来」的链
  const xs = new Array<number>(slots.length).fill(0);
  const chain: Array<{ landAt: number; x: number }> = [];
  let prevX = startX;
  let prevT = opts.startT ?? 0;
  for (let i = 0; i < slots.length; i++) {
    if (isHazard(slots[i].kind)) continue;
    const span = reachSpan(slots[i].landAt - prevT, speed) * use;
    const lo = Math.max(minX, prevX - span);
    const hi = Math.min(maxX, prevX + span);
    const x = lo + rand() * Math.max(0, hi - lo);
    xs[i] = x;
    chain.push({ landAt: slots[i].landAt, x });
    prevX = x;
    prevT = slots[i].landAt;
  }

  // 碰不得的东西避开这条链，绝不逼孩子在「接」和「躲」之间二选一
  for (let i = 0; i < slots.length; i++) {
    if (!isHazard(slots[i].kind)) continue;
    xs[i] = hazardX(predictBasket(chain, slots[i].landAt, startX, speed, opts.startT ?? 0), rand(), minX, maxX);
  }

  const out: DropPlan[] = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    out.push(makeDrop(s.landAt, xs[i], s.vy, s.kind, false));
    if (!isHazard(s.kind) && i > 0 && rand() < twinChance) {
      // 同时落地的第二颗：故意摆到另一头，明摆着二选一，漏了不扣爱心
      const twinX = awayFrom(xs[i], rand(), minX, maxX, TWIN_GAP);
      out.push(makeDrop(s.landAt, twinX, s.vy * 0.98, rand() < 0.3 ? "gold" : "fruit", true));
    }
  }
  return out;
}

/** 排一整关的下落表 */
export function planDrops(cfg: CatchLevel, seed: number, opts: PlanOptions = {}): DropPlan[] {
  const count = opts.count ?? 90;
  const rand = mulberry32(seed >>> 0);
  const slots: Slot[] = [];
  let land = opts.firstLand ?? FIRST_LAND;
  for (let i = 0; i < count; i++) {
    if (i > 0) land += slotGap(cfg, i);
    const kind = pickKind(cfg, rand());
    slots.push({ landAt: land, kind, vy: (90 + rand() * 60 + i * 3) * cfg.speed * FRUITS[kind].fallMul });
  }
  return layoutPlan(slots, rand, { reachUse: cfg.reach, ...opts });
}

/**
 * 走一遍下落表，标出哪些是「必接」哪些是「奖励果」。
 * 碰不得的东西不进链；已经标好的奖励果保持原样。
 */
export function markReachable(
  drops: DropPlan[],
  startX = W / 2,
  speed = BASKET_SPEED,
  startT = 0
): DropPlan[] {
  const sorted = [...drops].sort((a, b) => a.landAt - b.landAt);
  let atX = clampBasket(startX);
  let atT = startT;
  for (const d of sorted) {
    if (isHazard(d.kind) || d.bonus) continue;
    const span = reachSpan(d.landAt - atT, speed);
    if (Math.abs(d.x - atX) <= span + 1e-9) {
      atX = d.x;
      atT = d.landAt;
    } else {
      d.bonus = true;
    }
  }
  return drops;
}

export interface ReachReport {
  ok: boolean;
  /** 第一颗赶不到的（没有就是 -1） */
  firstBad: number;
  bonusCount: number;
  /** 篮子照着链走时，被碰不得的东西擦到几次 */
  hazardRisk: number;
}

/** 检查一整张下落表：必接的条条赶得到，碰不得的一次都擦不着 */
export function checkReachable(
  drops: readonly DropPlan[],
  startX = W / 2,
  speed = BASKET_SPEED
): ReachReport {
  const sorted = [...drops].sort((a, b) => a.landAt - b.landAt);
  const chain = sorted.filter((d) => !isHazard(d.kind) && !d.bonus);
  let atX = clampBasket(startX);
  let atT = 0;
  let bonusCount = 0;
  let firstBad = -1;
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (isHazard(d.kind)) continue;
    if (d.bonus) {
      bonusCount++;
      continue;
    }
    const span = reachSpan(d.landAt - atT, speed);
    if (Math.abs(d.x - atX) > span + 1e-6) {
      firstBad = i;
      break;
    }
    atX = d.x;
    atT = d.landAt;
  }
  let hazardRisk = 0;
  for (const d of sorted) {
    if (!isHazard(d.kind)) continue;
    const p = predictBasket(chain, d.landAt, startX, speed);
    if (Math.abs(d.x - p) <= BASKET_HALF + SNAP_PX) hazardRisk++;
  }
  return { ok: firstBad < 0 && hazardRisk === 0, firstBad, bonusCount, hazardRisk };
}

/**
 * 照着链走一趟，篮子最少要跑多快才一颗都不漏（像素/秒）。
 * 它就是这一关的「手速门槛」：比 BASKET_SPEED 越低，这一关越宽松。
 */
export function minSpeedNeeded(drops: readonly DropPlan[], startX = W / 2): number {
  const chain = [...drops].filter((d) => !isHazard(d.kind) && !d.bonus).sort((a, b) => a.landAt - b.landAt);
  let atX = clampBasket(startX);
  let atT = 0;
  let need = 0;
  for (const d of chain) {
    const gap = d.landAt - atT;
    if (gap > 0) need = Math.max(need, Math.abs(d.x - atX) / gap);
    atX = d.x;
    atT = d.landAt;
  }
  return need;
}

/** 同一刻落地的都有谁：至少要有一颗是必接的 */
export function sameFrameGroups(drops: readonly DropPlan[], eps = 1e-6): DropPlan[][] {
  const sorted = [...drops].sort((a, b) => a.landAt - b.landAt);
  const out: DropPlan[][] = [];
  let cur: DropPlan[] = [];
  for (const d of sorted) {
    if (cur.length > 0 && Math.abs(d.landAt - cur[0].landAt) > eps) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
    cur.push(d);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// 五、风 / 传送带：落点必须还是生成器算好的那一个
// ---------------------------------------------------------------------------

/** 一秒里飘几个来回 */
export const WIND_OMEGA = 2.2;

/**
 * 风把水果吹偏多少：正弦摆动，且**落地那一刻偏移恰好是 0**，
 * 所以看得见的摇摆不会破坏生成器算好的可达性。
 */
export function windOffset(t: number, landAt: number, wind: number, phaseSign = 1): number {
  if (wind <= 0) return 0;
  return phaseSign * Math.sin((t - landAt) * WIND_OMEGA) * wind * 46;
}

/** 传送带：让水果从这里滑到生成器算好的落点 */
export function beltSpawnX(planX: number, conveyor: number, dwell: number, pad = 14): number {
  return Math.max(pad, Math.min(W - pad, planX - conveyor * dwell));
}

/** 传送带滑行进度（0..1）对应的横坐标 */
export function beltX(fromX: number, planX: number, k: number): number {
  const p = Math.max(0, Math.min(1, k));
  return fromX + (planX - fromX) * p;
}

// ---------------------------------------------------------------------------
// 六、双人同屏：各接各的，比谁接得多
// ---------------------------------------------------------------------------

export type Player = "doudou" | "star";

export const PLAYERS: Readonly<Record<Player, { name: string; emoji: string; keys: string; color: string }>> = {
  doudou: { name: "朵朵", emoji: "🌸", keys: "A / D", color: "#F07AA8" },
  star: { name: "星星", emoji: "⭐", keys: "← / →", color: "#5A9BE8" }
};

export interface DuoState {
  doudou: number;
  star: number;
  missDoudou: number;
  missStar: number;
}

export function duoInit(): DuoState {
  return { doudou: 0, star: 0, missDoudou: 0, missStar: 0 };
}

/** 落在左半屏归朵朵，右半屏归星星 */
export function duoSide(x: number, width = W): Player {
  return x < width / 2 ? "doudou" : "star";
}

export function duoCatch(st: DuoState, who: Player, gain: number): DuoState {
  return who === "doudou" ? { ...st, doudou: st.doudou + gain } : { ...st, star: st.star + gain };
}

export function duoMiss(st: DuoState, who: Player): DuoState {
  return who === "doudou" ? { ...st, missDoudou: st.missDoudou + 1 } : { ...st, missStar: st.missStar + 1 };
}

export function duoWinner(st: DuoState): Player | "tie" {
  if (st.doudou > st.star) return "doudou";
  if (st.star > st.doudou) return "star";
  return "tie";
}

/** 双人一局接到多少颗算完 */
export const DUO_GOAL = 30;

export function duoDone(st: DuoState, goal = DUO_GOAL): boolean {
  return st.doudou >= goal || st.star >= goal;
}

/** 双人收场词：赢的夸、输的也夸 */
export function duoWord(st: DuoState): string {
  const w = duoWinner(st);
  if (w === "tie") return `${st.doudou} 比 ${st.star}，打平啦！你们俩的手速一模一样～`;
  const win = PLAYERS[w];
  const lose = PLAYERS[w === "doudou" ? "star" : "doudou"];
  const hi = Math.max(st.doudou, st.star);
  const lo = Math.min(st.doudou, st.star);
  return `${win.emoji} ${win.name} ${hi} 颗，${lose.emoji} ${lose.name} ${lo} 颗，${win.name}这局手更快！再来一局换边试试～`;
}

// ---------------------------------------------------------------------------
// 七、无尽「水果雨」
// ---------------------------------------------------------------------------

export const RAIN_MISS_LIMIT = 3;

/** 第 wave 颗的间隔（毫秒）：越往后越密，有下限 */
export function rainSpawnMs(wave: number): number {
  return Math.max(420, 1000 - wave * 9);
}

/** 第 wave 颗的速度倍率：越往后越快，有上限 */
export function rainSpeed(wave: number): number {
  return Math.min(2.1, 0.95 + wave * 0.016);
}

/** 水果雨一次生成这么多颗，接完了再续下一段——所以它是真的没有尽头 */
export const RAIN_CHUNK = 320;

/** 出场表只剩这么多颗没出场时就提前续段，别等真的见底 */
export const RAIN_LOOKAHEAD = 40;

/**
 * 水果雨的一段出场表：同一个种子永远是同一段，并且条条可达。
 *
 * `fromWave` 是这一段的第一颗在整场雨里排第几（0 就是开场那一段）。
 * 间隔与落速都按它算，所以第二段接着第一段继续变密变快，
 * 而不是回到开场那种慢悠悠的节奏。
 */
export function rainPlan(seed: number, count = RAIN_CHUNK, opts: PlanOptions = {}, fromWave = 0): DropPlan[] {
  const rand = mulberry32(seed >>> 0);
  const slots: Slot[] = [];
  let land = opts.firstLand ?? FIRST_LAND;
  for (let i = 0; i < count; i++) {
    const wave = fromWave + i;
    if (wave > 0) land += rainSpawnMs(wave) / 1000;
    const r = rand();
    let kind: FruitKind = "fruit";
    if (r < 0.1) kind = "chili";
    else if (r < 0.17) kind = "gold";
    else if (r < 0.23) kind = "freeze";
    else if (r < 0.29) kind = "magnet";
    else if (r < 0.36) kind = "heavy";
    slots.push({ landAt: land, kind, vy: (100 + rand() * 60) * rainSpeed(wave) * FRUITS[kind].fallMul });
  }
  return layoutPlan(slots, rand, { twinChance: 0.14, ...opts });
}

/**
 * 接着 `prev` 这一段往下续一段，返回「已经标好必接 / 奖励果」的新一段。
 *
 * 续段的接缝要接得上：新一段从上一段最后一颗的落点、落地时刻起算，
 * 篮子不需要瞬移就能跟上第一颗。
 */
export function rainExtend(prev: readonly DropPlan[], seed: number, fromWave: number, count = RAIN_CHUNK): DropPlan[] {
  let lastX = W / 2;
  let lastT = 0;
  for (const d of prev) {
    if (d.bonus || isHazard(d.kind) || d.landAt < lastT) continue;
    lastX = d.x;
    lastT = d.landAt;
  }
  const more = rainPlan(seed, count, { firstLand: lastT, startX: lastX, startT: lastT }, fromWave);
  return markReachable(more, lastX, BASKET_SPEED, lastT);
}

export interface RainState {
  score: number;
  caught: number;
  missed: number;
  combo: number;
  bestCombo: number;
  over: boolean;
}

export function rainInit(): RainState {
  return { score: 0, caught: 0, missed: 0, combo: 0, bestCombo: 0, over: false };
}

export function rainCatch(st: RainState, kind: FruitKind): RainState {
  if (st.over) return st;
  if (isHazard(kind)) {
    // 接到辣椒 / 捣蛋物：断连击、少一次机会
    const missed = st.missed + 1;
    return { ...st, missed, combo: 0, over: missed >= RAIN_MISS_LIMIT };
  }
  const combo = st.combo + 1;
  return {
    ...st,
    score: st.score + scoreFor(kind, st.combo),
    caught: st.caught + FRUITS[kind].gain,
    combo,
    bestCombo: Math.max(st.bestCombo, combo)
  };
}

export function rainMiss(st: RainState, kind: FruitKind, bonus = false): RainState {
  if (st.over) return st;
  if (bonus || !missCostsLife(kind)) return { ...st, combo: 0 };
  const missed = st.missed + 1;
  return { ...st, missed, combo: 0, over: missed >= RAIN_MISS_LIMIT };
}

/** 无尽收场词：只夸不批评 */
export function rainWord(st: RainState, best: number): string {
  if (st.score >= best && st.score > 0) return `🎉 ${st.score} 分，新纪录！最长连接 ${st.bestCombo} 颗，稳得很！`;
  return `这场接了 ${st.caught} 颗、${st.score} 分，最长连接 ${st.bestCombo} 颗～离最好成绩 ${best} 分不远啦，再来一场！`;
}

// ---------------------------------------------------------------------------
// 八、188 关模拟：让假玩家把每一关都接一遍
// ---------------------------------------------------------------------------

export interface SimOptions {
  seed?: number;
  dt?: number;
  /** 生成器排「跑得过来的链」时假定的篮子速度 */
  basketSpeed?: number;
  /**
   * 假玩家真正跑得多快（不填就跟 basketSpeed 一样）。
   * 把它调低就是「手慢一点的孩子」：这一关到底留了多少余量，一跑就知道。
   */
  playerSpeed?: number;
  maxSeconds?: number;
  count?: number;
}

export interface SimResult {
  won: boolean;
  caught: number;
  target: number;
  missed: number;
  /** 漏掉的奖励果（不扣爱心） */
  bonusMissed: number;
  /** 被碰不得的东西擦到几次 */
  hazardHits: number;
  bestCombo: number;
  seconds: number;
  /** 这一关照着链走最少要跑多快（像素/秒），拿来量难度曲线 */
  needSpeed: number;
}

interface SimItem extends DropPlan {
  y: number;
  done: boolean;
}

/**
 * 假玩家的策略就是「照着生成器排好的链走」：
 * 接完这一颗立刻全速赶往下一颗的落点，到了就站着等。
 * 生成器留了 15% 余量，所以它永远早到；碰不得的东西离链 80px，所以它永远擦不着。
 */
export function simulateLevel(cfg: CatchLevel, opts: SimOptions = {}): SimResult {
  const dt = opts.dt ?? 1 / 60;
  // 生成器按 planSpeed 排链，假玩家按 playerSpeed 跑：
  // 两者分开，才能既验证「设计上够得着」，又量出「手慢一点还剩多少余量」。
  const planSpeed = opts.basketSpeed ?? BASKET_SPEED;
  const speed = opts.playerSpeed ?? planSpeed;
  const maxSeconds = opts.maxSeconds ?? 400;
  const startX = W / 2;
  const plan = markReachable(
    planDrops(cfg, opts.seed ?? 20250520, { count: opts.count ?? 140, startX, basketSpeed: planSpeed }),
    startX,
    planSpeed
  );
  const needSpeed = minSpeedNeeded(plan, startX);
  const items: SimItem[] = plan.map((p) => ({ ...p, y: SPAWN_Y, done: false }));
  const chain = items.filter((it) => !isHazard(it.kind) && !it.bonus).sort((a, b) => a.landAt - b.landAt);

  let ci = 0;
  let t = 0;
  let basketX = startX;
  let caught = 0;
  let missed = 0;
  let bonusMissed = 0;
  let hazardHits = 0;
  let combo = 0;
  let bestCombo = 0;
  let left = items.length;

  while (t < maxSeconds && left > 0) {
    while (ci < chain.length && chain[ci].done) ci++;
    if (ci < chain.length) {
      const d = chain[ci].x - basketX;
      basketX = clampBasket(basketX + Math.sign(d) * Math.min(Math.abs(d), speed * dt));
    }
    t += dt;

    for (const it of items) {
      if (it.done || t < it.at) continue;
      it.y += it.vy * dt;
      if (it.y < CATCH_Y) continue;
      it.done = true;
      left--;
      const grabbed = isCaught(it.x, CATCH_Y, basketX);
      if (isHazard(it.kind)) {
        if (grabbed) {
          hazardHits++;
          missed++;
          combo = 0;
        }
      } else if (grabbed) {
        caught += FRUITS[it.kind].gain;
        combo++;
        bestCombo = Math.max(bestCombo, combo);
      } else if (it.bonus) {
        bonusMissed++;
      } else {
        missed++;
        combo = 0;
      }
    }

    if (caught >= cfg.target) {
      return { won: true, caught, target: cfg.target, missed, bonusMissed, hazardHits, bestCombo, seconds: t, needSpeed };
    }
    if (missed >= MAX_MISS) break;
  }

  return { won: false, caught, target: cfg.target, missed, bonusMissed, hazardHits, bestCombo, seconds: t, needSpeed };
}

// ---------------------------------------------------------------------------
// 九、资源看管：destroy 之后必须一件不剩
// ---------------------------------------------------------------------------

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame?(fn: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
}

export interface ListenerTarget {
  addEventListener(type: string, fn: (ev: Event) => void): void;
  removeEventListener(type: string, fn: (ev: Event) => void): void;
}

function defaultHost(): TimerHost {
  const g = globalThis as unknown as TimerHost;
  return {
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (id) => g.clearTimeout(id),
    requestAnimationFrame: g.requestAnimationFrame
      ? (fn) => (g.requestAnimationFrame as (f: (t: number) => void) => number)(fn)
      : undefined,
    cancelAnimationFrame: g.cancelAnimationFrame
      ? (id) => (g.cancelAnimationFrame as (i: number) => void)(id)
      : undefined
  };
}

/** 定时器 / rAF / 两套键位监听的总管：`pending()` 在 destroy 之后必须是 0 */
export class Janitor {
  private timers = new Set<number>();
  private frames = new Set<number>();
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
  }

  pending(): number {
    return this.timers.size + this.frames.size + this.offs.length;
  }

  after(ms: number, fn: () => void): number {
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  frame(fn: (t: number) => void): number {
    if (!this.host.requestAnimationFrame) return 0;
    const id = this.host.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.add(id);
    return id;
  }

  on<T extends ListenerTarget>(target: T, type: string, fn: (ev: Event) => void): void {
    target.addEventListener(type, fn);
    this.own(() => target.removeEventListener(type, fn));
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  destroy(): void {
    this.dead = true;
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    for (const id of this.frames) this.host.cancelAnimationFrame?.(id);
    this.frames.clear();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 接住小水果清理时出错:", err);
      }
    }
  }
}
