// 彩虹跑跑 · 无限模式(1.1 第 6 步新增)
//
// 三件事:
//  1. 程序化拼接路段——分段模板 + 难度随距离升;
//  2. 必过窗口——每一段按构造都留出一条「一个动作都不用做」的空车道路线,
//     相邻两行之间横移不超过一格,所以跑得再远也不会生成过不去的组合;
//  3. 追赶物与三种失败,外加最远距离 / 最高金币数两项纪录。
//
// 这里全是纯函数,不碰 DOM,也不碰战役那 188 关的关卡表。

import type { ObstacleKind, PatternRow } from "./logic";
import { rowIsSurvivable } from "./logic";

/** 随机源:传 Math.random 或者测试里的定种子发生器都行。 */
export type Rng = () => number;

/* ------------------------------------------------------------------ */
/* 难度曲线                                                            */
/* ------------------------------------------------------------------ */

export interface EndlessTier {
  /** 第几档(1 起) */
  level: number;
  name: string;
  /** 从多少米开始进入这一档 */
  fromMeters: number;
  /** 一段拼几行 */
  rows: number;
  /**
   * 除去必过车道之外,一行最多再摆几个障碍。
   * 三条道减去必过的那条只剩两条,所以这个数永远 ≤ 2,空车道一定还在。
   */
  maxObstacles: number;
  /** 这一档会出现的障碍 */
  kinds: ObstacleKind[];
  /** 每行摆金币的概率 */
  coinRate: number;
  /** 每行摆星星的概率 */
  starRate: number;
}

/** 六档难度:越跑越远,障碍越多、种类越杂、段落越长。 */
export const ENDLESS_TIERS: readonly EndlessTier[] = [
  {
    level: 1,
    name: "热身草坪",
    fromMeters: 0,
    rows: 4,
    maxObstacles: 1,
    kinds: ["rock", "hurdle", "bar"],
    coinRate: 0.7,
    starRate: 0.18,
  },
  {
    level: 2,
    name: "换道练习",
    fromMeters: 400,
    rows: 5,
    maxObstacles: 1,
    kinds: ["rock", "hurdle", "bar", "pit"],
    coinRate: 0.62,
    starRate: 0.16,
  },
  {
    level: 3,
    name: "节奏加码",
    fromMeters: 900,
    rows: 5,
    maxObstacles: 2,
    kinds: ["rock", "hurdle", "bar", "pit", "crate"],
    coinRate: 0.56,
    starRate: 0.14,
  },
  {
    level: 4,
    name: "云怪出没",
    fromMeters: 1600,
    rows: 6,
    maxObstacles: 2,
    kinds: ["rock", "hurdle", "bar", "pit", "crate", "cloudy"],
    coinRate: 0.5,
    starRate: 0.12,
  },
  {
    level: 5,
    name: "滚球快线",
    fromMeters: 2600,
    rows: 6,
    maxObstacles: 2,
    kinds: ["rock", "hurdle", "bar", "pit", "crate", "cloudy", "roller"],
    coinRate: 0.46,
    starRate: 0.11,
  },
  {
    level: 6,
    name: "星屑冲刺",
    fromMeters: 4000,
    rows: 7,
    maxObstacles: 2,
    kinds: ["rock", "hurdle", "bar", "pit", "crate", "cloudy", "roller", "zapper"],
    coinRate: 0.42,
    starRate: 0.1,
  },
];

/** 跑到 dist 米时用哪一档难度。 */
export function tierForDistance(dist: number): EndlessTier {
  let out = ENDLESS_TIERS[0];
  for (const t of ENDLESS_TIERS) {
    if (dist >= t.fromMeters) out = t;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 分段模板                                                            */
/* ------------------------------------------------------------------ */

/** 必过车道在这一段里怎么走。 */
export type PathShape = "straight" | "zigzag" | "drift" | "weave";

export interface SegmentTemplate {
  name: string;
  shape: PathShape;
  /** 这个模板偏爱的障碍:能用就优先用,用不了就退回本档的通用池 */
  favor: ObstacleKind[];
  /** 到第几档才解锁 */
  minLevel: number;
}

export const SEGMENT_TEMPLATES: readonly SegmentTemplate[] = [
  { name: "糖果直道", shape: "straight", favor: ["hurdle"], minLevel: 1 },
  { name: "之字换道", shape: "zigzag", favor: ["rock"], minLevel: 1 },
  { name: "跳栏节奏", shape: "drift", favor: ["hurdle", "pit"], minLevel: 2 },
  { name: "趴杆走廊", shape: "drift", favor: ["bar"], minLevel: 2 },
  { name: "纸箱仓库", shape: "weave", favor: ["crate"], minLevel: 3 },
  { name: "云朵飘飘", shape: "weave", favor: ["cloudy"], minLevel: 4 },
  { name: "滚球快线", shape: "zigzag", favor: ["roller"], minLevel: 5 },
  { name: "星屑混合", shape: "weave", favor: ["zapper", "crate"], minLevel: 6 },
];

/** 这一档能抽到的模板。 */
export function templatesForLevel(level: number): SegmentTemplate[] {
  return SEGMENT_TEMPLATES.filter((t) => t.minLevel <= level);
}

function clamp3(lane: number): number {
  return Math.max(0, Math.min(2, lane));
}

function pick<T>(list: readonly T[], rng: Rng): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * 必过车道的走法:第一行一定落在 startLane 上(接得住上一段的收尾),
 * 之后每行最多横移一格——一格是玩家一次换道就能走到的距离。
 */
export function clearLanePath(shape: PathShape, startLane: number, rows: number, rng: Rng): number[] {
  const path: number[] = [clamp3(startLane)];
  let dir = rng() < 0.5 ? -1 : 1;
  for (let i = 1; i < rows; i++) {
    const prev = path[i - 1];
    let next = prev;
    if (shape === "straight") {
      next = rng() < 0.25 ? clamp3(prev + (rng() < 0.5 ? -1 : 1)) : prev;
    } else if (shape === "zigzag") {
      if (prev + dir < 0 || prev + dir > 2) dir = -dir;
      next = clamp3(prev + dir);
      dir = -dir;
    } else if (shape === "drift") {
      if (i % 2 === 1) {
        if (prev + dir < 0 || prev + dir > 2) dir = -dir;
        next = clamp3(prev + dir);
      }
    } else {
      const roll = rng();
      const step = roll < 0.34 ? -1 : roll < 0.68 ? 1 : 0;
      next = clamp3(prev + step);
    }
    path.push(next);
  }
  return path;
}

export interface EndlessSegment {
  /** 模板名,报告和调试时看得懂 */
  name: string;
  /** 用的是第几档难度 */
  level: number;
  rows: PatternRow[];
  /** 逐行的必过车道 */
  clearPath: number[];
  /** 进这一段时玩家该站的车道(等于 clearPath[0]) */
  startLane: number;
}

/**
 * 拼一段路。
 * 先画出必过车道的走法,再往**别的**车道上摆障碍——必过车道那一格永远空着,
 * 所以「一个动作都不用做也能跑过去」这件事是构造出来的,不是碰运气碰出来的。
 */
export function buildSegment(dist: number, startLane: number, rng: Rng): EndlessSegment {
  const tier = tierForDistance(dist);
  const template = pick(templatesForLevel(tier.level), rng);
  const path = clearLanePath(template.shape, startLane, tier.rows, rng);

  const allowed = tier.kinds;
  const favored = template.favor.filter((k) => allowed.includes(k));
  const kindFor = (): ObstacleKind =>
    favored.length > 0 && rng() < 0.65 ? pick(favored, rng) : pick(allowed, rng);

  const rows: PatternRow[] = path.map((clear, i) => {
    const others = [0, 1, 2].filter((l) => l !== clear);
    // 每段开头留一行喘口气,后面才逐渐摆满
    const budget = i === 0 ? Math.min(1, tier.maxObstacles) : tier.maxObstacles;
    let count = 0;
    for (let k = 0; k < budget; k++) {
      // 越到后面的档,摆满的概率越高
      if (rng() < 0.45 + tier.level * 0.07) count++;
    }
    const shuffled = rng() < 0.5 ? others : [others[1], others[0]];
    const obstacles = shuffled.slice(0, count).map((lane) => ({ lane, kind: kindFor() }));

    const coins: number[] = [];
    if (rng() < tier.coinRate) coins.push(clear);
    for (const lane of others) {
      if (!obstacles.some((o) => o.lane === lane) && rng() < tier.coinRate * 0.35) coins.push(lane);
    }
    const stars: number[] = rng() < tier.starRate ? [clear] : [];
    // 星星和金币不叠在同一格上,不然吃起来只算一个
    const cleanCoins = coins.filter((l) => !stars.includes(l));

    const row: PatternRow = { obstacles, stars, coins: cleanCoins };
    // 加速滑轨:直道段偶尔铺一小截,踩上去能把追风云甩远
    if (template.shape === "straight" && i > 0 && rng() < 0.3) row.rails = [clear];
    return row;
  });

  return { name: template.name, level: tier.level, rows, clearPath: path, startLane: path[0] };
}

/* ------------------------------------------------------------------ */
/* 必过窗口校验                                                        */
/* ------------------------------------------------------------------ */

/** 这一行哪几条道是完全空的(连障碍都没有,平跑就能过)。 */
export function freeLanes(row: PatternRow): number[] {
  return [0, 1, 2].filter((l) => !row.obstacles.some((o) => o.lane === l));
}

/**
 * 从 startLane 出发,能不能一路踩着空车道跑完这几行?
 * 规则:每一行都得站在一条完全空的道上,相邻两行之间最多横移一格。
 * 找得到就返回那条路线(逐行车道号),找不到返回 null。
 */
export function segmentClearPath(
  rows: ReadonlyArray<PatternRow>,
  startLane: number,
): number[] | null {
  if (rows.length === 0) return [];
  const start = clamp3(startLane);
  // prev[i][lane] = 走到第 i 行的 lane 时,上一行站在哪条道;-1 表示这一格走不到
  const prev: number[][] = [];
  let reach: boolean[] = [false, false, false];
  const firstFree = freeLanes(rows[0]);
  if (!firstFree.includes(start)) return null;
  reach[start] = true;
  prev.push([-1, -1, -1]);

  for (let i = 1; i < rows.length; i++) {
    const free = freeLanes(rows[i]);
    const next: boolean[] = [false, false, false];
    const from: number[] = [-1, -1, -1];
    for (const lane of free) {
      for (const p of [lane - 1, lane, lane + 1]) {
        if (p < 0 || p > 2 || !reach[p]) continue;
        next[lane] = true;
        from[lane] = p;
        break;
      }
    }
    if (!next[0] && !next[1] && !next[2]) return null;
    reach = next;
    prev.push(from);
  }

  const last = [0, 1, 2].find((l) => reach[l]);
  if (last === undefined) return null;
  const path: number[] = new Array(rows.length).fill(0);
  path[rows.length - 1] = last;
  for (let i = rows.length - 1; i > 0; i--) path[i - 1] = prev[i][path[i]];
  return path;
}

/**
 * 一段路公不公道:
 *  · 每一行本身有活路(不会三条道全是只能换道躲的障碍);
 *  · 存在一条从 startLane 出发、每行都踩空道、横移不超过一格的必过路线。
 */
export function segmentIsFair(seg: EndlessSegment, startLane: number): boolean {
  if (!seg.rows.every(rowIsSurvivable)) return false;
  return segmentClearPath(seg.rows, startLane) !== null;
}

/** 一条路线是不是每行最多横移一格。 */
export function pathStepsAreReachable(path: ReadonlyArray<number>): boolean {
  for (let i = 1; i < path.length; i++) {
    if (Math.abs(path[i] - path[i - 1]) > 1) return false;
    if (path[i] < 0 || path[i] > 2) return false;
  }
  return path.length === 0 || (path[0] >= 0 && path[0] <= 2);
}

/* ------------------------------------------------------------------ */
/* 追赶物:追风棉花云                                                   */
/* ------------------------------------------------------------------ */

export const CHASER_NAME = "追风棉花云";
export const CHASER_EMOJI = "🌪";
/** 开局领先多少(轨道像素) */
export const CHASER_START_GAP = 300;
/** 最多能甩开多远 */
export const CHASER_MAX_GAP = 380;
/** 撞一下被追近多少 */
export const CHASER_HIT_PENALTY = 70;
/** 躲过一个障碍能拉开多少 */
export const CHASER_DODGE_BONUS = 9;
/** 吃一颗糖果能拉开多少 */
export const CHASER_COIN_BONUS = 5;
/** 踩上加速滑轨能拉开多少 */
export const CHASER_RAIL_BONUS = 45;
/** 打出一次完美跳能拉开多少 */
export const CHASER_PERFECT_BONUS = 16;
/** 差这么近就该在画面上示警了 */
export const CHASER_WARN_GAP = 110;

/** 追风云每秒往前压多少:跑得越远压得越紧。 */
export function chaserPress(dist: number): number {
  return Math.min(46, 14 + dist * 0.006);
}

/** 光阴流逝这一帧被追近了多少。 */
export function chaserDrift(gap: number, dt: number, dist: number): number {
  const step = dt > 0 ? dt : 0;
  return Math.max(-40, gap - chaserPress(dist) * step);
}

/** 表现好就把它甩开一点(有上限,不能无限攒)。 */
export function chaserBoost(gap: number, amount: number): number {
  return Math.min(CHASER_MAX_GAP, gap + Math.max(0, amount));
}

/** 撞了一下,被追近一大截。 */
export function chaserPenalty(gap: number): number {
  return Math.max(-40, gap - CHASER_HIT_PENALTY);
}

export function chaserCaught(gap: number): boolean {
  return gap <= 0;
}

export function chaserWarning(gap: number): boolean {
  return gap <= CHASER_WARN_GAP;
}

/* ------------------------------------------------------------------ */
/* 三种失败                                                            */
/* ------------------------------------------------------------------ */

/** 撞障碍 / 掉坑 / 被追上。 */
export type FailKind = "crash" | "pit" | "chaser";

export interface FailCopy {
  title: string;
  /** 朗读用的整句 */
  line: string;
  /** 面板上分两行显示,375 宽的窄屏也放得下 */
  lines: [string, string];
}

/**
 * 失败文案只鼓励不批评:先肯定这一趟跑了多远,再给一条下次用得上的办法。
 * 一个「怎么这么不小心」式的说法都不留。
 */
export function failCopy(kind: FailKind, meters: number): FailCopy {
  const m = Math.max(0, Math.floor(meters));
  const head = `这一趟跑了 ${m} 米!`;
  const make = (title: string, tail: string): FailCopy => ({
    title,
    line: head + tail,
    lines: [head, tail],
  });
  if (kind === "pit") {
    return make("脚下踩空啦", "看见坑洞就起跳,上滑或者空格都行,再来一次准跳得过去。");
  }
  if (kind === "chaser") {
    return make(
      `${CHASER_NAME}追上来啦`,
      "躲障碍、吃糖果、踩滑轨都能把它甩开,下一趟你能跑得更远。",
    );
  }
  return make("撞了一下,没事的", "眼睛多看远一点,提前一个身位换道就躲得开,再来一次!");
}

/* ------------------------------------------------------------------ */
/* 纪录:最远距离 + 最高金币数                                          */
/* ------------------------------------------------------------------ */

export const ENDLESS_RECORD_KEY = "yiduo-yixing.rainbow-run.endless-record.v2";

export interface EndlessRecord {
  /** 最远跑到多少米 */
  meters: number;
  /** 一趟里最多吃到多少糖果 */
  coins: number;
}

export function emptyRecord(): EndlessRecord {
  return { meters: 0, coins: 0 };
}

function safeInt(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 读纪录:读不懂就当没有,绝不因为一行坏数据把无尽模式卡住。 */
export function parseRecord(raw: string | null): EndlessRecord {
  if (!raw) return emptyRecord();
  try {
    const parsed = JSON.parse(raw) as unknown;
    // 1.1 之前只存了一个「最远米数」的纯数字
    if (typeof parsed === "number") return { meters: safeInt(parsed), coins: 0 };
    if (!parsed || typeof parsed !== "object") return emptyRecord();
    const obj = parsed as Record<string, unknown>;
    return { meters: safeInt(obj.meters), coins: safeInt(obj.coins) };
  } catch {
    return { meters: safeInt(raw), coins: 0 };
  }
}

export function serializeRecord(r: EndlessRecord): string {
  return JSON.stringify({ meters: safeInt(r.meters), coins: safeInt(r.coins) });
}

/** 两项纪录各取各的最大值:这趟米数破了、糖果没破,也照样记下米数。 */
export function mergeRecord(prev: EndlessRecord, run: EndlessRecord): EndlessRecord {
  return {
    meters: Math.max(safeInt(prev.meters), safeInt(run.meters)),
    coins: Math.max(safeInt(prev.coins), safeInt(run.coins)),
  };
}

/** 这一趟破了哪几项纪录。 */
export function recordBroken(
  prev: EndlessRecord,
  run: EndlessRecord,
): { meters: boolean; coins: boolean } {
  return {
    meters: safeInt(run.meters) > safeInt(prev.meters),
    coins: safeInt(run.coins) > safeInt(prev.coins),
  };
}

/** 结算面板上那一行纪录播报。 */
export function recordLine(prev: EndlessRecord, run: EndlessRecord): string {
  const broke = recordBroken(prev, run);
  if (broke.meters && broke.coins) return "🎉 最远距离和糖果数一起破纪录!";
  if (broke.meters) return "🎉 最远距离破纪录啦!";
  if (broke.coins) return "🎉 糖果数破纪录啦!";
  return `最远 ${safeInt(prev.meters)} 米 · 最多 🍬${safeInt(prev.coins)}`;
}
