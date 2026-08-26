/**
 * 朵星格斗王 —— 人机对手。
 *
 * 三档：轻松 / 普通 / 高手。三档的差别是三件事，不是"数值外挂"：
 *  1. **反应延迟**：AI 不是每帧重新想，而是隔一段才重新看一眼场上，中间照着旧主意做。
 *     轻松档看一眼要 26 帧（快半秒），高手档只要 7 帧。
 *  2. **会不会防**：看到对手起手时按后退键的概率，轻松档很低，高手档很高。
 *  3. **会不会反击**：对手招式收招时贴上去打的概率，只有普通档以上才会。
 *
 * 随机数用自带的确定性发生器，给同一个 seed 就得到同一串行为，方便单测。
 */
import { characterById, type MoveSlot } from "./frames";
import {
  gapBetween,
  inputOf,
  isFree,
  neutralInput,
  superReady,
  type FighterState,
  type InputFrame,
  type MatchState
} from "./engine";
import { movePhase, punishableOnBlock } from "./rules";

/** 0 = 轻松，1 = 普通，2 = 高手 */
export type AiLevel = 0 | 1 | 2;

export const AI_LABELS: Record<AiLevel, string> = {
  0: "轻松",
  1: "普通",
  2: "高手"
};

export const AI_HINTS: Record<AiLevel, string> = {
  0: "反应慢半拍，几乎不格挡，适合第一次上手",
  1: "会格挡也会还手，反应比你慢一点点",
  2: "会防会反击，收招被抓住就要挨一串，但它也有反应延迟"
};

/** 每一档"重新看一眼场上"要隔多少帧 —— 这就是反应延迟 */
export const AI_REACTION: Record<AiLevel, number> = { 0: 26, 1: 15, 2: 7 };
/** 看到对手起手时去格挡的概率 */
export const AI_GUARD_CHANCE: Record<AiLevel, number> = { 0: 0.18, 1: 0.62, 2: 0.9 };
/** 抓住对手收招时反击的概率 */
export const AI_PUNISH_CHANCE: Record<AiLevel, number> = { 0: 0, 1: 0.45, 2: 0.85 };
/** 主动进攻的积极度 */
export const AI_AGGRESSION: Record<AiLevel, number> = { 0: 0.35, 1: 0.6, 2: 0.78 };

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
  level: AiLevel;
  rand: () => number;
  /** 当前照着做的主意 */
  hold: InputFrame;
  /** 这个主意还要照做几帧 */
  holdLeft: number;
  /** 本回合已经放过几次超必杀（防止一直憋着不放） */
  supersUsed: number;
}

export function createBrain(level: AiLevel, seed: number): AiBrain {
  return { level, rand: mulberry32(seed || 1), hold: neutralInput(), holdLeft: 0, supersUsed: 0 };
}

/** 面朝对手时，"前"和"后"分别对应哪个方向键 */
function dirKeys(me: FighterState): { forward: "left" | "right"; back: "left" | "right" } {
  return me.facing === 1 ? { forward: "right", back: "left" } : { forward: "left", back: "right" };
}

/** 对手现在正在出招的哪一段（没出招返回 null） */
export function foePhaseNow(foe: FighterState): "startup" | "active" | "recovery" | null {
  if (foe.phase !== "attack" || !foe.slot) return null;
  const mv = characterById(foe.charId).moves[foe.slot];
  const ph = movePhase(mv, foe.frame);
  return ph === "done" ? null : ph;
}

/** 对手这一招收招之后好不好抓 */
export function foeIsPunishable(foe: FighterState): boolean {
  if (foe.phase !== "attack" || !foe.slot) return false;
  const mv = characterById(foe.charId).moves[foe.slot];
  return punishableOnBlock(mv) && movePhase(mv, foe.frame) === "recovery";
}

interface Plan {
  input: InputFrame;
  frames: number;
}

function planFor(brain: AiBrain, state: MatchState, side: 0 | 1): Plan {
  const me = state.fighters[side];
  const foe = state.fighters[1 - side];
  const { forward, back } = dirKeys(me);
  const gap = gapBetween(me, foe);
  const r = brain.rand;
  const close = gap <= 40;
  const mid = gap <= 110;

  // 倒地了：窗口里按轻击受身（高档更会受身）
  if (me.phase === "knockdown") {
    const techChance = 0.25 + brain.level * 0.35;
    return { input: r() < techChance ? inputOf({ light: true }) : neutralInput(), frames: 4 };
  }

  if (!isFree(me)) {
    // 被打飞 / 收招中：高手档会提前把后退键按住，落地立刻是格挡姿势
    const early = brain.level >= 2 && r() < 0.7;
    return { input: early ? inputOf({ [back]: true } as Partial<InputFrame>) : neutralInput(), frames: 3 };
  }

  const foePh = foePhaseNow(foe);

  // 1) 看到对手起手 → 格挡（蹲挡还是站挡也要猜一猜）
  if (foePh === "startup" || foePh === "active") {
    if (r() < AI_GUARD_CHANCE[brain.level]) {
      const crouch = r() < 0.5;
      return { input: inputOf({ [back]: true, down: crouch } as Partial<InputFrame>), frames: 6 };
    }
  }

  // 2) 对手收招露空档 → 反击（普通档以上才会）
  if (foeIsPunishable(foe) && close && r() < AI_PUNISH_CHANCE[brain.level]) {
    if (superReady(me) && brain.supersUsed < 2 && r() < 0.5) {
      brain.supersUsed++;
      return { input: inputOf({ down: true, light: true, heavy: true }), frames: 5 };
    }
    return { input: inputOf({ heavy: true }), frames: 5 };
  }

  // 3) 对手跳到头顶 → 对空（用带上挑的必杀，也就是 s2 / s3 里那一招）
  if (foe.airborne && foe.y > 20 && close && brain.level >= 1 && r() < 0.55) {
    const antiAir = antiAirSlot(me);
    if (antiAir === "s2") return { input: inputOf({ [forward]: true, heavy: true } as Partial<InputFrame>), frames: 5 };
    if (antiAir === "s3") return { input: inputOf({ [back]: true, heavy: true } as Partial<InputFrame>), frames: 5 };
    return { input: inputOf({ heavy: true }), frames: 5 };
  }

  // 4) 能量满了就找机会放超必杀
  if (superReady(me) && close && r() < 0.3 + brain.level * 0.2) {
    brain.supersUsed++;
    return { input: inputOf({ down: true, light: true, heavy: true }), frames: 5 };
  }

  // 5) 贴身了就打
  if (close) {
    const roll = r();
    const aggression = AI_AGGRESSION[brain.level];
    if (roll < aggression * 0.42) return { input: inputOf({ light: true }), frames: 4 };
    if (roll < aggression * 0.68) return { input: inputOf({ down: true, light: true }), frames: 4 };
    if (roll < aggression * 0.84) return { input: inputOf({ heavy: true }), frames: 6 };
    if (roll < aggression * 0.92) return { input: inputOf({ down: true, heavy: true }), frames: 6 };
    if (roll < aggression) return { input: inputOf({ light: true, heavy: true }), frames: 6 };
    return { input: inputOf({ [back]: true } as Partial<InputFrame>), frames: 8 };
  }

  // 6) 中距离：放必杀骚扰，或者压上去
  if (mid) {
    const roll = r();
    if (roll < 0.28) return { input: inputOf({ [forward]: true, light: true } as Partial<InputFrame>), frames: 6 };
    if (roll < 0.44) return { input: inputOf({ [forward]: true, heavy: true } as Partial<InputFrame>), frames: 6 };
    if (roll < 0.56 && brain.level >= 1) return { input: inputOf({ up: true, [forward]: true } as Partial<InputFrame>), frames: 8 };
    if (roll < 0.86) return { input: inputOf({ [forward]: true } as Partial<InputFrame>), frames: 10 };
    return { input: inputOf({ [back]: true } as Partial<InputFrame>), frames: 8 };
  }

  // 7) 离得远：走过去（轻松档偶尔发呆）
  if (brain.level === 0 && r() < 0.25) return { input: neutralInput(), frames: 14 };
  return { input: inputOf({ [forward]: true } as Partial<InputFrame>), frames: 12 };
}

/** 这个角色的对空招在哪个槽（带上挑的那一个，没有就返回 null） */
export function antiAirSlot(f: FighterState): MoveSlot | null {
  const ch = characterById(f.charId);
  for (const slot of ["s2", "s3", "s1"] as MoveSlot[]) {
    if (ch.moves[slot].launch > 0 && !ch.moves[slot].airOnly) return slot;
  }
  return null;
}

/**
 * 拿这一帧 AI 要按的键。
 * 反应延迟就体现在这儿：`holdLeft` 没到 0 之前一直照旧主意做，不会每帧都"看穿"你。
 */
export function aiInput(brain: AiBrain, state: MatchState, side: 0 | 1): InputFrame {
  if (brain.holdLeft > 0) {
    brain.holdLeft--;
    return brain.hold;
  }
  const plan = planFor(brain, state, side);
  brain.hold = plan.input;
  brain.holdLeft = Math.max(1, Math.round(plan.frames * (AI_REACTION[brain.level] / AI_REACTION[1]))) - 1;
  return brain.hold;
}

/** 每回合开始重置一次（超必杀次数之类的会话状态） */
export function resetBrain(brain: AiBrain): void {
  brain.hold = neutralInput();
  brain.holdLeft = 0;
  brain.supersUsed = 0;
}
