// 朵星擂台 —— 纯逻辑：回合制双人抢分的出目标时间表、计分与胜负判定。
// 两名玩家使用同一份时间表（同种子），出什么、什么时候出、出在哪里都一样，绝对公平。

/* ---------------- 种子随机 ---------------- */

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

/* ---------------- 目标与道具 ---------------- */

export type TargetKind = "bloom" | "coin" | "bomb" | "gift";
export type GiftEffect = "plus3" | "freeze" | "double";

export interface SpawnEvent {
  /** 出现时间（秒，回合内） */
  t: number;
  kind: TargetKind;
  /** 礼物盒里装的效果（kind === "gift" 时有效） */
  effect?: GiftEffect;
  /** 相对位置 0..1 */
  x: number;
  y: number;
  /** 存活时长（秒） */
  ttl: number;
}

// 单局要短:一个回合 34 秒,输了立刻还有下一回合,小朋友不会觉得「这局没救了」。
export const ROUND_SECONDS = 34;
export const SUDDEN_SECONDS = 18;
export const ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS = 3;
export const FREEZE_SECONDS = 2.5;
export const DOUBLE_SECONDS = 4;
export const BOMB_STUN_SECONDS = 1;

/** 点中目标得多少分（双倍星光只加倍好东西，炸弹永远扣 2）。 */
export function tapScore(kind: TargetKind, doubled: boolean): number {
  if (kind === "bloom") return doubled ? 2 : 1;
  if (kind === "coin") return doubled ? 4 : 2;
  if (kind === "bomb") return -2;
  return 0; // 礼物本身不给分，效果另算
}

/** 分数不会低于 0。 */
export function applyTap(score: number, kind: TargetKind, doubled: boolean): number {
  return Math.max(0, score + tapScore(kind, doubled));
}

/* ---------------- 出目标时间表 ---------------- */

/**
 * 生成一个回合的出目标时间表。
 * round 从 1 开始：回合越靠后节奏越快、炸弹稍多。
 * 双方共用同一份表 → 完全公平。
 */
export function buildRoundSchedule(
  seed: number,
  round: number,
  durationS: number = ROUND_SECONDS,
): SpawnEvent[] {
  const rng = makeRng(seed);
  const events: SpawnEvent[] = [];
  // 节奏：第 1 回合 ~1.15s 一个，第 3 回合 ~0.8s 一个
  const interval = Math.max(0.7, 1.25 - round * 0.15);
  const bombRate = Math.min(0.18, 0.06 + round * 0.04);
  const giftRate = 0.09;
  const coinRate = 0.2;
  let t = 1.2; // 开场留一点点反应时间
  let lastX = -1;
  let lastY = -1;
  let gifts = 0;
  while (t < durationS - 0.8) {
    const roll = rng();
    let kind: TargetKind;
    if (roll < bombRate) kind = "bomb";
    else if (roll < bombRate + giftRate && gifts < 3) kind = "gift";
    else if (roll < bombRate + giftRate + coinRate) kind = "coin";
    else kind = "bloom";
    if (kind === "gift") gifts++;
    // 位置：避免和上一个目标贴在一起
    let x = 0.08 + rng() * 0.84;
    let y = 0.1 + rng() * 0.8;
    if (lastX >= 0 && Math.hypot(x - lastX, y - lastY) < 0.22) {
      x = 1 - x;
      y = 1 - y;
    }
    lastX = x;
    lastY = y;
    const ttl = Math.max(1.15, 2.0 - round * 0.2) + rng() * 0.5;
    const ev: SpawnEvent = { t, kind, x, y, ttl };
    if (kind === "gift") {
      const g = rng();
      ev.effect = g < 0.34 ? "plus3" : g < 0.67 ? "freeze" : "double";
    }
    events.push(ev);
    t += interval * (0.75 + rng() * 0.5);
  }
  return events;
}

/* ---------------- 回合与比赛胜负 ---------------- */

/** 一个回合的结果：0=玩家1胜 1=玩家2胜 -1=平。 */
export function roundWinner(score1: number, score2: number): 0 | 1 | -1 {
  if (score1 > score2) return 0;
  if (score2 > score1) return 1;
  return -1;
}

export type MatchState =
  | { done: true; winner: 0 | 1 }
  | { done: false; sudden: boolean };

/**
 * 比赛状态：先拿 2 个回合胜就赢；3 个正式回合打完仍不分（含平局回合）
 * 则进入 15 秒决胜回合，直到分出胜负。
 */
export function matchState(results: Array<0 | 1 | -1>): MatchState {
  let w1 = 0;
  let w2 = 0;
  for (const r of results) {
    if (r === 0) w1++;
    else if (r === 1) w2++;
  }
  if (w1 >= ROUNDS_TO_WIN) return { done: true, winner: 0 };
  if (w2 >= ROUNDS_TO_WIN) return { done: true, winner: 1 };
  if (results.length >= MAX_ROUNDS) {
    if (w1 !== w2) return { done: true, winner: w1 > w2 ? 0 : 1 };
    return { done: false, sudden: true };
  }
  return { done: false, sudden: false };
}
