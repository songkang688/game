/**
 * 梨康格斗王 —— 人机对手。
 *
 * **五档**，从轻松一路到高手。五档的差别是「会做哪几件事」，不是"数值外挂"：
 *
 * | 档 | 名字 | 新学会的本事 |
 * | --- | --- | --- |
 * | 0 | 轻松 | 只会走过去打两下，几乎不格挡，从来不跳 |
 * | 1 | 普通 | 会格挡、会还手，反应比你慢一点点 |
 * | 2 | 灵巧 | **会跳会投**：中距离跳进来压，贴身找机会转圈摔 |
 * | 3 | 老练 | **会防反**：挡住之后盯着你的收招，硬直一解除立刻回敬 |
 * | 4 | 高手 | 前面全部 + 反应最快 + 会留能量放超必杀 |
 *
 * 三根一直在起作用的绳子：
 *  1. **反应延迟**：AI 不是每帧重新想，而是隔一段才重新看一眼场上，中间照着旧主意做。
 *     轻松档看一眼要 26 帧（快半秒），高手档只要 7 帧。
 *  2. **会不会防**：看到对手起手时按后退键的概率，最高档也只有 0.9，不是 1。
 *  3. **反打窗口**：每隔一段时间，AI 必定空出一小段"什么都不做、也不挡"的时间。
 *     档位越高窗口越短，但**永远存在** —— 孩子一定抓得到翻盘的机会。
 *
 * 这一款最高档的定位是「稳定压制次高档，但留得住反打窗口」。
 * 更深一个数量级的读心与择路是另一款格斗游戏的活，这里不做。
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

/** 0 = 轻松，1 = 普通，2 = 灵巧（会跳会投），3 = 老练（会防反），4 = 高手 */
export type AiLevel = 0 | 1 | 2 | 3 | 4;

/** 全部档位，按从弱到强的顺序 */
export const AI_LEVELS: AiLevel[] = [0, 1, 2, 3, 4];

export const AI_LABELS: Record<AiLevel, string> = {
  0: "轻松",
  1: "普通",
  2: "灵巧",
  3: "老练",
  4: "高手"
};

export const AI_HINTS: Record<AiLevel, string> = {
  0: "反应慢半拍，几乎不格挡，也从来不跳，适合第一次上手",
  1: "会格挡也会还手，反应比你慢一点点",
  2: "会跳进来压，也会贴身找机会转圈摔，站着不动会很难受",
  3: "会防反：挡住你之后盯着收招，硬直一解除立刻回敬一下",
  4: "反应最快，会防会反击还会留能量放超必杀；不过它每隔一会儿总要喘口气"
};

/** 每一档"重新看一眼场上"要隔多少帧 —— 这就是反应延迟 */
export const AI_REACTION: Record<AiLevel, number> = { 0: 26, 1: 18, 2: 13, 3: 10, 4: 7 };
/** 看到对手起手时去格挡的概率（最高档也不到 1，永远赌得赢一半） */
export const AI_GUARD_CHANCE: Record<AiLevel, number> = { 0: 0.18, 1: 0.5, 2: 0.62, 3: 0.82, 4: 0.9 };
/** 抓住对手收招时反击的概率 */
export const AI_PUNISH_CHANCE: Record<AiLevel, number> = { 0: 0, 1: 0.3, 2: 0.5, 3: 0.78, 4: 0.88 };
/** 主动进攻的积极度 */
export const AI_AGGRESSION: Record<AiLevel, number> = { 0: 0.35, 1: 0.55, 2: 0.74, 3: 0.72, 4: 0.85 };
/** 中距离跳进来压的概率：轻松档恒为 0（它这辈子不跳），灵巧档最爱跳 */
export const AI_JUMP_CHANCE: Record<AiLevel, number> = { 0: 0, 1: 0.08, 2: 0.34, 3: 0.2, 4: 0.26 };
/** 贴身时改用转圈摔的概率：灵巧档起才真的会用投技 */
export const AI_THROW_CHANCE: Record<AiLevel, number> = { 0: 0.04, 1: 0.08, 2: 0.34, 3: 0.22, 4: 0.28 };

/**
 * 反打窗口：每隔 `AI_OPENING_PERIOD` 帧，AI 会空出 `AI_OPENING_FRAMES` 帧
 * 什么都不做、也不格挡的时间。这不是 bug，是本款最高档的设计上限 ——
 * 孩子每隔几秒一定拿得到一个能打进去的空档。
 */
export const AI_OPENING_PERIOD: Record<AiLevel, number> = { 0: 90, 1: 120, 2: 150, 3: 180, 4: 200 };
export const AI_OPENING_FRAMES: Record<AiLevel, number> = { 0: 40, 1: 34, 2: 30, 3: 26, 4: 22 };

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
  /** 活了多少帧（反打窗口按它排班） */
  tick: number;
}

export function createBrain(level: AiLevel, seed: number): AiBrain {
  return { level, rand: mulberry32(seed || 1), hold: neutralInput(), holdLeft: 0, supersUsed: 0, tick: 0 };
}

/**
 * 现在正处在反打窗口里吗（纯函数，单测直接盯它）。
 * 窗口排在每个周期的**末尾**：一上来先老老实实打，喘气排在后面。
 */
export function inOpening(level: AiLevel, tick: number): boolean {
  const period = AI_OPENING_PERIOD[level];
  const width = AI_OPENING_FRAMES[level];
  if (period <= 0 || width <= 0) return false;
  return ((tick % period) + period) % period >= period - width;
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
  const lv = brain.level;
  const close = gap <= 40;
  const mid = gap <= 110;

  // 倒地了：窗口里按轻击受身（高档更会受身）
  if (me.phase === "knockdown") {
    const techChance = 0.25 + lv * 0.18;
    return { input: r() < techChance ? inputOf({ light: true }) : neutralInput(), frames: 4 };
  }

  // 挡住了：老练档起会盯着对手的收招，硬直一解除立刻回敬（这就是"防反"）
  if (me.phase === "blockstun" && lv >= 3) {
    const worthIt = foeIsPunishable(foe) || foePhaseNow(foe) === "recovery";
    if (worthIt && gap <= 56 && r() < AI_PUNISH_CHANCE[lv]) {
      // 用起手最快的轻击去抢，抢到了再顺势连
      return { input: inputOf({ light: true }), frames: 6 };
    }
    return { input: inputOf({ [back]: true } as Partial<InputFrame>), frames: 4 };
  }

  if (!isFree(me)) {
    // 被弹开 / 收招中：老练档以上会提前把后退键按住，落地立刻是格挡姿势
    const early = lv >= 3 && r() < 0.7;
    return { input: early ? inputOf({ [back]: true } as Partial<InputFrame>) : neutralInput(), frames: 3 };
  }

  const foePh = foePhaseNow(foe);

  // 1) 对手在够得着的距离起手 → 格挡（蹲挡还是站挡也要猜一猜）
  //    离得老远就不用缩了，站那儿举手挡空气看着挺傻的
  if (mid && (foePh === "startup" || foePh === "active")) {
    if (r() < AI_GUARD_CHANCE[lv]) {
      const crouch = r() < 0.5;
      return { input: inputOf({ [back]: true, down: crouch } as Partial<InputFrame>), frames: 6 };
    }
  }

  // 2) 对手收招露空档 → 反击（普通档以上才会）
  if (foeIsPunishable(foe) && close && r() < AI_PUNISH_CHANCE[lv]) {
    if (superReady(me) && brain.supersUsed < 2 && lv >= 3 && r() < 0.5) {
      brain.supersUsed++;
      return { input: inputOf({ down: true, light: true, heavy: true }), frames: 5 };
    }
    return { input: inputOf({ heavy: true }), frames: 5 };
  }

  // 3) 对手跳到头顶 → 对空（用带上挑的必杀，也就是 s2 / s3 里那一招）
  if (foe.airborne && foe.y > 20 && close && lv >= 1 && r() < 0.4 + lv * 0.08) {
    const antiAir = antiAirSlot(me);
    if (antiAir === "s2") return { input: inputOf({ [forward]: true, heavy: true } as Partial<InputFrame>), frames: 5 };
    if (antiAir === "s3") return { input: inputOf({ [back]: true, heavy: true } as Partial<InputFrame>), frames: 5 };
    return { input: inputOf({ heavy: true }), frames: 5 };
  }

  // 4) 能量满了就找机会放超必杀（档位越高越会挑时机）
  if (superReady(me) && close && r() < 0.24 + lv * 0.09) {
    brain.supersUsed++;
    return { input: inputOf({ down: true, light: true, heavy: true }), frames: 5 };
  }

  // 5) 贴身了就打；灵巧档起先想一想要不要改成转圈摔
  if (close) {
    // 对手缩着不动（在格挡或者蹲着）的时候，摔是唯一的解法
    const turtling = foe.blocking || foe.crouching;
    if (r() < AI_THROW_CHANCE[lv] * (turtling ? 1.6 : 1)) {
      return { input: inputOf({ light: true, heavy: true }), frames: 6 };
    }
    const roll = r();
    const aggression = AI_AGGRESSION[lv];
    if (roll < aggression * 0.42) return { input: inputOf({ light: true }), frames: 4 };
    if (roll < aggression * 0.68) return { input: inputOf({ down: true, light: true }), frames: 4 };
    if (roll < aggression * 0.84) return { input: inputOf({ heavy: true }), frames: 6 };
    if (roll < aggression * 0.92) return { input: inputOf({ down: true, heavy: true }), frames: 6 };
    if (roll < aggression) return { input: inputOf({ [forward]: true, light: true } as Partial<InputFrame>), frames: 6 };
    return { input: inputOf({ [back]: true } as Partial<InputFrame>), frames: 8 };
  }

  // 6) 中距离：跳进来压、放必杀骚扰，或者压上去
  if (mid) {
    if (r() < AI_JUMP_CHANCE[lv]) {
      return { input: inputOf({ up: true, [forward]: true } as Partial<InputFrame>), frames: 8 };
    }
    const roll = r();
    if (roll < 0.28) return { input: inputOf({ [forward]: true, light: true } as Partial<InputFrame>), frames: 6 };
    if (roll < 0.44) return { input: inputOf({ [forward]: true, heavy: true } as Partial<InputFrame>), frames: 6 };
    if (roll < 0.86) return { input: inputOf({ [forward]: true } as Partial<InputFrame>), frames: 10 };
    return { input: inputOf({ [back]: true } as Partial<InputFrame>), frames: 8 };
  }

  // 7) 离得远：走过去（轻松档偶尔发呆；灵巧档会跳着过来）
  if (lv === 0 && r() < 0.25) return { input: neutralInput(), frames: 14 };
  if (r() < AI_JUMP_CHANCE[lv] * 0.5) {
    return { input: inputOf({ up: true, [forward]: true } as Partial<InputFrame>), frames: 10 };
  }
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
 * 反打窗口的优先级比旧主意还高：窗口一到，手上按着的键立刻全松开。
 */
export function aiInput(brain: AiBrain, state: MatchState, side: 0 | 1): InputFrame {
  brain.tick++;
  if (inOpening(brain.level, brain.tick)) {
    brain.hold = neutralInput();
    brain.holdLeft = 0;
    return brain.hold;
  }
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
  brain.tick = 0;
}
