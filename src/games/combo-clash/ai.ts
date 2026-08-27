/**
 * 连招对决 —— 四档人机。
 *
 * 四档的差别不是"数值外挂",是四件事:
 *  1. **反应延迟**:隔多少帧才重新看一眼场上,中间照着旧主意做(菜鸟 24 帧,地狱 8 帧);
 *  2. **会不会防**:看到对手起手时按后方向的概率;
 *  3. **会不会连**:高手起就会照着一小段脚本按「轻 → 重 → 必杀」,地狱还会超级取消;
 *  4. **会不会抓起身**:地狱档会等对手投无敌帧过去再贴上来抱。
 *
 * 随机数用自带的确定性发生器,给同一个 seed 就得到同一串行为,方便单测。
 */
import { characterOf, currentMove, gapBetween, isFree, type MatchState } from "./engine";
import {
  THROW_RANGE,
  inCancelWindow,
  inputOf,
  movePhase,
  neutralInput,
  superLevelFor,
  type DummyMode,
  type InputFrame
} from "./rules";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export const AI_TIER_HINTS: Record<AiTier, string> = {
  rookie: "只会轻击,站着不怎么动,第一次上手挑它",
  normal: "会挡也会跳,偶尔来一记重击",
  pro: "会反跳入、会破防,看距离出必杀",
  hell: "会抓起身、会存槽超级取消,反应只差 8 帧"
};

/** 每一档隔多少帧重新想一次 —— 这就是反应延迟 */
export const AI_REACTION: Record<AiTier, number> = { rookie: 24, normal: 16, pro: 10, hell: 8 };
/** 看到对手起手时去格挡的概率 */
export const AI_GUARD_CHANCE: Record<AiTier, number> = { rookie: 0.05, normal: 0.5, pro: 0.82, hell: 0.94 };
/** 主动往前压的积极度 */
export const AI_AGGRESSION: Record<AiTier, number> = { rookie: 0.3, normal: 0.58, pro: 0.78, hell: 0.9 };
/** 贴身时改用投技的概率 */
export const AI_THROW_CHANCE: Record<AiTier, number> = { rookie: 0, normal: 0.15, pro: 0.4, hell: 0.6 };
/** 会不会照脚本接连段 */
export const AI_COMBO: Record<AiTier, boolean> = { rookie: false, normal: false, pro: true, hell: true };
/** 会不会超级取消 */
export const AI_SUPER_CANCEL: Record<AiTier, boolean> = { rookie: false, normal: false, pro: false, hell: true };
/** 会不会抓起身 */
export const AI_WAKEUP_PRESSURE: Record<AiTier, boolean> = {
  rookie: false,
  normal: false,
  pro: true,
  hell: true
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AiBrain {
  tier: AiTier;
  rand: () => number;
  /** 排好队的输入脚本,一帧一帧放出去 */
  queue: InputFrame[];
}

export function createBrain(tier: AiTier, seed: number): AiBrain {
  return { tier, rand: mulberry32(seed || 1), queue: [] };
}

function hold(input: Partial<InputFrame>, frames: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < frames; i++) out.push(inputOf(input));
  return out;
}

/** 前 / 后分别是哪个方向键 */
function dirs(facing: 1 | -1): { forward: "left" | "right"; back: "left" | "right" } {
  return facing === 1 ? { forward: "right", back: "left" } : { forward: "left", back: "right" };
}

/** 对手现在正在出招的哪一段(没出招返回 null) */
export function foePhaseNow(m: MatchState, side: 0 | 1): "startup" | "active" | "recovery" | null {
  const foe = m.fighters[side === 0 ? 1 : 0];
  const mv = currentMove(foe);
  if (!mv) return null;
  const ph = movePhase(mv, foe.frame - 1);
  return ph === "done" ? null : ph;
}

/** 一小段连段脚本:轻 → 取消重 → 取消必杀(地狱档再超级取消) */
function comboScript(forward: "left" | "right", withSuper: boolean): InputFrame[] {
  const script: InputFrame[] = [
    ...hold({}, 1),
    ...hold({ light: true }, 2),
    ...hold({}, 5),
    ...hold({ heavy: true }, 2),
    ...hold({}, 6),
    ...hold({ burst: true }, 2),
    ...hold({}, 4)
  ];
  if (withSuper) {
    script.push(...hold({}, 1), ...hold({ burst: true }, 2), ...hold({}, 3));
  }
  // 连段全程轻轻按住前方向,免得被推开就断
  return script.map((f) => ({ ...f, [forward]: true }) as InputFrame);
}

/** 抓起身:等投无敌那 4 帧过去,再贴上去抱 */
function wakeupThrowScript(forward: "left" | "right"): InputFrame[] {
  return [
    ...hold({ [forward]: true } as Partial<InputFrame>, 6),
    ...hold({ [forward]: true, burst: true } as Partial<InputFrame>, 2),
    ...hold({}, 4)
  ];
}

/**
 * 这一帧 AI 按什么。纯函数(除了 brain 自己的队列与随机数),不碰 DOM。
 */
export function aiDecide(m: MatchState, side: 0 | 1, brain: AiBrain): InputFrame {
  const me = m.fighters[side];
  const foe = m.fighters[side === 0 ? 1 : 0];
  const { forward, back } = dirs(me.facing);
  const tier = brain.tier;
  const gap = gapBetween(m);

  // 超级取消:必杀命中的窗口里按必杀钮
  if (AI_SUPER_CANCEL[tier]) {
    const mv = currentMove(me);
    if (mv && mv.kind === "special" && inCancelWindow(mv, me.frame - 1, me.hasHit) && superLevelFor(me.meter) >= 1) {
      brain.queue = [];
      return inputOf({ burst: true });
    }
  }

  if (brain.queue.length > 0) {
    return brain.queue.shift() ?? neutralInput();
  }

  // 动不了的时候:会防的档先把后方向按住,起身时按受身
  if (!isFree(me)) {
    if (me.phase === "knockdown") {
      const tech = brain.rand() < (tier === "hell" ? 0.9 : tier === "pro" ? 0.7 : tier === "normal" ? 0.4 : 0.1);
      return inputOf(tech ? { light: true } : { [back]: true });
    }
    if (AI_GUARD_CHANCE[tier] > 0.4) return inputOf({ [back]: true });
    return neutralInput();
  }

  const react = AI_REACTION[tier];
  const r = brain.rand();

  // 抓起身:对手正在倒地 / 起身,贴上去抱
  if (AI_WAKEUP_PRESSURE[tier] && (foe.phase === "knockdown" || foe.phase === "wakeup") && gap < 90) {
    brain.queue = wakeupThrowScript(forward);
    return brain.queue.shift() ?? neutralInput();
  }

  // 反跳入:对手在空中扑过来,用起手快的必杀顶回去
  if ((tier === "pro" || tier === "hell") && foe.y > 24 && gap < 90) {
    brain.queue = hold({ burst: true }, 2).concat(hold({}, 6));
    return brain.queue.shift() ?? neutralInput();
  }

  // 看到起手就防
  const phase = foePhaseNow(m, side);
  if (phase === "startup" && gap < 110 && r < AI_GUARD_CHANCE[tier]) {
    brain.queue = hold({ [back]: true } as Partial<InputFrame>, react);
    return brain.queue.shift() ?? neutralInput();
  }

  // 太远就往前压;投射型偶尔在远处丢一发
  if (gap > 120) {
    const ch = characterOf(me);
    if (ch.archetype === "zoner" && tier !== "rookie" && r < 0.45) {
      brain.queue = hold({ burst: true }, 2).concat(hold({}, react));
      return brain.queue.shift() ?? neutralInput();
    }
    const move = r < AI_AGGRESSION[tier];
    brain.queue = hold(move ? ({ [forward]: true } as Partial<InputFrame>) : {}, react);
    return brain.queue.shift() ?? neutralInput();
  }

  // 贴身:抓投
  if (gap <= THROW_RANGE && brain.rand() < AI_THROW_CHANCE[tier]) {
    brain.queue = hold({ [forward]: true, burst: true } as Partial<InputFrame>, 2).concat(hold({}, react));
    return brain.queue.shift() ?? neutralInput();
  }

  // 打得着就打
  if (gap < 74) {
    if (AI_COMBO[tier]) {
      brain.queue = comboScript(forward, AI_SUPER_CANCEL[tier] && superLevelFor(me.meter) >= 1);
      return brain.queue.shift() ?? neutralInput();
    }
    if (tier === "normal" && brain.rand() < 0.35) {
      brain.queue = hold({ heavy: true }, 2).concat(hold({}, react));
      return brain.queue.shift() ?? neutralInput();
    }
    // 菜鸟只会轻击,而且经常发呆
    if (tier === "rookie" && brain.rand() > 0.55) {
      brain.queue = hold({}, react);
      return brain.queue.shift() ?? neutralInput();
    }
    brain.queue = hold({ light: true }, 2).concat(hold({}, react));
    return brain.queue.shift() ?? neutralInput();
  }

  // 中距离:往前挪一点,高手偶尔跳入
  if ((tier === "pro" || tier === "hell") && brain.rand() < 0.22) {
    brain.queue = hold({ up: true, [forward]: true } as Partial<InputFrame>, 2)
      .concat(hold({}, 10))
      .concat(hold({ heavy: true }, 2))
      .concat(hold({}, 8))
      .concat(hold({ light: true }, 2))
      .concat(hold({}, 6));
    return brain.queue.shift() ?? neutralInput();
  }
  brain.queue = hold({ [forward]: true } as Partial<InputFrame>, Math.max(4, Math.round(react / 2)));
  return brain.queue.shift() ?? neutralInput();
}

/** 把一档 AI 包成 `runHeadless` 要的决策器 */
export function aiDecider(tier: AiTier, seed: number): (m: MatchState, side: 0 | 1) => InputFrame {
  const brain = createBrain(tier, seed);
  return (m, side) => aiDecide(m, side, brain);
}

// ---------------------------------------------------------------------------
// 关卡专用对手:一直挡的木桩、一直跳的小鸟、训练假人
// ---------------------------------------------------------------------------

/** 关卡里对手的打法 */
export type FoeStyle = "normal" | "turtle" | "jumper";

/** 一直挡的对手:破防工坊用它教「怎么撬开格挡」 */
export function turtleDecider(tier: AiTier, seed: number): (m: MatchState, side: 0 | 1) => InputFrame {
  const brain = createBrain(tier, seed);
  return (m, side) => {
    const me = m.fighters[side];
    const { back, forward } = dirs(me.facing);
    const gap = gapBetween(m);
    // 离得远就贴上来,贴住之后就一直挡;偶尔还一下手,免得变成纯木桩
    if (gap > 90) return inputOf({ [forward]: true } as Partial<InputFrame>);
    if (!isFree(me)) return inputOf({ [back]: true } as Partial<InputFrame>);
    if (brain.rand() < 0.06) return aiDecide(m, side, brain);
    const crouch = brain.rand() < 0.4;
    return inputOf({ [back]: true, down: crouch } as Partial<InputFrame>);
  };
}

/** 一直往你头上跳的对手:跳入花园用它教「怎么站着挡上段、怎么反跳入」 */
export function jumperDecider(tier: AiTier, seed: number): (m: MatchState, side: 0 | 1) => InputFrame {
  const brain = createBrain(tier, seed);
  let cool = 0;
  return (m, side) => {
    const me = m.fighters[side];
    const { forward } = dirs(me.facing);
    if (cool > 0) {
      cool -= 1;
      if (me.y > 20 && cool === 6) return inputOf({ heavy: true });
      return inputOf({ [forward]: true } as Partial<InputFrame>);
    }
    if (isFree(me) && me.y <= 0 && brain.rand() < 0.5) {
      cool = 22;
      return inputOf({ up: true, [forward]: true } as Partial<InputFrame>);
    }
    return aiDecide(m, side, brain);
  };
}

/** 按关卡配置挑一个对手决策器 */
export function foeDecider(style: FoeStyle, tier: AiTier, seed: number): (m: MatchState, side: 0 | 1) => InputFrame {
  if (style === "turtle") return turtleDecider(tier, seed);
  if (style === "jumper") return jumperDecider(tier, seed);
  return aiDecider(tier, seed);
}

/** 训练假人:站着 / 一直跳 / 一直挡 / 挡完就还手 */
export function dummyDecider(mode: DummyMode, seed = 7): (m: MatchState, side: 0 | 1) => InputFrame {
  const brain = createBrain("normal", seed);
  return (m, side) => {
    const me = m.fighters[side];
    const { back } = dirs(me.facing);
    if (mode === "stand") return neutralInput();
    if (mode === "jump") return isFree(me) && me.y <= 0 ? inputOf({ up: true }) : neutralInput();
    if (mode === "block") return inputOf({ [back]: true } as Partial<InputFrame>);
    // 挡完就还手
    if (me.phase === "blockstun" || me.phase === "hitstun") return inputOf({ [back]: true } as Partial<InputFrame>);
    if (isFree(me) && gapBetween(m) < 70) return inputOf({ light: true });
    return inputOf({ [back]: true } as Partial<InputFrame>);
  };
}
