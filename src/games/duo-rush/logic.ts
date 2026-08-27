// 朵星双人冲刺 —— 纯逻辑：种子随机、公平赛道生成、速度曲线、碰撞规则。
// 两位玩家用同一个种子生成完全相同的赛道，比的是操作，不靠运气。

/* ---------------- 种子随机 ---------------- */

/** mulberry32：小巧的确定性随机数生成器。 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 障碍与动作 ---------------- */

export type ObstacleKind =
  | "rock" // 大石头：只能换道躲
  | "hurdle" // 小木栏：跳过去
  | "pit" // 泥坑：跳过去
  | "gate"; // 横杆：只能下滑钻过去（1.1 第 6 步新增）

export type EntityKind = ObstacleKind | "coin" | "boost" | "power";

/**
 * 四件温和道具的名字。详细规格（时长、倍率、文案）在 `rush12.ts`，
 * 类型放这里只是为了让赛道实体带得上它，`rush12` 反过来 import 这个别名，
 * 免得两边循环依赖。
 */
export type PowerKind = "speedCloud" | "shieldBubble" | "confetti" | "magnetStar";

export interface Entity {
  kind: EntityKind;
  lane: 0 | 1 | 2;
  /** 距离起点的位置（米） */
  at: number;
  /** `kind === "power"` 时才有：这是哪一件道具（1.2 第 11 步 A 新增） */
  power?: PowerKind;
}

/** 一个障碍要靠什么动作过去：跳、下滑，或者只能换道。 */
export type PassBy = "jump" | "slide" | "lane";

export function passBy(kind: ObstacleKind): PassBy {
  if (kind === "rock") return "lane";
  if (kind === "gate") return "slide";
  return "jump"; // 木栏与泥坑
}

/** 跳跃中能不能安全通过（老接口，只认跳跃这一个动作）。 */
export function survives(kind: ObstacleKind, jumping: boolean): boolean {
  return passBy(kind) === "jump" && jumping;
}

/** 带下滑的完整判定：动作对上了才安全。 */
export function survivesMove(
  kind: ObstacleKind,
  move: { jumping: boolean; sliding: boolean },
): boolean {
  const need = passBy(kind);
  if (need === "jump") return move.jumping;
  if (need === "slide") return move.sliding;
  return false; // 石头只能提前换道
}

export function isObstacle(kind: EntityKind): kind is ObstacleKind {
  return kind === "rock" || kind === "hurdle" || kind === "pit" || kind === "gate";
}

/* ---------------- 速度曲线 ---------------- */

export const BASE_SPEED = 46; // 米/秒
export const MAX_SPEED = 96; // 封顶，永远反应得过来
export const SPEED_PER_METER = 0.016;

/** 跑到 dist 米时的速度：随距离升高、有硬上限。 */
export function speedAt(dist: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + dist * SPEED_PER_METER);
}

export const JUMP_SECONDS = 0.62;
export const SLIDE_SECONDS = 0.55; // 下滑滚翻持续时间
export const HIT_SAFE_SECONDS = 1.4; // 撞后短暂无敌
export const BOOST_SECONDS = 1.8;
export const BOOST_MULT = 1.55;
export const MAX_HEARTS = 3;
/** 无尽竞速：先撞满 3 次的人输 */
export const CRASH_LIMIT = 3;

/* ---------------- 赛道生成 ---------------- */

/** 一小节花样：以相对距离摆放的实体。 */
interface Pattern {
  /** 本节长度（米） */
  len: number;
  entities: Array<{ kind: EntityKind; lane: 0 | 1 | 2; off: number }>;
}

const L = (n: number): 0 | 1 | 2 => n as 0 | 1 | 2;

/** 手拼花样库：每节都保证至少一条活路（换道或起跳可过）。 */
const PATTERNS: Pattern[] = [
  // 单石换道 + 金币指路
  {
    len: 46,
    entities: [
      { kind: "rock", lane: L(1), off: 14 },
      { kind: "coin", lane: L(0), off: 14 },
      { kind: "coin", lane: L(0), off: 20 },
      { kind: "rock", lane: L(0), off: 34 },
      { kind: "coin", lane: L(2), off: 34 },
    ],
  },
  // 跳栏节奏
  {
    len: 50,
    entities: [
      { kind: "hurdle", lane: L(0), off: 12 },
      { kind: "hurdle", lane: L(1), off: 12 },
      { kind: "coin", lane: L(2), off: 12 },
      { kind: "hurdle", lane: L(1), off: 30 },
      { kind: "hurdle", lane: L(2), off: 30 },
      { kind: "coin", lane: L(1), off: 40 },
    ],
  },
  // 泥坑三连
  {
    len: 54,
    entities: [
      { kind: "pit", lane: L(0), off: 12 },
      { kind: "pit", lane: L(2), off: 12 },
      { kind: "coin", lane: L(1), off: 12 },
      { kind: "pit", lane: L(1), off: 30 },
      { kind: "coin", lane: L(0), off: 38 },
      { kind: "coin", lane: L(2), off: 38 },
    ],
  },
  // 金币雨休息段
  {
    len: 40,
    entities: [
      { kind: "coin", lane: L(0), off: 8 },
      { kind: "coin", lane: L(1), off: 14 },
      { kind: "coin", lane: L(2), off: 20 },
      { kind: "coin", lane: L(1), off: 26 },
      { kind: "coin", lane: L(0), off: 32 },
    ],
  },
  // 石头夹缝(中间跳栏)
  {
    len: 48,
    entities: [
      { kind: "rock", lane: L(0), off: 16 },
      { kind: "rock", lane: L(2), off: 16 },
      { kind: "hurdle", lane: L(1), off: 16 },
      { kind: "coin", lane: L(1), off: 24 },
      { kind: "coin", lane: L(1), off: 30 },
    ],
  },
  // 加速带冲刺
  {
    len: 44,
    entities: [
      { kind: "boost", lane: L(1), off: 10 },
      { kind: "coin", lane: L(1), off: 18 },
      { kind: "coin", lane: L(1), off: 24 },
      { kind: "coin", lane: L(1), off: 30 },
      { kind: "rock", lane: L(0), off: 30 },
    ],
  },
  // 跳趴混合(栏+坑交替)
  {
    len: 56,
    entities: [
      { kind: "hurdle", lane: L(0), off: 12 },
      { kind: "pit", lane: L(1), off: 20 },
      { kind: "hurdle", lane: L(2), off: 28 },
      { kind: "coin", lane: L(0), off: 36 },
      { kind: "rock", lane: L(1), off: 44 },
      { kind: "coin", lane: L(2), off: 44 },
    ],
  },
  // 双石逼位
  {
    len: 50,
    entities: [
      { kind: "rock", lane: L(1), off: 14 },
      { kind: "rock", lane: L(2), off: 14 },
      { kind: "coin", lane: L(0), off: 14 },
      { kind: "rock", lane: L(0), off: 32 },
      { kind: "rock", lane: L(1), off: 32 },
      { kind: "coin", lane: L(2), off: 32 },
      { kind: "boost", lane: L(2), off: 42 },
    ],
  },
  // 横杆低桥：只能下滑钻过去
  {
    len: 48,
    entities: [
      { kind: "gate", lane: L(0), off: 14 },
      { kind: "gate", lane: L(1), off: 14 },
      { kind: "coin", lane: L(2), off: 14 },
      { kind: "gate", lane: L(1), off: 32 },
      { kind: "gate", lane: L(2), off: 32 },
      { kind: "coin", lane: L(0), off: 32 },
    ],
  },
  // 跳一下再滑一下：节奏切换
  {
    len: 58,
    entities: [
      { kind: "hurdle", lane: L(1), off: 12 },
      { kind: "coin", lane: L(1), off: 20 },
      { kind: "gate", lane: L(1), off: 30 },
      { kind: "coin", lane: L(1), off: 38 },
      { kind: "rock", lane: L(0), off: 46 },
      { kind: "rock", lane: L(2), off: 46 },
    ],
  },
  // 横杆夹石头：中间那道要滑
  {
    len: 52,
    entities: [
      { kind: "rock", lane: L(0), off: 16 },
      { kind: "gate", lane: L(1), off: 16 },
      { kind: "rock", lane: L(2), off: 16 },
      { kind: "coin", lane: L(1), off: 24 },
      { kind: "boost", lane: L(1), off: 32 },
      { kind: "coin", lane: L(1), off: 40 },
    ],
  },
];

/** 开头的热身段：前 60 米只有金币，让小朋友进入状态。 */
const WARMUP: Pattern = {
  len: 60,
  entities: [
    { kind: "coin", lane: L(1), off: 20 },
    { kind: "coin", lane: L(1), off: 30 },
    { kind: "coin", lane: L(1), off: 40 },
  ],
};

/**
 * 赛道生成器：按需向前生成，保证两名玩家（同种子）看到一模一样的赛道。
 * 难度随距离提升：花样之间的空隙逐渐缩小，但永远不小于 minGap。
 */
export interface TrackGen {
  /** 确保生成到 upTo 米，返回全部实体（按 at 升序）。 */
  ensure: (upTo: number) => Entity[];
}

/* ---------------- 难度档与选项（1.2 第 11 步 A 新增） ---------------- */

/**
 * 赛道难度档：**1 档就是 1.1 的原参数**，一个字节都没动，
 * 所以不传选项时生成出来的赛道和 1.1 完全一致（老用例照旧全绿）。
 * 0 档给刚上手的小朋友放宽段间空隙，2 / 3 档收紧。
 */
export type TrackDifficulty = 0 | 1 | 2 | 3;

/** 各档的段间空隙倍率（1 档 = 1，也就是原样） */
export const DIFFICULTY_GAP_MULT: Record<TrackDifficulty, number> = {
  0: 1.28,
  1: 1,
  2: 0.86,
  3: 0.74,
};

export interface TrackOptions {
  /** 难度档，默认 1（= 1.1 原参数） */
  difficulty?: TrackDifficulty;
  /**
   * 要在赛道上撒哪几种道具（按顺序轮着放）。不传或空数组 = 不撒。
   * 名单由 `rush12.POWERUP_KINDS` 传进来，这里不重复写一份。
   */
  powerups?: readonly PowerKind[];
  /**
   * 这一节花样会不会压到「别人管的路段」（比如分岔段）上：压到就整节让开。
   * 由 `match.ts` 按 `rush12` 的分岔间距算好传进来，logic 不反向依赖 rush12。
   */
  holeAt?: (from: number, to: number) => { start: number; end: number } | null;
}

/** 撒道具时，每隔几节花样放一件 */
export const POWER_EVERY_PATTERNS = 2;

export function createTrackGen(seed: number, opts: TrackOptions = {}): TrackGen {
  const gapMult = DIFFICULTY_GAP_MULT[opts.difficulty ?? 1] ?? 1;
  const powers = opts.powerups ?? [];
  const holeAt = opts.holeAt;
  const rng = makeRng(seed);
  const entities: Entity[] = [];
  let cursor = 0;
  let started = false;
  let lastPattern = -1;
  let placed = 0;

  function gapAt(dist: number): number {
    // 段间空隙：起步 26 米，随距离缩到最少 10 米
    return Math.max(10, 26 - dist * 0.01) * gapMult;
  }

  return {
    ensure(upTo: number): Entity[] {
      if (!started) {
        started = true;
        for (const e of WARMUP.entities) {
          entities.push({ kind: e.kind, lane: e.lane, at: cursor + e.off });
        }
        cursor += WARMUP.len;
      }
      while (cursor < upTo) {
        let pick = Math.floor(rng() * PATTERNS.length);
        if (pick === lastPattern) pick = (pick + 1) % PATTERNS.length; // 不连续重复
        lastPattern = pick;
        const pat = PATTERNS[pick];
        const clash = holeAt?.(cursor, cursor + pat.len) ?? null;
        if (clash) {
          cursor = clash.end + gapAt(clash.end);
          continue;
        }
        for (const e of pat.entities) {
          entities.push({ kind: e.kind, lane: e.lane, at: cursor + e.off });
        }
        placed++;
        if (powers.length > 0 && placed % POWER_EVERY_PATTERNS === 0) {
          // 摆在这一节的末尾（花样里的偏移都小于 len），实体表才一直是升序的
          entities.push({
            kind: "power",
            lane: L(Math.floor(rng() * 3)),
            at: cursor + pat.len - 2,
            power: powers[(placed / POWER_EVERY_PATTERNS - 1) % powers.length],
          });
        }
        cursor += pat.len + gapAt(cursor);
      }
      return entities;
    },
  };
}

/** 校验一批实体在任何位置都留有活路（测试用）。 */
export function trackIsFair(entities: Entity[]): boolean {
  // 把距离相近(±4m)的障碍视为同排，检查同排是否可通过
  const obstacles = entities.filter((e) => isObstacle(e.kind));
  for (const ob of obstacles) {
    const row = obstacles.filter((o) => Math.abs(o.at - ob.at) < 4);
    const lanes = new Set(row.map((o) => o.lane));
    if (lanes.size < 3) continue; // 有空道即可
    // 三道全堵时，必须至少一条道可以跳过去
    const jumpable = row.some((o) => o.kind !== "rock");
    if (!jumpable) return false;
  }
  return true;
}

/* ---------------- 更严格的可通过性校验（1.1 第 6 步新增） ---------------- */

/** 距离相近的一批障碍算同一「排」，玩家要用一个动作一次过掉。 */
export const CLUSTER_RANGE = 4;
/** 换一次道大约要多久：判断两排之间来不来得及横移 */
export const LANE_CHANGE_SECONDS = 0.085;

export interface Cluster {
  at: number;
  /** 三条道各自的通过方式：null 表示这条道过不去 */
  lanes: [PassBy | null, PassBy | null, PassBy | null];
}

/** 把障碍按距离聚成一排一排，并算出每条道要靠什么动作过。 */
export function trackClusters(entities: Entity[]): Cluster[] {
  const obstacles = entities
    .filter((e): e is Entity & { kind: ObstacleKind } => isObstacle(e.kind))
    .slice()
    .sort((a, b) => a.at - b.at);
  const out: Cluster[] = [];
  let i = 0;
  while (i < obstacles.length) {
    const start = obstacles[i].at;
    const group: Array<Entity & { kind: ObstacleKind }> = [];
    while (i < obstacles.length && obstacles[i].at - start < CLUSTER_RANGE) {
      group.push(obstacles[i]);
      i++;
    }
    // 每条道默认畅通（"lane" 在这里借用为「什么都不用做」）
    const lanes: [PassBy | null, PassBy | null, PassBy | null] = ["lane", "lane", "lane"];
    for (const ob of group) {
      const need = passBy(ob.kind);
      const cur = lanes[ob.lane];
      if (cur === null) continue; // 已经堵死
      if (need === "lane") {
        lanes[ob.lane] = null; // 石头：这条道过不去
      } else if (cur === "lane") {
        lanes[ob.lane] = need;
      } else if (cur !== need) {
        lanes[ob.lane] = null; // 同一条道又要跳又要滑，一个动作办不到
      }
    }
    out.push({ at: start, lanes });
  }
  return out;
}

/** 两排之间来得及横移几条道（速度越快越来不及）。 */
export function maxLaneShift(gapMeters: number, speed: number): number {
  if (speed <= 0) return 2;
  const seconds = gapMeters / speed;
  return Math.max(0, Math.min(2, Math.floor(seconds / LANE_CHANGE_SECONDS)));
}

/**
 * 从头到尾真的存在一条走得通的路线吗？
 * 逐排做可达性推进：这一排能站的道 → 下一排来得及移到的道。
 * `speed` 默认取封顶速度，也就是按最坏情况检查。
 */
export function trackHasRoute(entities: Entity[], speed: number = MAX_SPEED): boolean {
  const clusters = trackClusters(entities);
  if (clusters.length === 0) return true;
  let reachable = new Set<number>([0, 1, 2]);
  let prevAt: number | null = null;
  for (const cluster of clusters) {
    if (prevAt !== null) {
      const shift = maxLaneShift(cluster.at - prevAt, speed);
      const next = new Set<number>();
      for (const lane of reachable) {
        for (let d = -shift; d <= shift; d++) {
          const to = lane + d;
          if (to >= 0 && to <= 2) next.add(to);
        }
      }
      reachable = next;
    }
    const survivors = new Set<number>();
    for (const lane of reachable) {
      if (cluster.lanes[lane] !== null) survivors.add(lane);
    }
    if (survivors.size === 0) return false;
    reachable = survivors;
    prevAt = cluster.at;
  }
  return true;
}

/* ---------------- 对局结算 ---------------- */

/**
 * 赛制：
 *  - `endless` 无尽对战：都撞完比谁远（1.0 就有）
 *  - `coins`   抢金币赛：先到目标枚数（1.0 就有）
 *  - `rush`    无尽竞速：两人一直跑，先撞满 3 次的人输（1.1 新增）
 *  - `ghost`   幽灵对战：和自己上一次（或对手上一局）的成绩赛跑（1.1 新增，1.2 加了对手影子）
 *  - `items`   道具竞速：撒道具 + 中途分岔的加深赛制（1.2 第 11 步 A 新增），
 *              胜负规矩和 `rush` 一样，先撞满 3 次的人输
 */
export type RaceMode = "endless" | "coins" | "rush" | "ghost" | "items";

export const RACE_MODES: readonly RaceMode[] = ["rush", "items", "ghost", "endless", "coins"];

export const COIN_RACE_TARGET = 30;

export interface RunnerResult {
  dist: number;
  coins: number;
  crashed: boolean;
}

/**
 * 无尽模式冠军：都撞完后比距离，距离打平比金币，仍平则平局(返回 -1)。
 * 返回 0=玩家1赢，1=玩家2赢，-1=平局。
 */
export function endlessWinner(a: RunnerResult, b: RunnerResult): 0 | 1 | -1 {
  const da = Math.floor(a.dist);
  const db = Math.floor(b.dist);
  if (da !== db) return da > db ? 0 : 1;
  if (a.coins !== b.coins) return a.coins > b.coins ? 0 : 1;
  return -1;
}

/* ---------------- 无尽竞速结算（1.1 第 6 步新增） ---------------- */

export interface RushResult {
  dist: number;
  coins: number;
  /** 已经撞了几次 */
  crashes: number;
}

/**
 * 无尽竞速冠军：**先撞满 3 次的人输**，和跑多远无关。
 * 两个人都还没撞满（比如中途结束）就退回比距离、比金币的老规矩。
 * 返回 0=朵朵赢，1=星星赢，-1=平局。
 */
export function rushWinner(a: RushResult, b: RushResult): 0 | 1 | -1 {
  const aOut = a.crashes >= CRASH_LIMIT;
  const bOut = b.crashes >= CRASH_LIMIT;
  if (aOut !== bOut) return aOut ? 1 : 0;
  return endlessWinner(
    { dist: a.dist, coins: a.coins, crashed: aOut },
    { dist: b.dist, coins: b.coins, crashed: bOut },
  );
}

/* ---------------- 幽灵对战（和自己上一次赛跑） ---------------- */

/** 幽灵存档 key，前缀和平台一致，家长面板的导出/清空会一起带上。 */
export const GHOST_KEY = "yiduo-yixing.duo-rush.ghost.v1";

export interface GhostRecord {
  /** 那一次跑了多远（米） */
  dist: number;
  /** 那一次跑了多久（秒） */
  seconds: number;
}

/** 速度封顶前后的分界点：跑到这个时刻速度正好顶到 MAX_SPEED */
const CAP_TIME = Math.log(MAX_SPEED / BASE_SPEED) / SPEED_PER_METER;
const CAP_DIST = (MAX_SPEED - BASE_SPEED) / SPEED_PER_METER;

/**
 * 一个「一路不撞、不吃加速带」的标准跑者在 t 秒时能跑多远。
 * 速度曲线是 v = BASE + d·k，解出来是先指数后匀速，幽灵按这条曲线配速，
 * 所以它也会像真人一样越跑越快，而不是从头到尾一个速度。
 */
export function baselineDistAt(t: number): number {
  if (!(t > 0)) return 0;
  if (t <= CAP_TIME) {
    return (BASE_SPEED / SPEED_PER_METER) * (Math.exp(SPEED_PER_METER * t) - 1);
  }
  return CAP_DIST + MAX_SPEED * (t - CAP_TIME);
}

/** 成绩太短的不值得存成幽灵（免得一开局就被自己秒掉）。 */
export const GHOST_MIN_DIST = 80;

export function makeGhostRecord(dist: number, seconds: number): GhostRecord | null {
  if (!Number.isFinite(dist) || !Number.isFinite(seconds)) return null;
  if (dist < GHOST_MIN_DIST || seconds <= 0) return null;
  return { dist: Math.round(dist), seconds: Math.round(seconds * 100) / 100 };
}

/** 幽灵在第 t 秒跑到哪里：照着标准曲线等比缩放，跑完自己的成绩就停住。 */
export function ghostDistAt(rec: GhostRecord, t: number): number {
  if (!(t > 0)) return 0;
  const full = baselineDistAt(rec.seconds);
  const k = full > 0 ? rec.dist / full : 0;
  return Math.min(rec.dist, baselineDistAt(t) * k);
}

/** 两份成绩里留跑得远的那一份；一样远就留用时短的。 */
export function betterGhost(a: GhostRecord | null, b: GhostRecord | null): GhostRecord | null {
  if (!a) return b;
  if (!b) return a;
  if (a.dist !== b.dist) return a.dist > b.dist ? a : b;
  return a.seconds <= b.seconds ? a : b;
}

export function serializeGhostRecord(rec: GhostRecord): string {
  return JSON.stringify({ dist: rec.dist, seconds: rec.seconds });
}

/** 读存档：坏数据一律当作「还没有幽灵」，绝不把游戏搞崩。 */
export function parseGhostRecord(raw: string | null | undefined): GhostRecord | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (typeof obj !== "object" || obj === null) return null;
    const o = obj as Record<string, unknown>;
    if (typeof o.dist !== "number" || typeof o.seconds !== "number") return null;
    return makeGhostRecord(o.dist, o.seconds);
  } catch {
    return null;
  }
}
