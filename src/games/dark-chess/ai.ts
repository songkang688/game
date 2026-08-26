/**
 * 翻翻暗棋 · 四档电脑对手。
 *
 * 菜鸟随便点；普通能吃就吃；高手会躲开会被吃的位置、会留着炮；
 * 地狱额外算「翻这一格的期望收益」——盖着的子还剩什么，它是记着的。
 */
import { RANK, rand01, type Color, type Kind } from "./board";
import {
  applyAction,
  canCapture,
  cloneState,
  coveredCount,
  legalActions,
  movesFrom,
  other,
  otherColor,
  remainingUnknown,
  type Action,
  type GameState,
  type Side,
} from "./rules";

export type Tier = "rookie" | "normal" | "pro" | "hell";

export const TIERS: readonly Tier[] = ["rookie", "normal", "pro", "hell"];

export const TIER_LABELS: Record<Tier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱",
};

/** 兵种价值：兵便宜、将最贵，但兵能请将休息所以也不算太便宜 */
export const VALUE: Record<Kind, number> = {
  general: 60,
  guard: 22,
  elephant: 16,
  chariot: 12,
  horse: 9,
  cannon: 14,
  soldier: 8,
};

/** 翻开一格的期望价值：拿还盖着的子做平均 */
export function flipExpectation(state: GameState, side: Side): number {
  const mine = state.colors[side];
  const left = remainingUnknown(state);
  let sum = 0;
  let n = 0;
  for (const color of ["red", "blue"] as Color[]) {
    for (const kind of Object.keys(left[color]) as Kind[]) {
      const c = left[color][kind];
      if (c <= 0) continue;
      // 翻到自己的子是赚，翻到对方的子等于白送对方一个目标
      const gain = mine === null ? VALUE[kind] * 0.3 : color === mine ? VALUE[kind] * 0.55 : -VALUE[kind] * 0.35;
      sum += gain * c;
      n += c;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** 这一格落子之后，会不会马上被对方吃掉 */
export function hangsAt(state: GameState, at: number, side: Side): number {
  const foe = state.colors[other(side)];
  if (!foe) return 0;
  const me = state.cells[at];
  if (!me) return 0;
  let worst = 0;
  for (let i = 0; i < state.cells.length; i++) {
    const c = state.cells[i];
    if (!c || c.covered || c.color !== foe) continue;
    if (!movesFrom(state.cells, i).includes(at)) continue;
    if (c.kind !== "cannon" && !canCapture(c, me)) continue;
    worst = Math.max(worst, VALUE[me.kind]);
  }
  return worst;
}

/** 给一手棋打分：正分好 */
export function scoreAction(state: GameState, side: Side, a: Action, tier: Tier): number {
  const next = cloneState(state);
  let base = 0;
  if (a.type === "flip") {
    base = tier === "hell" ? flipExpectation(state, side) : 1;
    // 局面上自己没有子可动的时候，翻子是唯一的出路，不要因为期望是负数就不翻
    applyAction(next, a);
    if (tier === "rookie" || tier === "normal") return base;
    return base;
  }
  const target = state.cells[a.to];
  if (target) base += VALUE[target.kind] * 2;
  applyAction(next, a);
  if (tier === "rookie") return base;
  if (tier === "normal") return base;

  // 高手起：看看落点会不会被反吃，顺便别把炮随便挪到没有炮架的地方
  const risk = hangsAt(next, a.to, side);
  let score = base - risk * 1.1;
  const moved = next.cells[a.to];
  if (moved && moved.kind === "cannon" && !target) score -= 3;
  if (tier === "hell") {
    const mine = state.colors[side];
    if (mine) {
      // 己方「将」尽量别贴着还盖着的子（说不定就是对方的兵）
      for (let i = 0; i < next.cells.length; i++) {
        const c = next.cells[i];
        if (!c || c.covered || c.color !== mine || c.kind !== "general") continue;
        score -= hangsAt(next, i, side) * 0.6;
      }
      score += (RANK[state.cells[a.from]?.kind ?? "soldier"] <= 2 ? 1.5 : 0) * (coveredCount(state) > 8 ? 1 : 0);
    }
  }
  return score;
}

/** 选一手 */
export function chooseAction(state: GameState, side: Side, tier: Tier, seed: number): Action | null {
  const list = legalActions(state, side);
  if (list.length === 0) return null;
  if (tier === "rookie") return list[Math.floor(rand01(seed, state.plies) * list.length) % list.length];

  let best = list[0];
  let bestScore = -Infinity;
  list.forEach((a, i) => {
    // 同分时用固定 seed 的小抖动打破平局，保证可复现又不至于每盘一模一样
    const s = scoreAction(state, side, a, tier) + rand01(seed, state.plies * 31 + i) * 0.4;
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  });
  return best;
}

export interface DuelResult {
  winner: Side | null;
  plies: number;
}

/** 无头对局：两档 AI 互下一局，用来给「强度单调」写断言 */
export function playDuel(state: GameState, duoTier: Tier, starTier: Tier, seed: number, maxPlies = 240): DuelResult {
  for (let i = 0; i < maxPlies; i++) {
    if (state.winner || state.draw) break;
    const tier = state.turn === "duo" ? duoTier : starTier;
    const a = chooseAction(state, state.turn, tier, seed + i * 17);
    if (!a) break;
    applyAction(state, a);
  }
  return { winner: state.winner, plies: state.plies };
}

export { otherColor };
