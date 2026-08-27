/**
 * 梨康擂台 · 人机四档。
 *
 * 1.1 的擂台只能两个人玩,家里只有一个孩子就开不了局,这一版补上人机:
 * 菜鸟 / 普通 / 高手 / 地狱四档,差别写在一张数据表里,不藏在代码里。
 *
 * **地狱档也必须留反打窗口**:反应时间恒大于 0、失手率恒大于 0、放招同样有前摇,
 * 也就是说它永远不是「0 帧完美反应」的机器,孩子只要抢先卡位就打得回来。
 * `ai.test.ts` 用固定 seed 自我对弈盯着这两条。
 */
import { GRAB_ACTIVE, GRAB_BASE_RADIUS, GRAB_WINDUP } from "./skills";
import { type SpawnEvent, type TargetKind, makeRng, tapScore } from "./logic";

export type AiLevel = "rookie" | "normal" | "pro" | "master";

export const AI_LEVELS: readonly AiLevel[] = ["rookie", "normal", "pro", "master"];

export interface AiSpec {
  level: AiLevel;
  /** 给小朋友看的档名 */
  label: string;
  emoji: string;
  /** 看到目标之后要愣多久才动(秒);永远 > 0 */
  reactionS: number;
  /** 移动速度倍率 */
  speed: number;
  /** 手滑放走目标的概率;永远 > 0 */
  missRate: number;
  /** 误碰迷糊泡的概率 */
  bombRisk: number;
  /** 平均隔多久放一次技能(秒);越小越会用招 */
  skillGap: number;
  /** 明写出来的反打窗口(秒):它最快也要这么久才出手,这段时间是留给对手的 */
  counterWindowS: number;
  /** 一句话说明,选人机档的时候显示 */
  blurb: string;
}

export const AI_SPECS: Readonly<Record<AiLevel, AiSpec>> = {
  rookie: {
    level: "rookie",
    label: "菜鸟",
    emoji: "🐣",
    reactionS: 0.85,
    speed: 0.6,
    missRate: 0.4,
    bombRisk: 0.34,
    skillGap: 14,
    counterWindowS: 0.85,
    blurb: "刚学会走位,常常慢半拍,还会自己撞上迷糊泡。第一次玩挑它。",
  },
  normal: {
    level: "normal",
    label: "普通",
    emoji: "🙂",
    reactionS: 0.48,
    speed: 0.88,
    missRate: 0.22,
    bombRisk: 0.18,
    skillGap: 10,
    counterWindowS: 0.48,
    blurb: "节奏稳,偶尔失手。和三年级左右的小朋友差不多。",
  },
  pro: {
    level: "pro",
    label: "高手",
    emoji: "😎",
    reactionS: 0.3,
    speed: 1.02,
    missRate: 0.12,
    bombRisk: 0.08,
    skillGap: 7,
    counterWindowS: 0.3,
    blurb: "会挑高分目标,也会用技能,想赢得靠卡位。",
  },
  master: {
    level: "master",
    label: "地狱",
    emoji: "🔥",
    reactionS: 0.18,
    speed: 1.15,
    missRate: 0.06,
    bombRisk: 0.03,
    skillGap: 5,
    counterWindowS: 0.18,
    blurb: "会预判你的路线,但出手一样有前摇,抢在它起步前卡住位置就有机会。",
  },
};

/** 地狱档也不许比这更快 —— 这是写死的反打窗口下限 */
export const MIN_COUNTER_WINDOW_S = 0.15;

/**
 * 这一档实际生效的反应时间(秒)。
 *
 * 「地狱档也必须留出反打窗口」是这一款的**硬规矩**:孩子只要比它先看见目标就抢得到,
 * 输了也是「我慢了半拍」,不是「它作弊」。以前这条规矩落在两个地方——
 * 规格表里把 `master.reactionS` 写成 0.18(确实大于下限),
 * 以及 `arena12.ts` 那张**根本没上场**的表里有一句 `Math.max(MIN, ...)`。
 * 真正在跑的 `thinkAi` 直接读 `spec.reactionS`,**下限一次都没兜住过**:
 * 谁把规格表里那个数改成 0,地狱档当场变成 0 帧完美反应,而且没有一条断言会红。
 *
 * 现在下限收在这里——所有读反应时间的地方都走这一个函数,规矩就兜得住了。
 */
export function reactionOf(spec: AiSpec): number {
  return Math.max(MIN_COUNTER_WINDOW_S, spec.reactionS);
}

export function aiSpec(level: AiLevel): AiSpec {
  return AI_SPECS[level] ?? AI_SPECS.normal;
}

/** 一个越大越强的强度数,只用来排序与断言,不参与玩法 */
export function aiStrength(spec: AiSpec): number {
  return spec.speed * 2 - spec.reactionS - spec.missRate - spec.bombRisk * 0.5;
}

/** 守擂第 n 场(n 从 1 起)对上哪一档:前四场一场一档,之后一直是地狱 */
export function tierForStreak(streak: number): AiLevel {
  const n = Math.max(1, Math.floor(streak));
  return AI_LEVELS[Math.min(AI_LEVELS.length - 1, n - 1)];
}

/* ---------------- 固定 seed 自我对弈(平衡性用) ---------------- */

/** 礼物泡按 3 分估值(它给的是技能与加分,折算成分数好比较) */
export const GIFT_POINTS = 3;

/** 跑到一个目标跟前平均要花多久(秒):半场对角线的一半除以速度 */
function travelSeconds(spec: AiSpec): number {
  return 0.34 / spec.speed;
}

/**
 * 拿一份出目标时间表,算这一档人机大概能拿多少分。
 * 纯函数:同 seed 同表一定是同一个结果,而且**每个事件固定消耗两个随机数**,
 * 所以四档用的是同一串随机数,比出来的差距只来自档位本身。
 */
export function simulateAiScore(level: AiLevel, seed: number, schedule: readonly SpawnEvent[]): number {
  const spec = aiSpec(level);
  const rng = makeRng(seed >>> 0);
  const travel = travelSeconds(spec);
  let score = 0;
  let busyUntil = 0;
  for (const ev of schedule) {
    const roll = rng();
    const roll2 = rng();
    const start = Math.max(busyUntil, ev.t + reactionOf(spec));
    const reach = start + travel * (0.7 + roll2 * 0.6);
    if (reach > ev.t + ev.ttl) continue; // 来不及,目标自己谢幕
    if (ev.kind === "bomb") {
      if (roll < spec.bombRisk) {
        score = Math.max(0, score - 2);
        busyUntil = reach + 1;
      }
      continue;
    }
    if (roll < spec.missRate) {
      busyUntil = reach + 0.12; // 手滑,白跑一趟
      continue;
    }
    score += ev.kind === "gift" ? GIFT_POINTS : tapScore(ev.kind, false);
    busyUntil = reach + GRAB_WINDUP + GRAB_ACTIVE;
  }
  return score;
}

/**
 * 给座位散一个互不相关的随机数种子。
 * 直接用 seed*2 / seed*2+1 会让两个座位的随机数流高度相关(相邻种子的线性同余流很像),
 * 自我对弈就会凭空长出「0 号位优势」——这里先把种子彻底打散再用。
 */
export function seatSeed(seed: number, seat: 0 | 1): number {
  let h = (seed ^ (seat === 0 ? 0x85ebca6b : 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 两档人机用同一份时间表打一局:0 = 前者胜,1 = 后者胜,-1 = 平 */
export function duelWinner(
  a: AiLevel,
  b: AiLevel,
  seed: number,
  schedule: readonly SpawnEvent[],
): 0 | 1 | -1 {
  // 两个座位各用一串互不相关的随机数,座位号只决定随机数,不决定任何规则
  const sa = simulateAiScore(a, seatSeed(seed, 0), schedule);
  const sb = simulateAiScore(b, seatSeed(seed, 1), schedule);
  if (sa > sb) return 0;
  if (sb > sa) return 1;
  return -1;
}

/** 打 n 局的胜率(平局算半场),用来断言档位强度与左右公平 */
export function winRate(
  a: AiLevel,
  b: AiLevel,
  seeds: readonly number[],
  scheduleFor: (seed: number) => readonly SpawnEvent[],
): number {
  let win = 0;
  for (const seed of seeds) {
    const r = duelWinner(a, b, seed, scheduleFor(seed));
    if (r === 0) win += 1;
    else if (r === -1) win += 0.5;
  }
  return win / seeds.length;
}

/* ---------------- 实时大脑(擂台里真正在跑的那个) ---------------- */

export interface AiTargetView {
  id: number;
  x: number;
  y: number;
  kind: TargetKind;
  /** 出现的时刻 */
  bornAt: number;
  /** 消失的时刻 */
  dieAt: number;
}

export interface AiCommand {
  /** 想往哪走(已归一化,长度 ≤ 1) */
  dx: number;
  dy: number;
  /** 这一帧要不要出手 */
  grab: boolean;
  /** 这一帧要不要放技能 */
  skill: boolean;
}

export interface AiBrain {
  spec: AiSpec;
  rng: () => number;
  /** 现在盯着哪个目标 */
  lockedId: number | null;
  /** 手滑之后发呆到什么时候 */
  hesitateUntil: number;
  /** 下一次可以考虑放技能的时刻 */
  nextSkillAt: number;
  /** 没有目标时闲逛的方向 */
  wanderAngle: number;
  /** 已经对哪些迷糊泡掷过骰子(每个泡只判一次,免得每帧重掷) */
  judgedBombs: Set<number>;
  /** 看走眼、真的会去踩的那些迷糊泡 */
  fooledBy: Set<number>;
}

export function createBrain(level: AiLevel, seed: number, now = 0): AiBrain {
  const spec = aiSpec(level);
  const rng = makeRng(seed >>> 0);
  return {
    spec,
    rng,
    lockedId: null,
    hesitateUntil: now,
    nextSkillAt: now + spec.skillGap * (0.5 + rng() * 0.5),
    wanderAngle: rng() * Math.PI * 2,
    judgedBombs: new Set<number>(),
    fooledBy: new Set<number>(),
  };
}

/**
 * 这个迷糊泡会不会被看走眼。
 * 每个泡只掷一次骰子并记下来:低档常常一头撞上去,地狱档基本不会,但也不是绝对。
 */
function fooledByBomb(brain: AiBrain, id: number): boolean {
  if (!brain.judgedBombs.has(id)) {
    brain.judgedBombs.add(id);
    if (brain.rng() < brain.spec.bombRisk) brain.fooledBy.add(id);
    // 记忆不无限长,免得一局下来越攒越多
    if (brain.judgedBombs.size > 64) {
      brain.judgedBombs.clear();
      brain.fooledBy.clear();
    }
  }
  return brain.fooledBy.has(id);
}

function targetValue(kind: TargetKind): number {
  if (kind === "coin") return 2;
  if (kind === "gift") return GIFT_POINTS;
  if (kind === "bomb") return -2;
  return 1;
}

/**
 * 想一步:挑目标、给方向、决定出不出手 / 放不放招。
 * 会改 brain 里的记忆(锁定谁、下次放招的时间),这是它作为「大脑」的本分。
 *
 * 关键的一条:目标出现后必须等满 `reactionS` 它才看得见,这就是留给对手的反打窗口。
 */
export function thinkAi(
  brain: AiBrain,
  now: number,
  self: { x: number; y: number },
  targets: readonly AiTargetView[],
  canSkill = true,
): AiCommand {
  const spec = brain.spec;
  const idle: AiCommand = { dx: 0, dy: 0, grab: false, skill: false };

  let skill = false;
  if (canSkill && now >= brain.nextSkillAt) {
    skill = true;
    brain.nextSkillAt = now + spec.skillGap * (0.7 + brain.rng() * 0.6);
  }

  if (now < brain.hesitateUntil) return { ...idle, skill };

  // 只看得见「已经出现满一个反应时间」的目标
  const react = reactionOf(spec);
  const visible = targets.filter((t) => now >= t.bornAt + react && now < t.dieAt);
  if (visible.length === 0) {
    brain.lockedId = null;
    // 场上有东西但还没「看见」→ 站着等,这段愣神就是留给对手的反打窗口;
    // 场上真的空了才随便晃两步,免得站得像根柱子。
    if (targets.some((t) => now < t.dieAt)) return { ...idle, skill };
    if (brain.rng() < 0.02) brain.wanderAngle = brain.rng() * Math.PI * 2;
    return { dx: Math.cos(brain.wanderAngle) * 0.35, dy: Math.sin(brain.wanderAngle) * 0.35, grab: false, skill };
  }

  let best: AiTargetView | null = null;
  let bestScore = -Infinity;
  for (const t of visible) {
    // 迷糊泡本来是躲着走的,只有看走眼的时候才会一头撞上去(档位越低越容易上当)
    if (t.kind === "bomb" && !fooledByBomb(brain, t.id)) continue;
    const dist = Math.hypot(t.x - self.x, t.y - self.y) + 0.02;
    const left = Math.max(0.05, t.dieAt - now);
    const keep = brain.lockedId === t.id ? 1.25 : 1; // 已经在追的略微加权,免得来回摇摆
    // 看走眼的迷糊泡在它眼里就是个普通目标,所以按 +1 估值
    const value = t.kind === "bomb" ? 1 : targetValue(t.kind);
    const s = (value / dist) * Math.min(1, left * 1.6) * keep;
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  if (!best) {
    brain.lockedId = null;
    return { ...idle, skill };
  }

  // 换目标的一瞬间掷一次手滑:失手就发呆一小会儿,分数拱手让人
  if (brain.lockedId !== best.id) {
    brain.lockedId = best.id;
    if (brain.rng() < spec.missRate) {
      brain.hesitateUntil = now + react * 0.9;
      return { ...idle, skill };
    }
  }

  const dx = best.x - self.x;
  const dy = best.y - self.y;
  const dist = Math.hypot(dx, dy);
  const grab = dist <= GRAB_BASE_RADIUS * 1.7;
  if (dist < 1e-6) return { dx: 0, dy: 0, grab, skill };
  return { dx: dx / dist, dy: dy / dist, grab, skill };
}
