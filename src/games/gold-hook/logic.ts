/**
 * 金矿钩钩 · 玩法内核(纯函数,一行 DOM 都不碰)。
 *
 * 这一份负责三件事,全部可以单独测:
 *  1. **摆动**:钩子在矿洞顶端匀速来回摆,到端点折返,是一条标准三角波;
 *     还要能反算「等钩子摆到某个角度还要多久」,不然模拟器没法排计划。
 *  2. **回收**:钩到的东西越重拉得越慢,喝了力量水会快一截,上下都夹死,
 *     免得出现「拉一块大石头要两分钟」或者「一瞬间就回来了」。
 *  3. **算账**:矿物估值(幸运石只加成矿物、不加成石头)、商店买卖、
 *     以及一个确定性的贪心模拟器 —— 每一关的目标金额都是拿它算出来的,
 *     所以「目标一定拿得到」是构造出来的结论,不是拍脑袋定的。
 *
 * 坐标约定:钩子挂在矿洞顶端的 (PIVOT_X, PIVOT_Y),角度从「正下方」量起,
 * 向右为正、向左为负,单位一律是度。
 */

// ---------------------------------------------------------------------------
// 场地尺寸(逻辑坐标;渲染时整体等比缩放到可用宽度)
// ---------------------------------------------------------------------------

export const FIELD_W = 360;
export const FIELD_H = 520;
/** 钩子的悬挂点 */
export const PIVOT_X = 180;
export const PIVOT_Y = 58;
/** 矿石最高只能埋到这条线以下,免得贴着钩子生成 */
export const DIG_TOP = 126;
/** 矿石最低埋到这条线 */
export const DIG_BOTTOM = 502;
/** 左右各留出来的石壁厚度 */
export const WALL = 20;

// ---------------------------------------------------------------------------
// 速度
// ---------------------------------------------------------------------------

/** 放绳速度(px/秒),和钩到什么无关 */
export const EXTEND_SPEED = 165;
/** 空钩(炸掉了钩上的东西)往回收的速度 */
export const EMPTY_RETRACT = 320;
/** 回收速度的基准值:相当于「重量 0」时的速度 */
export const BASE_RETRACT = 145;
/** 重量的换算单位:重量等于它时速度正好减半 */
export const WEIGHT_UNIT = 10;
/** 每瓶力量水给回收速度加的比例 */
export const STRENGTH_STEP = 0.3;
/** 再重也不会比这个还慢,否则一关就耗在一块石头上 */
export const MIN_RETRACT = 20;
/** 力量水最多喝几瓶 */
export const MAX_STRENGTH = 3;
/** 幸运石最多带几块 */
export const MAX_LUCK = 3;
/** 每块幸运石给矿物加的价钱比例 */
export const LUCK_STEP = 0.15;
/** 炸药最多囤几个 */
export const MAX_BOMBS = 5;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.round(clamp(v, lo, hi));
}

// ---------------------------------------------------------------------------
// 三角波:钩子的摆动、地鼠的左右跑动都是同一条曲线
// ---------------------------------------------------------------------------

/**
 * 三角波:从 -span 出发匀速涨到 +span,再匀速回到 -span,如此往复。
 * `speed` 是单位时间走过的「幅度」,`phase` 是初相(同样按幅度计)。
 * span <= 0 或 speed <= 0 时退化成常数 0 / 常数 -span,不会除零。
 */
export function triangleWave(t: number, speed: number, span: number, phase = 0): number {
  const s = Math.abs(span);
  if (s <= 0) return 0;
  const full = 4 * s;
  const v = Math.abs(speed);
  if (v <= 0) return clamp(phase, -s, s);
  let u = ((v * t + (phase + s)) % full + full) % full;
  if (u <= 2 * s) return u - s;
  return 3 * s - u;
}

/**
 * 还要等多久,三角波才第一次取到 `target`(t 时刻起算,含 0)。
 * target 超出 [-span, span] 会先夹到端点上 —— 端点每个来回都会经过,永远等得到。
 */
export function timeToWaveValue(t: number, target: number, speed: number, span: number, phase = 0): number {
  const s = Math.abs(span);
  const v = Math.abs(speed);
  if (s <= 0 || v <= 0) return 0;
  const goal = clamp(target, -s, s);
  const full = 4 * s;
  const now = ((v * t + (phase + s)) % full + full) % full;
  // 一个周期里恰好两次经过 goal:上行一次、下行一次
  const up = goal + s;
  const down = 3 * s - goal;
  const waitUp = ((up - now) % full + full) % full;
  const waitDown = ((down - now) % full + full) % full;
  return Math.min(waitUp, waitDown) / v;
}

// ---------------------------------------------------------------------------
// 矿洞里的东西
// ---------------------------------------------------------------------------

export type OreKind =
  | "nugget"
  | "goldSmall"
  | "goldBig"
  | "goldHuge"
  | "pebble"
  | "boulder"
  | "gem"
  | "chest"
  | "mole";

export interface OreProfile {
  label: string;
  emoji: string;
  /** 基准价钱(宝箱按种子另外摇,存在 Ore.value 上) */
  value: number;
  /** 重量,只影响回收速度 */
  weight: number;
  /** 半径,决定钩子多大范围算钩到,也决定它在扇面上占多宽的一条道 */
  radius: number;
  /** 算不算矿物:幸运石只给矿物加价钱,石头照旧不值钱 */
  treasure: boolean;
}

export const ORES: Record<OreKind, OreProfile> = {
  nugget: { label: "小金粒", emoji: "🪙", value: 22, weight: 3, radius: 7, treasure: true },
  goldSmall: { label: "金块", emoji: "🟨", value: 58, weight: 7, radius: 10, treasure: true },
  goldBig: { label: "大金块", emoji: "🟧", value: 130, weight: 13, radius: 15, treasure: true },
  goldHuge: { label: "巨型金块", emoji: "🏵️", value: 265, weight: 21, radius: 20, treasure: true },
  pebble: { label: "碎石", emoji: "🪨", value: 9, weight: 9, radius: 11, treasure: false },
  boulder: { label: "大石头", emoji: "🗿", value: 16, weight: 23, radius: 17, treasure: false },
  gem: { label: "钻石", emoji: "💎", value: 380, weight: 2, radius: 8, treasure: true },
  chest: { label: "宝箱", emoji: "🧰", value: 150, weight: 6, radius: 13, treasure: true },
  mole: { label: "小地鼠", emoji: "🐹", value: 95, weight: 4, radius: 10, treasure: true },
};

/** 全部矿石种类,遍历与校验用 */
export const ORE_KINDS: OreKind[] = Object.keys(ORES) as OreKind[];

export interface Ore {
  id: number;
  kind: OreKind;
  /** 埋点(地鼠是它跑动区间的中点) */
  x: number;
  y: number;
  /** 这一颗实际值多少(宝箱按种子摇过,其余等于 profile.value) */
  value: number;
  weight: number;
  radius: number;
  /** 左右跑动的半径,0 表示钉在原地 */
  runRange: number;
  /** 跑动速度(px/秒) */
  runSpeed: number;
}

/** 地鼠此刻在哪(不会跑的东西直接返回埋点) */
export function oreX(ore: Ore, t: number): number {
  if (ore.runRange <= 0 || ore.runSpeed <= 0) return ore.x;
  return ore.x + triangleWave(t, ore.runSpeed, ore.runRange, 0);
}

/** 悬挂点到某个点的距离 */
export function distanceFromPivot(x: number, y: number): number {
  return Math.hypot(x - PIVOT_X, y - PIVOT_Y);
}

/** 悬挂点看过去的角度(度,正下方为 0,向右为正) */
export function angleFromPivot(x: number, y: number): number {
  return (Math.atan2(x - PIVOT_X, Math.max(1, y - PIVOT_Y)) * 180) / Math.PI;
}

/**
 * 一颗矿石在扇面上占多宽的一条「道」(度)。
 * 会跑的地鼠按「半径 + 跑动半径」算,保证它跑到哪一头都还在自己那条道里。
 */
export function angularHalfWidth(ore: Pick<Ore, "x" | "y" | "radius" | "runRange">): number {
  const d = Math.max(1, distanceFromPivot(ore.x, ore.y));
  return (Math.atan2(ore.radius + ore.runRange, d) * 180) / Math.PI;
}

/** 两颗矿石的「道」有没有叠在一起(叠了就会互相挡,生成时要避开) */
export function lanesOverlap(a: Ore, b: Ore, pad = 1.5): boolean {
  const gap = Math.abs(angleFromPivot(a.x, a.y) - angleFromPivot(b.x, b.y));
  return gap < angularHalfWidth(a) + angularHalfWidth(b) + pad;
}

export interface Span {
  lo: number;
  hi: number;
}

/**
 * 在 [lo, hi] 里挖掉一堆已占区间之后,还剩哪些连续空档(升序,已合并)。
 * 矿洞生成靠它给每颗矿石找一条不和别人叠的「车道」。
 */
export function freeGaps(taken: readonly Span[], lo: number, hi: number): Span[] {
  if (hi <= lo) return [];
  const sorted = taken
    .filter((s) => s.hi > lo && s.lo < hi)
    .map((s) => ({ lo: Math.max(lo, s.lo), hi: Math.min(hi, s.hi) }))
    .sort((a, b) => a.lo - b.lo);
  const out: Span[] = [];
  let cursor = lo;
  for (const s of sorted) {
    if (s.lo > cursor) out.push({ lo: cursor, hi: s.lo });
    cursor = Math.max(cursor, s.hi);
  }
  if (cursor < hi) out.push({ lo: cursor, hi });
  return out;
}

// ---------------------------------------------------------------------------
// 回收速度与估值
// ---------------------------------------------------------------------------

/**
 * 钩到重量 `weight` 的东西之后,往回收的速度(px/秒)。
 * 越重越慢(双曲线,不会掉到 0),每瓶力量水整体抬 30%,上下都夹死。
 */
export function retractSpeed(weight: number, strength = 0): number {
  const w = Math.max(0, Number.isFinite(weight) ? weight : 0);
  const s = clampInt(strength, 0, MAX_STRENGTH);
  const raw = BASE_RETRACT * (1 + STRENGTH_STEP * s) * (WEIGHT_UNIT / (WEIGHT_UNIT + w));
  return clamp(raw, MIN_RETRACT, EMPTY_RETRACT);
}

/** 钩到某颗矿石之后,把它拉上来要多久(秒) */
export function retractTime(ore: Ore, distance: number, strength = 0): number {
  return Math.max(0, distance) / retractSpeed(ore.weight, strength);
}

/** 这一颗到手能换多少金币:幸运石只给矿物加价,石头照旧那么不值钱 */
export function haulValue(ore: Ore, luck = 0): number {
  const l = clampInt(luck, 0, MAX_LUCK);
  if (!ORES[ore.kind].treasure) return Math.round(ore.value);
  return Math.round(ore.value * (1 + LUCK_STEP * l));
}

/**
 * 钩一趟完整的来回要多久:等钩子摆过去 + 放绳 + 拉回来。
 *
 * `swingClock` 是**摆动自己的钟**,不是总时间 —— 绳子放出去以后钩子就不摆了,
 * 收回来时停在哪个角度,下一趟就从那个角度接着摆。渲染层也是这么实现的,
 * 两边用同一套时钟,模拟器算出来的耗时才和真实玩法对得上。
 */
export function haulTime(
  ore: Ore,
  field: Pick<MineField, "swingSpeed" | "swingSpan" | "phase">,
  swingClock: number,
  strength = 0
): number {
  const d = distanceFromPivot(ore.x, ore.y);
  const a = angleFromPivot(ore.x, ore.y);
  const wait = timeToWaveValue(swingClock, a, field.swingSpeed, field.swingSpan, field.phase);
  return wait + d / EXTEND_SPEED + retractTime(ore, d, strength);
}

/** 等钩子摆到这颗矿石的角度还要多久 */
export function waitFor(
  ore: Ore,
  field: Pick<MineField, "swingSpeed" | "swingSpan" | "phase">,
  swingClock: number
): number {
  return timeToWaveValue(swingClock, angleFromPivot(ore.x, ore.y), field.swingSpeed, field.swingSpan, field.phase);
}

// ---------------------------------------------------------------------------
// 矿洞
// ---------------------------------------------------------------------------

export interface MineField {
  ores: Ore[];
  /** 摆动速度(度/秒) */
  swingSpeed: number;
  /** 摆幅:左右各摆这么多度 */
  swingSpan: number;
  /** 初相(按度计) */
  phase: number;
  /** 绳子最长能放多远 */
  ropeMax: number;
  /** 这一关给多少秒 */
  time: number;
}

/** 此刻钩子指向哪个角度 */
export function hookAngle(field: Pick<MineField, "swingSpeed" | "swingSpan" | "phase">, t: number): number {
  return triangleWave(t, field.swingSpeed, field.swingSpan, field.phase);
}

/** 钩子沿角度 a 放出 len 长度之后,钩尖落在哪 */
export function hookTip(angleDeg: number, len: number): { x: number; y: number } {
  const r = (angleDeg * Math.PI) / 180;
  return { x: PIVOT_X + Math.sin(r) * len, y: PIVOT_Y + Math.cos(r) * len };
}

/**
 * 钩尖此刻钩到了谁:取第一颗圆心距离小于「钩尖半径 + 矿石半径」的。
 * 生成时保证了每颗矿石各占一条互不重叠的道,所以这里最多只会命中一颗。
 */
export function hookedOre(field: MineField, tip: { x: number; y: number }, t: number, tipR = 8): Ore | null {
  for (const ore of field.ores) {
    const x = oreX(ore, t);
    if (Math.hypot(tip.x - x, tip.y - ore.y) <= tipR + ore.radius) return ore;
  }
  return null;
}

/** 钩尖出界(撞到矿洞边缘或者放到头了)就该往回收了 */
export function ropeExhausted(field: MineField, len: number, tip: { x: number; y: number }): boolean {
  return len >= field.ropeMax || tip.y >= DIG_BOTTOM + 14 || tip.x <= 6 || tip.x >= FIELD_W - 6;
}

// ---------------------------------------------------------------------------
// 商店:全程只花「关内金币」,不碰平台的小星星
// ---------------------------------------------------------------------------

export type ShopKind = "bomb" | "power" | "luck";

export interface ShopEntry {
  label: string;
  emoji: string;
  desc: string;
  /** 第一次买多少钱 */
  base: number;
  /** 每多买一件涨多少 */
  step: number;
  /** 最多买几件 */
  max: number;
}

export const SHOP: Record<ShopKind, ShopEntry> = {
  bomb: {
    label: "炸药",
    emoji: "💥",
    desc: "拉上来之前炸掉钩住的东西,空钩飞快收回,不再干耗时间",
    base: 25,
    step: 10,
    max: MAX_BOMBS,
  },
  power: {
    label: "力量水",
    emoji: "💪",
    desc: "每喝一瓶回收速度整体快三成,越重的东西越受用",
    base: 70,
    step: 60,
    max: MAX_STRENGTH,
  },
  luck: {
    label: "幸运石",
    emoji: "🍀",
    desc: "每带一块,之后钩上来的矿物多卖一成半(石头不算)",
    base: 55,
    step: 45,
    max: MAX_LUCK,
  },
};

export const SHOP_KINDS: ShopKind[] = ["bomb", "power", "luck"];

export interface Wallet {
  coins: number;
  bombs: number;
  strength: number;
  luck: number;
}

export function emptyWallet(coins = 0): Wallet {
  return { coins: Math.max(0, Math.round(coins)), bombs: 0, strength: 0, luck: 0 };
}

/** 已经有 owned 件时,再买一件的价钱 */
export function shopPrice(kind: ShopKind, owned: number): number {
  const e = SHOP[kind];
  return e.base + e.step * Math.max(0, Math.round(owned));
}

/** 钱包里这一项已经有几件 */
export function ownedOf(wallet: Wallet, kind: ShopKind): number {
  if (kind === "bomb") return wallet.bombs;
  if (kind === "power") return wallet.strength;
  return wallet.luck;
}

/** 买不买得起(也看有没有买到上限) */
export function canBuy(wallet: Wallet, kind: ShopKind): boolean {
  const owned = ownedOf(wallet, kind);
  if (owned >= SHOP[kind].max) return false;
  return wallet.coins >= shopPrice(kind, owned);
}

/** 买一件,返回新钱包;买不起或者买满了就原样返回(绝不改传进来的那个) */
export function buyItem(wallet: Wallet, kind: ShopKind): Wallet {
  if (!canBuy(wallet, kind)) return { ...wallet };
  const price = shopPrice(kind, ownedOf(wallet, kind));
  const next: Wallet = { ...wallet, coins: wallet.coins - price };
  if (kind === "bomb") next.bombs += 1;
  else if (kind === "power") next.strength += 1;
  else next.luck += 1;
  return next;
}

/** 用掉一个炸药,返回新钱包;没炸药就原样返回 */
export function useBomb(wallet: Wallet): Wallet {
  if (wallet.bombs <= 0) return { ...wallet };
  return { ...wallet, bombs: wallet.bombs - 1 };
}

// ---------------------------------------------------------------------------
// 评星与文案
// ---------------------------------------------------------------------------

/** 三星要挖到目标的 1.6 倍,两星 1.2 倍 */
export function starsForCoins(coins: number, target: number): 1 | 2 | 3 {
  const t = Math.max(1, target);
  if (coins >= t * 1.6) return 3;
  if (coins >= t * 1.2) return 2;
  return 1;
}

export function winLine(coins: number, target: number, stars: 1 | 2 | 3): string {
  if (stars === 3) return `挖到 ${coins} 金币,是目标的一倍半还多,这条矿脉被你摸透了!`;
  if (stars === 2) return `挖到 ${coins} 金币,超额完成!再多钩一块大的就是三颗星。`;
  return `刚好凑够 ${coins} 金币过关。下次先挑「值钱又轻」的钩,金币会涨得快很多。`;
}

export function loseLine(coins: number, target: number): string {
  const gap = Math.max(1, target - coins);
  if (gap <= target * 0.15) return `就差 ${gap} 金币!少钩一块石头就够了,再来一次。`;
  return `这一趟只挖到 ${coins} 金币,离 ${target} 还差 ${gap}。钻石又轻又值钱,优先把它钩上来。`;
}

// ---------------------------------------------------------------------------
// 确定性模拟器:证明每一关的目标金额拿得到
// ---------------------------------------------------------------------------

export type SimStrategy = "greedy" | "value" | "near";

export interface SimOptions {
  strength?: number;
  luck?: number;
  /**
   * 手不准的损耗:每一趟的耗时都乘上 (1 + timePenalty)。
   * 0 是「每一钩都掐在最准的那一帧」,0.15 差不多是一个认真的小学生。
   */
  timePenalty?: number;
  /** greedy=性价比优先 value=先钩最值钱的 near=先钩最近的 */
  strategy?: SimStrategy;
  /** 要不要把石头也钩上来(默认不钩,摆烂测试才打开) */
  takeRocks?: boolean;
  /** 要不要钩矿物(默认要;关掉就是「专挑石头钩」的摆烂玩法) */
  takeTreasure?: boolean;
  /**
   * 要不要把会跑的地鼠算进来。默认不算:地鼠会躲,把它当纯赚头,
   * 目标金额只按「站着不动的矿」算,这样目标一定拿得到。
   */
  takeMoles?: boolean;
}

export interface SimResult {
  coins: number;
  /** 钩上来几趟 */
  hauls: number;
  /** 一共用掉多少秒 */
  timeUsed: number;
  /** 依次钩了哪些矿石 id */
  picked: number[];
}

/**
 * 按固定策略把一关跑完(纯函数,同样的输入永远同样的输出)。
 *
 * 模型和真实玩法一致:等钩子摆到那颗矿的角度 → 放绳 → 拉回来,
 * 三段时间加起来就是这一趟的开销;时间不够走完的那一趟就不出手。
 */
export function simulateRun(field: MineField, opts: SimOptions = {}): SimResult {
  const strength = clampInt(opts.strength ?? 0, 0, MAX_STRENGTH);
  const luck = clampInt(opts.luck ?? 0, 0, MAX_LUCK);
  const penalty = 1 + Math.max(0, opts.timePenalty ?? 0);
  const strategy = opts.strategy ?? "greedy";
  const takeRocks = opts.takeRocks ?? false;
  const takeTreasure = opts.takeTreasure ?? true;
  const takeMoles = opts.takeMoles ?? false;

  const left = field.ores.filter((o) => {
    const treasure = ORES[o.kind].treasure;
    if (!takeRocks && !treasure) return false;
    if (!takeTreasure && treasure) return false;
    if (!takeMoles && o.runRange > 0) return false;
    return distanceFromPivot(o.x, o.y) <= field.ropeMax;
  });

  // 两个钟:t 是关卡倒计时走过的总时间,swing 只在钩子闲着来回摆的时候走
  let t = 0;
  let swing = 0;
  let coins = 0;
  const picked: number[] = [];

  while (left.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    let bestCost = 0;
    let bestGain = 0;
    let bestWait = 0;
    for (let i = 0; i < left.length; i++) {
      const ore = left[i];
      const wait = waitFor(ore, field, swing);
      const cost = haulTime(ore, field, swing, strength) * penalty;
      if (t + cost > field.time) continue;
      const gain = haulValue(ore, luck);
      const score = strategy === "greedy" ? gain / Math.max(0.05, cost) : strategy === "value" ? gain : -cost;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestCost = cost;
        bestGain = gain;
        bestWait = wait;
      }
    }
    if (bestIdx < 0) break;
    t += bestCost;
    swing += bestWait;
    coins += bestGain;
    picked.push(left[bestIdx].id);
    left.splice(bestIdx, 1);
  }

  return { coins, hauls: picked.length, timeUsed: t, picked };
}
