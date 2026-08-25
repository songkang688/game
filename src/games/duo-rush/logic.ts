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
  | "pit"; // 泥坑：跳过去

export type EntityKind = ObstacleKind | "coin" | "boost";

export interface Entity {
  kind: EntityKind;
  lane: 0 | 1 | 2;
  /** 距离起点的位置（米） */
  at: number;
}

/** 跳跃中能不能安全通过。 */
export function survives(kind: ObstacleKind, jumping: boolean): boolean {
  if (kind === "rock") return false; // 石头跳不过去，只能换道
  return jumping; // 木栏和泥坑跳过去就安全
}

export function isObstacle(kind: EntityKind): kind is ObstacleKind {
  return kind === "rock" || kind === "hurdle" || kind === "pit";
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
export const HIT_SAFE_SECONDS = 1.4; // 撞后短暂无敌
export const BOOST_SECONDS = 1.8;
export const BOOST_MULT = 1.55;
export const MAX_HEARTS = 3;

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

export function createTrackGen(seed: number): TrackGen {
  const rng = makeRng(seed);
  const entities: Entity[] = [];
  let cursor = 0;
  let started = false;
  let lastPattern = -1;

  function gapAt(dist: number): number {
    // 段间空隙：起步 26 米，随距离缩到最少 10 米
    return Math.max(10, 26 - dist * 0.01);
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
        for (const e of pat.entities) {
          entities.push({ kind: e.kind, lane: e.lane, at: cursor + e.off });
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

/* ---------------- 对局结算 ---------------- */

export type RaceMode = "endless" | "coins";

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
