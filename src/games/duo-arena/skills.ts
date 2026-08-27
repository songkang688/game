/**
 * 梨康擂台 · 出手与技能的纯状态机。
 *
 * 两条硬规矩:
 *  1. **没有伤害、没有血量。** 分数叫「元气」,被弹到只是原地转个圈,站起来接着抢。
 *  2. **所有招式都有前摇。** 按下去不是立刻生效,对手永远有反应的时间,
 *     这就是「可反打的窗口」,也顺手掐死了 1.1 那套「无脑连点也能赢」。
 *
 * 出手(鸭梨 `F` / 康康 `L`)分三段,肉眼可辨:
 *   前摇 `GRAB_WINDUP` → 生效 `GRAB_ACTIVE`(这段时间抓取范围放大) → 后摇 `GRAB_RECOVER`(不能再出手)。
 * 技能(鸭梨 `G` / 康康 `K`)是同一个键轮流放三招:加速 → 护盾泡 → 弹开波 → 再回到加速,
 * 每一招各自冷却,HUD 上写着下一招是什么。
 */

/* ---------------- 出手三段 ---------------- */

export const GRAB_WINDUP = 0.12;
export const GRAB_ACTIVE = 0.2;
export const GRAB_RECOVER = 0.26;
/** 平时的抓取半径(相对半场宽) */
export const GRAB_BASE_RADIUS = 0.062;
/** 出手生效那一段的抓取半径 */
export const GRAB_BURST_RADIUS = 0.135;

export type GrabPhase = "idle" | "windup" | "active" | "recover";

/** 出手开始到现在过了多久 → 处在哪一段;从没出过手就传 null */
export function grabPhase(startedAt: number | null, now: number): GrabPhase {
  if (startedAt === null) return "idle";
  const dt = now - startedAt;
  if (dt < 0) return "idle";
  if (dt < GRAB_WINDUP) return "windup";
  if (dt < GRAB_WINDUP + GRAB_ACTIVE) return "active";
  if (dt < GRAB_WINDUP + GRAB_ACTIVE + GRAB_RECOVER) return "recover";
  return "idle";
}

/** 现在能不能出手(前摇 / 生效 / 后摇里都不行 —— 连点没有任何好处) */
export function canGrab(startedAt: number | null, now: number): boolean {
  return grabPhase(startedAt, now) === "idle";
}

/** 当前的抓取半径:只有出手生效那 0.2 秒会变大 */
export function grabRadius(startedAt: number | null, now: number): number {
  return grabPhase(startedAt, now) === "active" ? GRAB_BURST_RADIUS : GRAB_BASE_RADIUS;
}

/* ---------------- 三个温和技能 ---------------- */

export type SkillId = "dash" | "shield" | "wave";

/** 轮转顺序,按一次换下一招 */
export const SKILL_ORDER: readonly SkillId[] = ["dash", "shield", "wave"];

export interface SkillSpec {
  id: SkillId;
  name: string;
  emoji: string;
  /** 前摇(秒):这段时间里对手还来得及躲 */
  windup: number;
  /** 生效时长(秒) */
  active: number;
  /** 生效结束后还要等多久才能再放这一招 */
  cooldown: number;
  blurb: string;
}

export const SKILLS: Readonly<Record<SkillId, SkillSpec>> = {
  dash: {
    id: "dash",
    name: "加速",
    emoji: "💨",
    windup: 0.1,
    active: 2.4,
    cooldown: 5,
    blurb: "脚下生风,跑得更快,抢远处的目标就靠它。",
  },
  shield: {
    id: "shield",
    name: "护盾泡",
    emoji: "🫧",
    windup: 0.15,
    active: 3,
    cooldown: 7,
    blurb: "罩一层泡泡,这段时间不会被弹开,也不会被冰住。",
  },
  wave: {
    id: "wave",
    name: "弹开波",
    emoji: "🌀",
    windup: 0.32,
    active: 0.35,
    cooldown: 9,
    blurb: "推出一圈软波把对手弹开转个圈,前摇很长,对面看得见、来得及开护盾。",
  },
};

/** 加速时移动速度乘多少 */
export const DASH_SPEED_SCALE = 1.55;
/** 被弹开波推到之后原地转圈多久 */
export const WAVE_SPIN_SECONDS = 0.7;
/** 被弹开波推走多远(相对半场宽) */
export const WAVE_PUSH = 0.14;

export interface Casting {
  id: SkillId;
  /** 前摇结束(= 生效开始)的时刻 */
  windupEnd: number;
  /** 生效结束的时刻 */
  activeEnd: number;
}

export interface SkillState {
  /** 下一次按键要放的那一招 */
  current: SkillId;
  /** 每一招各自的冷却结束时刻 */
  readyAt: Record<SkillId, number>;
  /** 正在放的招(前摇或生效中);没有就是 null */
  casting: Casting | null;
}

export function createSkillState(now = 0): SkillState {
  return {
    current: SKILL_ORDER[0],
    readyAt: { dash: now, shield: now, wave: now },
    casting: null,
  };
}

export function nextSkill(id: SkillId): SkillId {
  const i = SKILL_ORDER.indexOf(id);
  return SKILL_ORDER[(i + 1) % SKILL_ORDER.length];
}

export type SkillPhase = "ready" | "windup" | "active" | "cooldown";

export function skillPhase(state: SkillState, id: SkillId, now: number): SkillPhase {
  const c = state.casting;
  if (c && c.id === id) return now < c.windupEnd ? "windup" : "active";
  return now >= state.readyAt[id] ? "ready" : "cooldown";
}

/** 冷却还剩多少(0 = 好了,1 = 刚进冷却),HUD 画环形进度用 */
export function cooldownRatio(state: SkillState, id: SkillId, now: number): number {
  const spec = SKILLS[id];
  const left = state.readyAt[id] - now;
  if (left <= 0) return 0;
  return Math.min(1, left / spec.cooldown);
}

export function canCast(state: SkillState, now: number): boolean {
  if (state.casting) return false;
  return now >= state.readyAt[state.current];
}

/** 按下技能键:放得出来就返回 started = true,并把冷却记好 */
export function castSkill(state: SkillState, now: number): { state: SkillState; started: boolean; id: SkillId } {
  const id = state.current;
  if (!canCast(state, now)) return { state, started: false, id };
  const spec = SKILLS[id];
  const windupEnd = now + spec.windup;
  const activeEnd = windupEnd + spec.active;
  return {
    state: {
      current: id,
      readyAt: { ...state.readyAt, [id]: activeEnd + spec.cooldown },
      casting: { id, windupEnd, activeEnd },
    },
    started: true,
    id,
  };
}

/** 每帧推进:生效结束就收招,并自动轮到下一招 */
export function tickSkills(state: SkillState, now: number): SkillState {
  const c = state.casting;
  if (!c || now < c.activeEnd) return state;
  return { current: nextSkill(c.id), readyAt: state.readyAt, casting: null };
}

/** 现在正在生效的那一招(前摇中不算生效) */
export function activeSkill(state: SkillState, now: number): SkillId | null {
  const c = state.casting;
  if (!c) return null;
  return now >= c.windupEnd && now < c.activeEnd ? c.id : null;
}

export function isSkillActive(state: SkillState, id: SkillId, now: number): boolean {
  return activeSkill(state, now) === id;
}

/** 护盾泡罩着的时候,弹开波和冰冻都不生效 */
export function isProtected(state: SkillState, now: number): boolean {
  return isSkillActive(state, "shield", now);
}

/**
 * 弹开波是否**刚刚**在这一帧生效(前摇跨过去的那一帧)。
 * 只在这一帧推一次对手,不会按住不放连推。
 */
export function waveJustFired(state: SkillState, prevNow: number, now: number): boolean {
  const c = state.casting;
  if (!c || c.id !== "wave") return false;
  return prevNow < c.windupEnd && now >= c.windupEnd;
}

/** 被弹开后新的落点方向(纯计算:沿着两人连线推开,再交给场地收边) */
export function pushedPosition(
  self: { x: number; y: number },
  from: { x: number; y: number },
  distance: number = WAVE_PUSH,
): { x: number; y: number } {
  const dx = self.x - from.x;
  const dy = self.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: self.x, y: self.y + distance };
  return { x: self.x + (dx / len) * distance, y: self.y + (dy / len) * distance };
}
