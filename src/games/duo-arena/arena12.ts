/**
 * 朵星擂台 · 1.2 深度层（纯函数，不碰 DOM）。
 *
 * 1.1 的擂台是「两个半场共用同一份出目标时间表、谁点得快谁赢」——公平但薄：
 * 家里只有一个孩子就打不了，也没有可以钻研的东西。1.2 补五件事：
 *  1. **人机四档**（菜鸟 / 普通 / 高手 / 地狱），低档反应慢还会失误，
 *     高档反应快但**永远保留一个可反打的窗口**（不许 0 秒完美反应）；
 *  2. **三个温和技能**（护盾泡 / 弹开波 / 星光冲刺），有前摇与冷却，纯状态机，
 *     全部用「元气」「星星点数」的说法，**没有伤害与血量语义**；
 *  3. **三张擂台**：目标存活时长、出目标节奏、炸弹比例、半场形状各不相同，写成数据表；
 *  4. **让分开关**：落后一方的目标多留一点点时间，封顶 8%，默认关闭；
 *  5. **守擂无尽**：连续挑战越来越强的人机，输了结束，记最高连胜。
 *
 * 本款**明确不做 188 关战役**：纯反应对战硬凑 188 关只会变成「同一局重复 188 遍」的注水，
 * 平台传进来的第 N 关改成映射「人机档 + 擂台」，见 `levelToArenaSetup`。
 */
import { makeRng, type SpawnEvent, type TargetKind } from "./logic";

/* ---------------- 一、人机四档 ---------------- */

/** 0 菜鸟 / 1 普通 / 2 高手 / 3 地狱 */
export type ArenaAiLevel = 0 | 1 | 2 | 3;

export const ARENA_AI_LEVELS: readonly ArenaAiLevel[] = [0, 1, 2, 3];

export const ARENA_AI_LABELS: Record<ArenaAiLevel, string> = {
  0: "菜鸟",
  1: "普通",
  2: "高手",
  3: "地狱",
};

export const ARENA_AI_HINTS: Record<ArenaAiLevel, string> = {
  0: "手慢半拍，还常常点到炸弹，第一次上擂台挑它",
  1: "反应一般，偶尔手滑，稳住就能赢",
  2: "眼疾手快，但它也要 0.22 秒才反应过来，抢那半拍",
  3: "几乎不失误，可它照样有 0.16 秒的反应时间——你先手就还有机会",
};

/** 看见一个目标之后要多久才点得到（秒）：这就是它的反应窗口 */
export const ARENA_AI_REACTION: Record<ArenaAiLevel, number> = {
  0: 0.62,
  1: 0.4,
  2: 0.22,
  3: 0.16,
};
/** 该点的没点（手滑漏掉）的概率 */
export const ARENA_AI_MISS: Record<ArenaAiLevel, number> = { 0: 0.4, 1: 0.2, 2: 0.07, 3: 0.02 };
/** 误点炸弹的概率 */
export const ARENA_AI_BOMB_SLIP: Record<ArenaAiLevel, number> = {
  0: 0.3,
  1: 0.14,
  2: 0.04,
  3: 0.012,
};

/**
 * 地狱档也必须留出这么多反应时间，**不许写成 0**。
 * 有了这条，孩子只要比它先看到目标就一定抢得到，输了也是「我慢了半拍」而不是「它作弊」。
 */
export const ARENA_AI_MIN_REACTION = 0.15;

export interface ArenaAiBrain {
  level: ArenaAiLevel;
  rand: () => number;
}

export function createArenaAi(level: ArenaAiLevel, seed: number): ArenaAiBrain {
  return { level, rand: makeRng((seed || 1) >>> 0) };
}

export interface AiTapPlan {
  /** 打算点时间表里的第几个目标 */
  index: number;
  /** 什么时候点（回合内秒数） */
  at: number;
  kind: TargetKind;
}

/**
 * 电脑这一整个回合打算怎么点：对每个目标掷一次骰子，
 * 决定「点不点、什么时候点、会不会误点炸弹」。
 * 同一个 seed 出同一串计划，单测里可以完全复现。
 */
export function planArenaTaps(brain: ArenaAiBrain, schedule: readonly SpawnEvent[]): AiTapPlan[] {
  const out: AiTapPlan[] = [];
  const reaction = Math.max(ARENA_AI_MIN_REACTION, ARENA_AI_REACTION[brain.level]);
  for (const [index, ev] of schedule.entries()) {
    if (ev.kind === "bomb") {
      // 炸弹本来就不该点，只有手滑才会点
      if (brain.rand() < ARENA_AI_BOMB_SLIP[brain.level]) {
        out.push({ index, at: ev.t + reaction, kind: ev.kind });
      } else {
        brain.rand(); // 保持每个目标消耗两次随机数，档位之间才好比较
      }
      continue;
    }
    if (brain.rand() < ARENA_AI_MISS[brain.level]) {
      brain.rand();
      continue; // 手滑漏掉
    }
    const jitter = brain.rand() * reaction * 0.35;
    const at = ev.t + reaction + jitter;
    // 目标已经消失了就点不到
    if (at > ev.t + ev.ttl) continue;
    out.push({ index, at, kind: ev.kind });
  }
  return out;
}

/* ---------------- 二、温和技能 ---------------- */

/** 三个技能都不带伤害语义：护住自己、把对手的目标推走、让自己的点数亮一会儿。 */
export type SkillKind = "shieldBubble" | "pushWave" | "sparkle";

export const SKILL_KINDS: readonly SkillKind[] = ["shieldBubble", "pushWave", "sparkle"];

export interface SkillSpec {
  kind: SkillKind;
  label: string;
  emoji: string;
  /** 前摇：按下去到生效之间的等待（秒），让对手有反应余地 */
  windup: number;
  /** 生效持续（秒）；护盾泡按次数算，写 0 */
  active: number;
  /** 冷却（秒），从生效结束那一刻开始算 */
  cooldown: number;
  hint: string;
}

export const SKILLS: Record<SkillKind, SkillSpec> = {
  shieldBubble: {
    kind: "shieldBubble",
    label: "护盾泡",
    emoji: "🫧",
    windup: 0.25,
    active: 0,
    cooldown: 8,
    hint: "罩住自己，下一次点到炸弹只会啵一声，不扣点数",
  },
  pushWave: {
    kind: "pushWave",
    label: "弹开波",
    emoji: "🌀",
    windup: 0.4,
    active: 0,
    cooldown: 10,
    hint: "把对手半场最值钱的那个目标轻轻弹走，对手会看见预警",
  },
  sparkle: {
    kind: "sparkle",
    label: "星光冲刺",
    emoji: "✨",
    windup: 0.3,
    active: 4,
    cooldown: 12,
    hint: "接下来 4 秒，你点到的每个好东西都多算 1 点星星",
  },
};

export type SkillPhase = "ready" | "windup" | "active" | "cooldown";

export interface SkillState {
  kind: SkillKind;
  phase: SkillPhase;
  /** 当前阶段还剩多少秒（`ready` 时是 0） */
  remain: number;
  /** 护盾泡还剩几层 */
  charges: number;
}

export function createSkill(kind: SkillKind): SkillState {
  return { kind, phase: "ready", remain: 0, charges: 0 };
}

/** 只有 `ready` 时按得动；按下去先进前摇，对手看得见。 */
export function pressSkill(state: SkillState): SkillState {
  if (state.phase !== "ready") return state;
  return { ...state, phase: "windup", remain: SKILLS[state.kind].windup };
}

/**
 * 技能状态机走 dt 秒：前摇 → 生效 → 冷却 → 就绪。
 * 护盾泡没有「生效时长」，前摇结束直接拿到一层护盾并进冷却。
 */
export function tickSkill(state: SkillState, dt: number): SkillState {
  const step = Math.max(0, dt);
  if (state.phase === "ready") return { ...state };
  let phase: SkillPhase = state.phase;
  let { remain, charges } = state;
  let left = step;
  // 用 while 而不是 if：一帧掉太久时也能连续跨过多个阶段，不会卡在负数上
  while (left > 0 && phase !== "ready") {
    if (remain > left) {
      remain -= left;
      left = 0;
      break;
    }
    left -= remain;
    const spec = SKILLS[state.kind];
    if (phase === "windup") {
      if (spec.active > 0) {
        phase = "active";
        remain = spec.active;
      } else {
        charges += 1;
        phase = "cooldown";
        remain = spec.cooldown;
      }
    } else if (phase === "active") {
      phase = "cooldown";
      remain = spec.cooldown;
    } else {
      phase = "ready";
      remain = 0;
    }
  }
  return { kind: state.kind, phase, remain, charges };
}

/** 星光冲刺正在生效吗（每个好目标多算 1 点）。 */
export function sparkleActive(state: SkillState): boolean {
  return state.kind === "sparkle" && state.phase === "active";
}

/** 点到炸弹：有护盾就消耗一层挡掉。 */
export function shieldAbsorb(state: SkillState): { state: SkillState; blocked: boolean } {
  if (state.kind !== "shieldBubble" || state.charges <= 0) return { state: { ...state }, blocked: false };
  return { state: { ...state, charges: state.charges - 1 }, blocked: true };
}

/* ---------------- 三、三张擂台 ---------------- */

export type StageId = "meadow" | "cloudDeck" | "starPond";

export interface StageSpec {
  id: StageId;
  label: string;
  emoji: string;
  /** 目标存活时长倍率：越小越急 */
  ttlMult: number;
  /** 出目标间隔倍率：越小越密 */
  intervalMult: number;
  /** 炸弹比例在基础上加多少（可为负） */
  bombDelta: number;
  /** 半场形状：矩形 / 圆形 / 上下收窄的梯形 —— 影响可点区域 */
  shape: "rect" | "round" | "taper";
  hint: string;
}

export const STAGES: readonly StageSpec[] = [
  {
    id: "meadow",
    label: "草地擂台",
    emoji: "🌿",
    ttlMult: 1.15,
    intervalMult: 1.1,
    bombDelta: -0.02,
    shape: "rect",
    hint: "最好上手：目标待得久、出得慢，炸弹也少",
  },
  {
    id: "cloudDeck",
    label: "云台擂台",
    emoji: "☁️",
    ttlMult: 1,
    intervalMult: 0.9,
    bombDelta: 0.02,
    shape: "round",
    hint: "圆台子：能点的地方是个圆，四个角落不出目标",
  },
  {
    id: "starPond",
    label: "星池擂台",
    emoji: "💫",
    ttlMult: 0.85,
    intervalMult: 0.78,
    bombDelta: 0.05,
    shape: "taper",
    hint: "最刺激：目标一闪就走，炸弹也多，台子中间宽两头窄",
  },
];

export function stageById(id: StageId): StageSpec {
  const found = STAGES.find((s) => s.id === id);
  return found ?? STAGES[0];
}

/** 一个相对坐标在这张擂台上是不是可点区域（形状裁剪）。 */
export function inStageShape(shape: StageSpec["shape"], x: number, y: number): boolean {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  if (shape === "rect") return true;
  if (shape === "round") {
    const dx = x - 0.5;
    const dy = y - 0.5;
    return dx * dx + dy * dy <= 0.25;
  }
  // taper：中间最宽，上下各收掉一截
  const halfWidth = 0.5 - Math.abs(y - 0.5) * 0.45;
  return Math.abs(x - 0.5) <= halfWidth;
}

/** 把时间表按擂台改写：调存活时长、调节奏，并把目标挪进可点区域。 */
export function applyStage(schedule: readonly SpawnEvent[], stage: StageSpec): SpawnEvent[] {
  const out: SpawnEvent[] = [];
  const first = schedule.length > 0 ? schedule[0].t : 0;
  for (const ev of schedule) {
    let { x, y } = ev;
    if (!inStageShape(stage.shape, x, y)) {
      // 往中心拉，直到落进可点区域；最坏就是正中心
      for (let k = 1; k <= 8; k++) {
        const f = k / 8;
        const nx = x + (0.5 - x) * f;
        const ny = y + (0.5 - y) * f;
        if (inStageShape(stage.shape, nx, ny)) {
          x = nx;
          y = ny;
          break;
        }
        if (k === 8) {
          x = 0.5;
          y = 0.5;
        }
      }
    }
    out.push({
      ...ev,
      t: first + (ev.t - first) * stage.intervalMult,
      ttl: ev.ttl * stage.ttlMult,
      x,
      y,
    });
  }
  return out;
}

/* ---------------- 四、让分开关 ---------------- */

/** 让分封顶 8%：落后一方的目标最多多留 8% 的时间。 */
export const ARENA_HANDICAP_MAX = 0.08;
/** 落后几分才开始给让分 */
export const ARENA_HANDICAP_START = 3;
/** 落后几分时让分顶到上限 */
export const ARENA_HANDICAP_FULL = 12;

export function arenaHandicap(enabled: boolean, selfScore: number, rivalScore: number): number {
  if (!enabled) return 1;
  const gap = rivalScore - selfScore;
  if (!(gap > ARENA_HANDICAP_START)) return 1;
  const t = Math.min(1, (gap - ARENA_HANDICAP_START) / (ARENA_HANDICAP_FULL - ARENA_HANDICAP_START));
  return 1 + ARENA_HANDICAP_MAX * t;
}

export function arenaHandicapBadge(enabled: boolean): string | null {
  return enabled ? "让分中 · 落后的人目标会多留一点点" : null;
}

/* ---------------- 五、守擂无尽 ---------------- */

/** 守擂第 n 场（从 1 开始）对手是哪一档：每两场升一档，封顶地狱。 */
export function defenseAiLevel(round: number): ArenaAiLevel {
  const n = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  return Math.min(3, Math.floor((n - 1) / 2)) as ArenaAiLevel;
}

/** 守擂第 n 场用哪张擂台：三张轮换，保证第 4 场以后也在换花样。 */
export function defenseStage(round: number): StageSpec {
  const n = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  return STAGES[(n - 1) % STAGES.length];
}

export interface DefenseState {
  /** 已经连赢几场 */
  streak: number;
  /** 现在打第几场 */
  round: number;
  over: boolean;
}

export function createDefense(): DefenseState {
  return { streak: 0, round: 1, over: false };
}

/** 守擂一场的结果：赢了连胜 +1 进下一场，输了当场结束。 */
export function defenseNext(state: DefenseState, won: boolean): DefenseState {
  if (state.over) return { ...state };
  if (!won) return { ...state, over: true };
  return { streak: state.streak + 1, round: state.round + 1, over: false };
}

/** 无尽成绩只增不减。 */
export function bestStreak(prev: number, next: number): number {
  const p = Number.isFinite(prev) ? Math.max(0, Math.round(prev)) : 0;
  if (!Number.isFinite(next)) return p;
  return Math.max(p, Math.max(0, Math.round(next)));
}

/* ---------------- 六、平台接线：第 N 关 → 人机档 + 擂台 ---------------- */

export interface ArenaSetup {
  aiLevel: ArenaAiLevel;
  stage: StageSpec;
  label: string;
}

/**
 * 第 N 关（1..188）映射成「人机档 + 擂台」：
 * 人机档每 47 关升一级（188 / 4），擂台按 (N-1) % 3 轮换。
 * 越界 clamp，非法值当第 1 关。
 */
export function levelToArenaSetup(level: number): ArenaSetup {
  const n = Number.isFinite(level) ? Math.max(1, Math.min(188, Math.floor(level))) : 1;
  const aiLevel = Math.min(3, Math.floor((n - 1) / 47)) as ArenaAiLevel;
  const stage = STAGES[(n - 1) % STAGES.length];
  return { aiLevel, stage, label: `${ARENA_AI_LABELS[aiLevel]} · ${stage.label}` };
}

/* ---------------- 七、赛点 ---------------- */

/** 这一回合是不是赛点局（谁再赢一个回合就拿下整场）。 */
export function isMatchPoint(wins1: number, wins2: number, roundsToWin: number = 2): boolean {
  return wins1 === roundsToWin - 1 || wins2 === roundsToWin - 1;
}

/** 赛点提示语（没到赛点返回 null）。 */
export function matchPointLine(wins1: number, wins2: number, names: [string, string]): string | null {
  if (!isMatchPoint(wins1, wins2)) return null;
  if (wins1 === wins2) return "赛点！这一回合谁赢，谁就是擂主";
  return `赛点！${wins1 > wins2 ? names[0] : names[1]} 再赢一回合就拿下`;
}
