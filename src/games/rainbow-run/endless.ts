// 彩虹跑跑 · 无限模式(1.1 第 6 步新增)
//
// 三件事:
//  1. 程序化拼接路段——分段模板 + 难度随距离升;
//  2. 必过窗口——每一段按构造都留出一条「一个动作都不用做」的空车道路线,
//     相邻两行之间横移不超过一格,所以跑得再远也不会生成过不去的组合;
//  3. 追赶物与三种失败,外加最远距离 / 最高金币数两项纪录。
//
// 这里全是纯函数,不碰 DOM,也不碰战役那 188 关的关卡表。

import type { ObstacleKind, PatternRow, PlayerAction } from "./logic";
import { PERFECT_STREAK_GOAL, rowIsSurvivable, wouldHit } from "./logic";

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

/**
 * 1.2:一段路里,必过路线的每一行要做什么动作。
 * 老模板一路都是 `run`(必过车道整格空着);
 * 新模板会在必过车道上摆「跳一下」或者「滑一下」就过得去的障碍,
 * 这时对应那一行记的就是 `jump` / `slide`。
 */
export type PathAction = PlayerAction;

export interface BuildContext {
  tier: EndlessTier;
  startLane: number;
  rng: Rng;
  /** 这一档解锁了的障碍 */
  allowed: ObstacleKind[];
}

export interface BuiltRows {
  rows: PatternRow[];
  path: number[];
  actions: PathAction[];
  merge?: ForkMerge;
}

/** 分岔段的合流点:两条支线在**同一行**汇合。 */
export interface ForkMerge {
  /** 合流落在第几行 */
  row: number;
  /** 分岔口那两条支线各走哪条道 */
  lanes: [number, number];
}

export interface SegmentTemplate {
  name: string;
  shape: PathShape;
  /** 这个模板偏爱的障碍:能用就优先用,用不了就退回本档的通用池 */
  favor: ObstacleKind[];
  /** 到第几档才解锁 */
  minLevel: number;
  /** 1.2:自己拼行的模板;不给就走通用的「空车道 + 两侧摆障碍」那一套 */
  build?: (ctx: BuildContext) => BuiltRows;
  /** 这个模板必须先有这些障碍才摆得出来 */
  needs?: ObstacleKind[];
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
  // ---- 1.2 路段语法升级:四种自己拼行的模板 ----
  {
    name: "三连节拍",
    shape: "straight",
    favor: ["hurdle"],
    minLevel: 3,
    needs: ["hurdle"],
    build: buildBeatRun,
  },
  {
    name: "低梁抢道",
    shape: "drift",
    favor: ["bar"],
    minLevel: 3,
    needs: ["bar", "rock"],
    build: buildLowBarCut,
  },
  {
    name: "彩纸箱链",
    shape: "straight",
    favor: ["crate"],
    minLevel: 3,
    needs: ["crate"],
    build: buildCrateChain,
  },
  {
    name: "分岔合流",
    shape: "weave",
    favor: ["hurdle", "bar"],
    minLevel: 4,
    needs: ["rock", "hurdle"],
    build: buildForkMerge,
  },
];

/** 这一档能抽到的模板。 */
export function templatesForLevel(level: number): SegmentTemplate[] {
  return SEGMENT_TEMPLATES.filter((t) => t.minLevel <= level);
}

/** 这一档既解锁了、需要的障碍也齐了的模板。 */
export function usableTemplates(tier: EndlessTier): SegmentTemplate[] {
  const kinds = new Set(tier.kinds);
  return templatesForLevel(tier.level).filter((t) =>
    (t.needs ?? []).every((k) => kinds.has(k)),
  );
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
  /** 1.2:必过路线每一行要做的动作(老模板一路都是 run) */
  pathActions: PathAction[];
  /** 进这一段时玩家该站的车道(等于 clearPath[0]) */
  startLane: number;
  /** 分岔段专属:两条支线在第几行合流 */
  merge?: ForkMerge;
}

/* ---------------- 1.2 新模板:自己拼行 ---------------- */

/** 一行「什么都没有」的路,顺手摆一枚糖果。 */
function breatherRow(lane: number, coin: boolean): PatternRow {
  return { obstacles: [], stars: [], coins: coin ? [lane] : [] };
}

/** 把 rows 补到本档该有的长度,补的全是空行(收尾让人喘口气)。 */
function padTail(built: BuiltRows, tier: EndlessTier, rng: Rng): BuiltRows {
  const lane = built.path[built.path.length - 1];
  while (built.rows.length < tier.rows) {
    built.rows.push(breatherRow(lane, rng() < tier.coinRate));
    built.path.push(lane);
    built.actions.push("run");
  }
  return built;
}

/**
 * 三连节拍段:连着三行等距同款障碍,三条道全摆上,只能跳。
 * 贴着起跳就是完美跳,连着三次正好凑满一组——节奏段的意义就在这儿,
 * 所以三行的间距、障碍种类都保持一致,不给任何「这一行要不要换道」的干扰。
 */
function buildBeatRun(ctx: BuildContext): BuiltRows {
  const lane = clamp3(ctx.startLane);
  const kind: ObstacleKind =
    ctx.allowed.includes("pit") && ctx.rng() < 0.4 ? "pit" : "hurdle";
  const rows: PatternRow[] = [breatherRow(lane, true)];
  const path: number[] = [lane];
  const actions: PathAction[] = ["run"];
  for (let k = 0; k < PERFECT_STREAK_GOAL; k++) {
    rows.push({
      obstacles: [0, 1, 2].map((l) => ({ lane: l, kind })),
      stars: [],
      coins: [],
      beat: true,
    });
    path.push(lane);
    actions.push("jump");
  }
  // 数完三拍给一颗星星当奖励,落地那一行是空的,不会打断节奏
  rows.push({ obstacles: [], stars: [lane], coins: [] });
  path.push(lane);
  actions.push("run");
  return padTail({ rows, path, actions }, ctx.tier, ctx.rng);
}

/**
 * 低梁抢道:先趴过一道压得很低的彩虹杆,落地那一行原道被堵死,必须立刻换到旁边。
 * 「滑完马上换」是这段路唯一的解法,所以下滑锁定必须短于跳跃(见 motion.ts 的 SLIDE_LOCK)。
 */
function buildLowBarCut(ctx: BuildContext): BuiltRows {
  let lane = clamp3(ctx.startLane);
  const rows: PatternRow[] = [breatherRow(lane, true)];
  const path: number[] = [lane];
  const actions: PathAction[] = ["run"];
  const bouts = ctx.tier.rows >= 6 ? 2 : 1;
  for (let b = 0; b < bouts; b++) {
    const next = lane === 1 ? (ctx.rng() < 0.5 ? 0 : 2) : 1;
    // 低梁:自己这条道一定有,偶尔连旁边那条一起压下来
    const barLanes = ctx.rng() < 0.5 ? [lane] : [lane, lane === next ? lane : 3 - lane - next];
    rows.push({
      obstacles: [...new Set(barLanes)]
        .filter((l) => l >= 0 && l <= 2)
        .map((l) => ({ lane: l, kind: "bar" as ObstacleKind })),
      stars: [],
      coins: [],
    });
    path.push(lane);
    actions.push("slide");
    // 紧接着原道被软糖堵死,只能挪到刚空出来的那条
    rows.push({ obstacles: [{ lane, kind: "rock" }], stars: [], coins: [next] });
    path.push(next);
    actions.push("run");
    lane = next;
  }
  return padTail({ rows, path, actions }, ctx.tier, ctx.rng);
}

/**
 * 彩纸箱链:一整串箱子铺在同一条道上,一路滑过去挨个铲碎。
 * 箱子是唯一「跳也行、滑也行」的障碍,所以这段路对手生的孩子也留了退路——
 * 只是跳过去不计数,想刷铲箱任务还得滑。
 */
function buildCrateChain(ctx: BuildContext): BuiltRows {
  const lane = clamp3(ctx.startLane);
  const rows: PatternRow[] = [breatherRow(lane, true)];
  const path: number[] = [lane];
  const actions: PathAction[] = ["run"];
  const links = Math.max(3, Math.min(4, ctx.tier.rows - 2));
  for (let k = 0; k < links; k++) {
    const obstacles = [{ lane, kind: "crate" as ObstacleKind }];
    // 链子越到后面越粗:旁边那条道也堆一个,逼着人别绕开
    const side = lane === 0 ? 1 : lane === 2 ? 1 : ctx.rng() < 0.5 ? 0 : 2;
    if (k > 0 && ctx.rng() < 0.5) obstacles.push({ lane: side, kind: "crate" });
    const free = [0, 1, 2].filter((l) => !obstacles.some((o) => o.lane === l));
    rows.push({
      obstacles,
      stars: k === links - 1 && free.length > 0 ? [free[0]] : [],
      coins: k === 0 && free.length > 0 ? [free[free.length - 1]] : [],
    });
    path.push(lane);
    actions.push("slide");
  }
  return padTail({ rows, path, actions }, ctx.tier, ctx.rng);
}

/**
 * 分岔合流:中间道被一排软糖封死,左右各成一条支线,跑几行之后在**同一行**汇合。
 * 「同帧合流」是硬要求——两条支线行数一样长,谁走哪边都在同一行回到三条道全开的路面,
 * 后面的路才接得上,也不会因为选错边被多堵一行。
 */
function buildForkMerge(ctx: BuildContext): BuiltRows {
  const branchLen = ctx.tier.rows >= 6 ? 3 : 2;
  const side: number = ctx.startLane === 0 ? 0 : ctx.startLane === 2 ? 2 : ctx.rng() < 0.5 ? 0 : 2;
  // 岔路牌那一行整行空着:不管上一段收在哪条道上,都进得来
  const rows: PatternRow[] = [breatherRow(clamp3(ctx.startLane), true)];
  const path: number[] = [clamp3(ctx.startLane)];
  const actions: PathAction[] = ["run"];

  const jumpables = (["hurdle", "pit", "crate"] as ObstacleKind[]).filter((k) =>
    ctx.allowed.includes(k),
  );
  const slideables = (["bar", "crate"] as ObstacleKind[]).filter((k) => ctx.allowed.includes(k));

  for (let k = 0; k < branchLen; k++) {
    const obstacles = [{ lane: 1, kind: "rock" as ObstacleKind }];
    let act: PathAction = "run";
    // 左支线偏跳、右支线偏滑,两边难度不同但都过得去
    if (k > 0 && jumpables.length > 0 && ctx.rng() < 0.7) {
      obstacles.push({ lane: 0, kind: pick(jumpables, ctx.rng) });
      if (side === 0) act = "jump";
    }
    if (k > 0 && slideables.length > 0 && ctx.rng() < 0.7) {
      obstacles.push({ lane: 2, kind: pick(slideables, ctx.rng) });
      if (side === 2) act = "slide";
    }
    const free = [0, 1, 2].filter((l) => !obstacles.some((o) => o.lane === l));
    rows.push({ obstacles, stars: [], coins: free });
    path.push(side);
    actions.push(act);
  }
  // 合流行:三条道同时放开,两条支线在这一行会合
  const mergeRow = rows.length;
  rows.push({ obstacles: [], stars: [1], coins: [0, 2] });
  path.push(side);
  actions.push("run");
  const built = padTail({ rows, path, actions }, ctx.tier, ctx.rng);
  built.merge = { row: mergeRow, lanes: [0, 2] };
  return built;
}

/* ---------------- 通用模板:必过车道整格空着 ---------------- */

function buildGeneric(ctx: BuildContext, template: SegmentTemplate): BuiltRows {
  const { tier, rng } = ctx;
  const path = clearLanePath(template.shape, ctx.startLane, tier.rows, rng);
  const allowed = ctx.allowed;
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

  return { rows, path, actions: path.map(() => "run" as PathAction) };
}

/** 指定模板拼一段路(测试里拿来单独盯某一种模板)。 */
export function buildSegmentWith(
  template: SegmentTemplate,
  dist: number,
  startLane: number,
  rng: Rng,
): EndlessSegment {
  const tier = tierForDistance(dist);
  const ctx: BuildContext = {
    tier,
    startLane: clamp3(startLane),
    rng,
    allowed: [...tier.kinds],
  };
  const built = template.build ? template.build(ctx) : buildGeneric(ctx, template);
  return {
    name: template.name,
    level: tier.level,
    rows: built.rows,
    clearPath: built.path,
    pathActions: built.actions,
    startLane: built.path[0],
    merge: built.merge,
  };
}

/**
 * 拼一段路。
 * 通用模板先画出必过车道的走法,再往**别的**车道上摆障碍——必过车道那一格永远空着;
 * 1.2 的四种新模板自己拼行,必过车道上会有「跳一下 / 滑一下就过去」的障碍,
 * 每一行该做什么动作都记在 `pathActions` 里。
 * 两种口径都是**构造**出来的,不是碰运气碰出来的。
 */
export function buildSegment(dist: number, startLane: number, rng: Rng): EndlessSegment {
  const tier = tierForDistance(dist);
  return buildSegmentWith(pick(usableTemplates(tier), rng), dist, startLane, rng);
}

/* ------------------------------------------------------------------ */
/* 必过窗口校验                                                        */
/* ------------------------------------------------------------------ */

/** 这一行哪几条道是完全空的(连障碍都没有,平跑就能过)。 */
export function freeLanes(row: PatternRow): number[] {
  return [0, 1, 2].filter((l) => !row.obstacles.some((o) => o.lane === l));
}

/**
 * 1.2:这一行哪几条道是**走得通**的——空着的、或者跳一下 / 滑一下就能过去的。
 * 只能换道躲的那几种(软糖、云怪、滚球、电门)不算走得通。
 */
export function passableLanes(row: PatternRow): number[] {
  return [0, 1, 2].filter((l) => laneActions(row, l).length > 0);
}

/** 站在这一行的这条道上,哪些动作过得去(空道就是三种动作都行)。 */
export function laneActions(row: PatternRow, lane: number): PathAction[] {
  const ob = row.obstacles.find((o) => o.lane === lane);
  if (!ob) return ["run", "jump", "slide"];
  return (["run", "jump", "slide"] as PathAction[]).filter((a) => !wouldHit(ob.kind, a));
}

/** 从 startLane 出发按某种「这条道站不站得住」的口径找一条路线。 */
function findPath(
  rows: ReadonlyArray<PatternRow>,
  startLane: number,
  lanesOf: (row: PatternRow) => number[],
): number[] | null {
  if (rows.length === 0) return [];
  const start = clamp3(startLane);
  // prev[i][lane] = 走到第 i 行的 lane 时,上一行站在哪条道;-1 表示这一格走不到
  const prev: number[][] = [];
  let reach: boolean[] = [false, false, false];
  if (!lanesOf(rows[0]).includes(start)) return null;
  reach[start] = true;
  prev.push([-1, -1, -1]);

  for (let i = 1; i < rows.length; i++) {
    const open = lanesOf(rows[i]);
    const next: boolean[] = [false, false, false];
    const from: number[] = [-1, -1, -1];
    for (const lane of open) {
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
 * 从 startLane 出发,能不能一路踩着空车道跑完这几行?
 * 规则:每一行都得站在一条完全空的道上,相邻两行之间最多横移一格。
 * 找得到就返回那条路线(逐行车道号),找不到返回 null。
 */
export function segmentClearPath(
  rows: ReadonlyArray<PatternRow>,
  startLane: number,
): number[] | null {
  return findPath(rows, startLane, freeLanes);
}

/**
 * 1.2 的必过路线口径:每行站的道要么空着,要么跳一下 / 滑一下就过得去。
 * 新的节拍段、低梁段、纸箱链故意把障碍摆在必过车道上,量的就是这条。
 */
export function segmentPassablePath(
  rows: ReadonlyArray<PatternRow>,
  startLane: number,
): number[] | null {
  return findPath(rows, startLane, passableLanes);
}

/** 必过窗口一次看几行。 */
export const FAIR_WINDOW_ROWS = 3;

/**
 * 必过窗口:任意连续 3 行里,都得存在一条走得通的路线——
 * 每行站的道要么空着、要么跳一下滑一下就过去,相邻两行之间横移不超过一格。
 * 换句话说,不会出现「三条车道全是既不可跳又不可滑」的组合把人堵死在窗口里。
 */
export function fairWindows(
  rows: ReadonlyArray<PatternRow>,
  size: number = FAIR_WINDOW_ROWS,
): boolean {
  if (!rows.every(rowIsSurvivable)) return false;
  const span = Math.max(1, Math.floor(size));
  for (let i = 0; i + span <= rows.length; i++) {
    const win = rows.slice(i, i + span);
    if (![0, 1, 2].some((l) => segmentPassablePath(win, l) !== null)) return false;
  }
  return true;
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

/**
 * 1.2 的验收口径:必过窗口过关,而且从进这一段站的那条道出发真的走得通。
 * 四种新模板与八种老模板都得过这一关。
 */
export function segmentIsPassable(seg: EndlessSegment, startLane: number): boolean {
  if (!fairWindows(seg.rows)) return false;
  return segmentPassablePath(seg.rows, startLane) !== null;
}

/** 生成器自己报的那条必过路线站不站得住:每一行的动作真的能过去。 */
export function declaredPathHolds(seg: EndlessSegment): boolean {
  if (seg.clearPath.length !== seg.rows.length) return false;
  if (seg.pathActions.length !== seg.rows.length) return false;
  for (let i = 0; i < seg.rows.length; i++) {
    if (!laneActions(seg.rows[i], seg.clearPath[i]).includes(seg.pathActions[i])) return false;
  }
  return pathStepsAreReachable(seg.clearPath);
}

/**
 * 分岔段:两条支线各自走得通,而且在**同一行**合流。
 * 不是分岔段就返回 null,免得把「没有岔路」当成「岔路坏了」。
 */
export function forkMergeHolds(seg: EndlessSegment): boolean | null {
  const merge = seg.merge;
  if (!merge) return null;
  if (merge.row <= 0 || merge.row >= seg.rows.length) return false;
  // 合流那一行三条道全开:两边的人这一帧同时回到同一条路面上
  if (freeLanes(seg.rows[merge.row]).length !== 3) return false;
  const upto = seg.rows.slice(0, merge.row + 1);
  for (const lane of merge.lanes) {
    const path = segmentPassablePath(upto, lane);
    if (!path || path.length !== upto.length) return false;
  }
  return true;
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

/**
 * 朗读专用的纪录播报。
 *
 * 面板上 `recordLine()` 那一行是画在画布上的,识字量有限的孩子只能靠听 ——
 * 他刚跑出自己最远的一趟,耳朵里听到的却和上一趟一模一样。这一句就是补给他听的。
 *
 * 不并进 `failCopy`:那两行是面板排版用的,`lines.join("")` 必须仍旧等于 `line`。
 */
export function endlessRecordSay(meters: number, best: number, newRecord: boolean): string {
  const m = Math.max(0, Math.floor(meters));
  const b = Math.max(0, Math.floor(best));
  if (newRecord) {
    return b > 0 ? `这是新纪录,比上次的 ${b} 米还远 ${m - b} 米!` : `这是你的第一条纪录:${m} 米!`;
  }
  if (b <= m) return `跟最好成绩打平,都是 ${b} 米!`;
  return `你最远跑到过 ${b} 米,再多跑 ${b - m} 米就追平啦。`;
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
