/**
 * 飞行棋乐园 · 骰子与起飞 / 连掷规则（纯函数）。
 *
 * 骰子必须可种子化:关卡靠固定骰序保证「这一关一定有解」，
 * 对局与无尽也用种子，回放同一局才能复现同一串点数。
 */

/** 连续掷出几个 6 就要罚:第 3 个 6 取消这一次移动并跳过 */
export const SIX_STREAK_LIMIT = 3;

/** 骰面（1..6） */
export const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export interface Rules {
  /** 掷到这些点数可以从基地起飞 */
  takeOff: number[];
  /** 掷 6 之后可以再掷一次 */
  extraOnSix: boolean;
  /** 连续三个 6 取消这一次移动 */
  punishThreeSixes: boolean;
  /** 本色格向前跳 4 格 */
  allowJump: boolean;
  /** 虚线航线 */
  allowAirline: boolean;
  /** 叠子会挡住敌机 */
  allowStackBlock: boolean;
}

/** 传统规则:只有 6 能起飞 */
export const CLASSIC_RULES: Rules = {
  takeOff: [6],
  extraOnSix: true,
  punishThreeSixes: true,
  allowJump: true,
  allowAirline: true,
  allowStackBlock: true
};

/** 改进规则:5 或 6 都能起飞，掷 5 起飞之后不再掷 */
export const IMPROVED_RULES: Rules = { ...CLASSIC_RULES, takeOff: [5, 6] };

/** 复制一份规则再改几项，绝不改到常量本身 */
export function withRules(base: Rules, patch: Partial<Rules>): Rules {
  return { ...base, ...patch, takeOff: patch.takeOff ? [...patch.takeOff] : [...base.takeOff] };
}

/**
 * 可种子化的骰子:同一个 (seed, index) 永远给同一个点数。
 * 用的是 mulberry32 的整数搅拌，没有任何全局状态。
 */
export function roll(seed: number, index: number): number {
  let a = (Math.imul(seed >>> 0, 0x9e3779b1) + Math.imul(index >>> 0, 0x85ebca6b)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) % 6 + 1;
}

/** 取一整串骰子点数（关卡骰序、回放都用它） */
export function rollSeq(seed: number, count: number, from = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(roll(seed, from + i));
  return out;
}

/** 这个点数能不能起飞 */
export function canTakeOff(dice: number, rules: Rules): boolean {
  return rules.takeOff.includes(dice);
}

/** 起飞之后还能不能再掷一次:掷 6 起飞可以再掷，掷 5 起飞就不再掷 */
export function takeOffGrantsExtra(dice: number, rules: Rules): boolean {
  return dice === 6 && rules.extraOnSix;
}

export interface StreakResult {
  /** 还能再掷一次 */
  again: boolean;
  /** 这一次移动作废（连续三个 6 的处罚） */
  cancel: boolean;
  /** 更新后的连 6 计数 */
  streak: number;
}

/**
 * 连掷判定:掷到 6 可以再掷，但连续第 3 个 6 反而要取消这一次移动并跳过。
 * 规则只有这一套，`SIX_STREAK_LIMIT` 是唯一的取值来源。
 */
export function extraRoll(dice: number, streak: number, rules: Rules = CLASSIC_RULES): StreakResult {
  if (dice !== 6) return { again: false, cancel: false, streak: 0 };
  const next = streak + 1;
  if (rules.punishThreeSixes && next >= SIX_STREAK_LIMIT) {
    return { again: false, cancel: true, streak: 0 };
  }
  return { again: rules.extraOnSix, cancel: false, streak: next };
}

/** 骰子转几圈的中间点数（动画用，`prefers-reduced-motion` 下少转几圈但仍旧要转） */
export function spinFrames(seed: number, index: number, reduced: boolean): number[] {
  const n = reduced ? 3 : 9;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(roll(seed + 977, index * 16 + i));
  out.push(roll(seed, index));
  return out;
}
