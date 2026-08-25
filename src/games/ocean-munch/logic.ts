// 海底大胃王 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export const START_RADIUS = 14;
export const TARGET_RADIUS = 48;

/** 两个圆是否碰到(factor 越小越宽容)。 */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  factor = 0.78,
): boolean {
  return Math.hypot(x2 - x1, y2 - y1) < (r1 + r2) * factor;
}

/** 我方半径明显更大才能吃掉对方。 */
export function canEat(playerR: number, otherR: number): boolean {
  return playerR >= otherR * 1.08;
}

/** 对方明显更大才有危险;差不多大就只是互相碰碰。 */
export function isDanger(playerR: number, otherR: number): boolean {
  return otherR >= playerR * 1.12;
}

/** 吃掉一条鱼后长大,封顶到目标大小。 */
export function grow(r: number, eatenR: number, target = TARGET_RADIUS): number {
  return Math.min(target, r + Math.max(1.1, eatenR * 0.18));
}

/** roll ∈ [0,1) → 新鱼半径:大多数比玩家小,少数更大。 */
export function spawnRadius(playerR: number, roll: number): number {
  if (roll < 0.66) {
    const t = roll / 0.66;
    return Math.max(6, playerR * (0.35 + 0.5 * t));
  }
  const t = (roll - 0.66) / 0.34;
  return Math.min(64, playerR * (1.2 + 0.7 * t));
}

export function starsForTime(seconds: number): 1 | 2 | 3 {
  if (seconds <= 45) return 3;
  if (seconds <= 75) return 2;
  return 1;
}
