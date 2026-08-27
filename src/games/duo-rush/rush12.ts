/**
 * 梨康双人冲刺 · 1.2 竞速深度层（纯函数，不碰 DOM）。
 *
 * 这一层补的是 1.1 没有的四件事：
 *  1. 温和道具（加速云 / 护盾泡 / 减速彩纸 / 磁力星）——全部是状态机，没有任何攻击伤害语义；
 *  2. 赛道分岔与合流——左右两条**长度完全相同**、难度不同，合流点同帧；
 *  3. 幽灵配速扩展——除了「和自己最好成绩跑」，再加「和对手上一局跑」，快照可序列化；
 *  4. 让分助推——大人带小孩玩时给落后一方最多 8% 的温和追赶，默认关闭。
 *
 * 另外把「没有战役」的本款接到平台的 `initialLevel` 上：第 N 关映射成「赛道难度档 + 人机档」。
 */
import {
  MAX_SPEED,
  makeRng,
  trackHasRoute,
  type Entity,
  type EntityKind,
  type PowerKind,
} from "./logic";

/* ---------------- 一、温和道具 ---------------- */

/**
 * 四个道具都不带攻击语义：
 * - `speedCloud` 加速云：踩上去自己快一阵；
 * - `shieldBubble` 护盾泡：帮你挡掉一次撞击（撞了只是泡泡破掉）；
 * - `confetti` 减速彩纸：撒给对手，对手慢一阵（不掉血、不打断操作）；
 * - `magnetStar` 磁力星：金币会自己飞过来一阵。
 */
export type PowerupKind = PowerKind;

export const POWERUP_KINDS: readonly PowerupKind[] = [
  "speedCloud",
  "shieldBubble",
  "confetti",
  "magnetStar",
];

export interface PowerupSpec {
  kind: PowerupKind;
  label: string;
  emoji: string;
  /** 效果持续多少秒（护盾泡按次数算，写 0） */
  seconds: number;
  /** 一句话说明，进 HUD 与攻略 */
  hint: string;
  /** true 表示效果加在对手身上 */
  toOpponent: boolean;
}

export const POWERUPS: Record<PowerupKind, PowerupSpec> = {
  speedCloud: {
    kind: "speedCloud",
    label: "加速云",
    emoji: "☁️",
    seconds: 2.4,
    hint: "踩上去，脚下的云会推着你跑一小会儿",
    toOpponent: false,
  },
  shieldBubble: {
    kind: "shieldBubble",
    label: "护盾泡",
    emoji: "🫧",
    seconds: 0,
    hint: "帮你挡下一次磕碰，泡泡破了就没啦",
    toOpponent: false,
  },
  confetti: {
    kind: "confetti",
    label: "减速彩纸",
    emoji: "🎊",
    seconds: 2,
    hint: "撒一把彩纸给对手，让他慢一小会儿",
    toOpponent: true,
  },
  magnetStar: {
    kind: "magnetStar",
    label: "磁力星",
    emoji: "🧲",
    seconds: 3.2,
    hint: "附近的金币会自己飞过来",
    toOpponent: false,
  },
};

export const SPEED_CLOUD_MULT = 1.35;
export const CONFETTI_MULT = 0.78;
/** 磁力星的吸附半径（米） */
export const MAGNET_RADIUS = 6;
/** 护盾泡最多叠几层，免得一路无敌 */
export const SHIELD_MAX = 2;

export interface PowerupState {
  /** 各时效道具的剩余秒数 */
  speedCloud: number;
  confetti: number;
  magnetStar: number;
  /** 护盾泡是层数不是时间 */
  shield: number;
}

export function createPowerupState(): PowerupState {
  return { speedCloud: 0, confetti: 0, magnetStar: 0, shield: 0 };
}

/**
 * 吃到一个道具：返回「自己的新状态」和「要丢给对手的效果」。
 * 减速彩纸是唯一作用在对手身上的，所以自己那份不变。
 */
export function pickPowerup(
  state: PowerupState,
  kind: PowerupKind,
): { self: PowerupState; toOpponent: PowerupKind | null } {
  const spec = POWERUPS[kind];
  if (spec.toOpponent) return { self: { ...state }, toOpponent: kind };
  return { self: applyPowerup(state, kind), toOpponent: null };
}

/** 把一个道具效果直接加到某一方身上（对手的彩纸走这里）。 */
export function applyPowerup(state: PowerupState, kind: PowerupKind): PowerupState {
  const next = { ...state };
  if (kind === "shieldBubble") {
    next.shield = Math.min(SHIELD_MAX, next.shield + 1);
    return next;
  }
  const spec = POWERUPS[kind];
  // 同种道具续时间而不是叠倍率：叠倍率会失控
  next[kind] = Math.max(next[kind], 0) + spec.seconds;
  return next;
}

/** 走过 dt 秒，时效道具倒计时（不会变成负数）。 */
export function tickPowerups(state: PowerupState, dt: number): PowerupState {
  const step = Math.max(0, dt);
  return {
    speedCloud: Math.max(0, state.speedCloud - step),
    confetti: Math.max(0, state.confetti - step),
    magnetStar: Math.max(0, state.magnetStar - step),
    shield: state.shield,
  };
}

/** 道具叠出来的速度倍率：加速云和彩纸同时在身上就互相抵一部分。 */
export function powerupSpeedMult(state: PowerupState): number {
  let mult = 1;
  if (state.speedCloud > 0) mult *= SPEED_CLOUD_MULT;
  if (state.confetti > 0) mult *= CONFETTI_MULT;
  return mult;
}

/** 磁力星生效时的吸附半径，不生效就是 0。 */
export function magnetRadius(state: PowerupState): number {
  return state.magnetStar > 0 ? MAGNET_RADIUS : 0;
}

/**
 * 撞上障碍：有护盾泡就破一个泡泡挡下来（`blocked: true`），否则照常算一次撞击。
 */
export function absorbCrash(state: PowerupState): { state: PowerupState; blocked: boolean } {
  if (state.shield > 0) return { state: { ...state, shield: state.shield - 1 }, blocked: true };
  return { state: { ...state }, blocked: false };
}

/* ---------------- 二、赛道分岔与合流 ---------------- */

/** 分岔的一条支路：左路稳、右路快但难。 */
export type ForkSide = "left" | "right";

export interface ForkBranch {
  side: ForkSide;
  /** 支路里的实体，`at` 是绝对距离 */
  entities: Entity[];
  /** 难度分：障碍越多越高，只用来做展示与断言 */
  difficulty: number;
}

export interface ForkSection {
  /** 分岔口的绝对距离 */
  at: number;
  /** 合流点的绝对距离（两条支路共用，必须同帧） */
  mergeAt: number;
  /** 支路长度（两条一模一样长） */
  length: number;
  branches: [ForkBranch, ForkBranch];
}

/** 分岔段固定这么长：两条路一样长，谁也不吃亏。 */
export const FORK_LENGTH = 72;
/** 每隔多远最多来一次分岔 */
export const FORK_MIN_SPACING = 260;

const FORK_SAFE: Array<{ kind: EntityKind; lane: 0 | 1 | 2; off: number }> = [
  { kind: "coin", lane: 1, off: 14 },
  { kind: "hurdle", lane: 0, off: 26 },
  { kind: "coin", lane: 1, off: 34 },
  { kind: "rock", lane: 2, off: 46 },
  { kind: "coin", lane: 1, off: 58 },
];

const FORK_FAST: Array<{ kind: EntityKind; lane: 0 | 1 | 2; off: number }> = [
  { kind: "boost", lane: 1, off: 10 },
  { kind: "gate", lane: 0, off: 22 },
  { kind: "gate", lane: 1, off: 22 },
  { kind: "coin", lane: 2, off: 22 },
  { kind: "hurdle", lane: 2, off: 40 },
  { kind: "coin", lane: 0, off: 40 },
  { kind: "rock", lane: 1, off: 56 },
  { kind: "coin", lane: 0, off: 62 },
];

function difficultyOf(entities: Entity[]): number {
  let score = 0;
  for (const e of entities) {
    if (e.kind === "rock") score += 3;
    else if (e.kind === "gate") score += 2;
    else if (e.kind === "hurdle" || e.kind === "pit") score += 2;
  }
  return score;
}

/**
 * 造一个分岔段。左右两条支路**长度严格相同**，只有难度不同：
 * 稳路障碍少但没有加速带，快路有加速带但要连着做两个动作。
 * 合流点两边都是 `at + FORK_LENGTH`，所以不管选哪条，回到主道的那一米是同一米。
 */
export function buildFork(at: number, seed: number): ForkSection {
  const rng = makeRng(seed >>> 0);
  // 随机决定「稳路」在左还是在右，避免孩子形成「永远走左边」的肌肉记忆
  const safeOnLeft = rng() < 0.5;
  const make = (side: ForkSide, table: typeof FORK_SAFE): ForkBranch => {
    const entities = table.map((e) => ({ kind: e.kind, lane: e.lane, at: at + e.off }));
    return { side, entities, difficulty: difficultyOf(entities) };
  };
  const left = make("left", safeOnLeft ? FORK_SAFE : FORK_FAST);
  const right = make("right", safeOnLeft ? FORK_FAST : FORK_SAFE);
  return {
    at,
    mergeAt: at + FORK_LENGTH,
    length: FORK_LENGTH,
    branches: [left, right],
  };
}

/** 分岔公平性：两条一样长、合流点相同、两条都走得通、难度确有区别。 */
export function forkIsFair(fork: ForkSection): boolean {
  const [a, b] = fork.branches;
  if (fork.mergeAt !== fork.at + fork.length) return false;
  const spanOf = (br: ForkBranch): number => {
    // 支路占用的距离区间就是分岔段本身，实体不许越过合流点
    return br.entities.every((e) => e.at >= fork.at && e.at <= fork.mergeAt) ? fork.length : -1;
  };
  if (spanOf(a) !== spanOf(b) || spanOf(a) < 0) return false;
  if (a.difficulty === b.difficulty) return false;
  return trackHasRoute(a.entities, MAX_SPEED) && trackHasRoute(b.entities, MAX_SPEED);
}

/** 按间距在一段赛道上排分岔口（可复现）。 */
export function planForks(fromMeters: number, toMeters: number, seed: number): ForkSection[] {
  const out: ForkSection[] = [];
  const first = Math.ceil(Math.max(fromMeters, FORK_MIN_SPACING) / FORK_MIN_SPACING);
  for (let k = first; k * FORK_MIN_SPACING <= toMeters; k++) {
    out.push(buildFork(k * FORK_MIN_SPACING, seed + k * 7919));
  }
  return out;
}

/* ---------------- 三、幽灵配速扩展 ---------------- */

/** 幽灵来自谁：自己的最好成绩，还是对手上一局。 */
export type GhostSource = "self" | "rival";

export interface GhostSnapshot {
  source: GhostSource;
  dist: number;
  seconds: number;
  /** 谁跑的（展示用，不参与配速计算） */
  who: string;
}

export const GHOST_SNAPSHOT_VERSION = 2;

/**
 * 存档 key 只增不改：1.1 的 `logic.GHOST_KEY` 继续放**自己**的最好成绩，
 * **对手上一局**那一趟放这把新 key，两边互不覆盖。
 */
export const GHOST_RIVAL_KEY = "yiduo-yixing.duo-rush.ghost-rival.v1";

export function makeGhostSnapshot(
  source: GhostSource,
  dist: number,
  seconds: number,
  who: string,
): GhostSnapshot | null {
  if (!Number.isFinite(dist) || !Number.isFinite(seconds)) return null;
  if (dist <= 0 || seconds <= 0) return null;
  return {
    source,
    dist: Math.round(dist),
    seconds: Math.round(seconds * 100) / 100,
    who: who.slice(0, 8),
  };
}

export function serializeGhostSnapshot(snap: GhostSnapshot): string {
  return JSON.stringify({ v: GHOST_SNAPSHOT_VERSION, ...snap });
}

/** 坏数据一律当「还没有幽灵」，绝不让存档把游戏搞崩。 */
export function parseGhostSnapshot(raw: string | null | undefined): GhostSnapshot | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    if (o.v !== GHOST_SNAPSHOT_VERSION) return null;
    if (o.source !== "self" && o.source !== "rival") return null;
    if (typeof o.dist !== "number" || typeof o.seconds !== "number") return null;
    return makeGhostSnapshot(o.source, o.dist, o.seconds, typeof o.who === "string" ? o.who : "");
  } catch {
    return null;
  }
}

/* ---------------- 四、让分助推 ---------------- */

/** 让分助推封顶 8%——再高就不是「陪玩」而是「代打」了。 */
export const HANDICAP_MAX = 0.08;
/** 落后多少米才开始给助推 */
export const HANDICAP_START_GAP = 20;
/** 落后多少米时助推顶到上限 */
export const HANDICAP_FULL_GAP = 120;

/**
 * 落后方的速度倍率。默认关闭（`enabled = false` 时永远返回 1）。
 * 领先方永远拿不到助推，助推最多 1.08 —— 追得回来，但追不成碾压。
 */
export function handicapMult(
  enabled: boolean,
  selfDist: number,
  rivalDist: number,
): number {
  if (!enabled) return 1;
  const gap = rivalDist - selfDist;
  if (!(gap > HANDICAP_START_GAP)) return 1;
  const t = Math.min(1, (gap - HANDICAP_START_GAP) / (HANDICAP_FULL_GAP - HANDICAP_START_GAP));
  return 1 + HANDICAP_MAX * t;
}

/** HUD 上要不要显示「让分开着」的提示。 */
export function handicapBadge(enabled: boolean): string | null {
  return enabled ? "让分中 · 落后的人会跑快一点点" : null;
}

/* ---------------- 五、没有战役也要接 initialLevel ---------------- */

/** 赛道难度档：0 悠闲 / 1 标准 / 2 起风 / 3 飞快 */
export type TrackTier = 0 | 1 | 2 | 3;

export interface RushSetup {
  tier: TrackTier;
  /** 人机档，和 `ai.ts` 的 AiLevel 一一对应 */
  aiLevel: 0 | 1 | 2 | 3;
  label: string;
}

export const TRACK_TIER_LABELS: Record<TrackTier, string> = {
  0: "悠闲跑道",
  1: "标准跑道",
  2: "起风跑道",
  3: "飞快跑道",
};

/** 各难度档的出发速度倍率（封顶速度不变，保证永远反应得过来）。 */
export const TRACK_TIER_MULT: Record<TrackTier, number> = { 0: 0.85, 1: 1, 2: 1.08, 3: 1.15 };

/**
 * 平台传进来的第 N 关 → 本款的「赛道难度档 + 人机档」。
 * 映射表：每 47 关升一档（188 / 4 = 47），越界 clamp，非法值当第 1 关。
 * 这样「直达第 100 关」在本款就是「起风跑道 + 高手电脑」，语义稳定可测。
 */
export function levelToSetup(level: number): RushSetup {
  const n = Number.isFinite(level) ? Math.max(1, Math.min(188, Math.floor(level))) : 1;
  const tier = Math.min(3, Math.floor((n - 1) / 47)) as TrackTier;
  const aiLevel = tier as 0 | 1 | 2 | 3;
  return { tier, aiLevel, label: TRACK_TIER_LABELS[tier] };
}

/**
 * 从 `?level=12` 这样的查询串里取关号；没有、不是数字就返回 null（按默认档开局）。
 * 平台以后若改用 `initialLevel` 直接传参，这里照旧兜底，不冲突。
 */
export function levelFromQuery(search: string | null | undefined): number | null {
  if (typeof search !== "string" || search === "") return null;
  const q = search.startsWith("?") ? search.slice(1) : search;
  for (const part of q.split("&")) {
    const [k, v] = part.split("=");
    if (k !== "level") continue;
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : null;
  }
  return null;
}

/* ---------------- 六、无尽成绩 ---------------- */

/** 无尽成绩只增不减：新成绩没超过纪录就把纪录原样返回。 */
export function bestEndless(prev: number, next: number): number {
  const p = Number.isFinite(prev) ? Math.max(0, Math.round(prev)) : 0;
  if (!Number.isFinite(next)) return p;
  return Math.max(p, Math.max(0, Math.round(next)));
}
