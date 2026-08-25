// 切切乐 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export const TARGET_SCORE = 20;

/** 线段(刀光)是否切到圆(水果)。 */
export function segCircleHit(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  }
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(cx - px, cy - py) <= r;
}

/** 一次挥刀切到 3 个以上有连击奖励分。 */
export function comboBonus(slicedInGesture: number): number {
  return slicedInGesture >= 3 ? slicedInGesture : 0;
}

export function starsForTime(seconds: number): 1 | 2 | 3 {
  if (seconds <= 40) return 3;
  if (seconds <= 65) return 2;
  return 1;
}

/**
 * 由 0..1 的随机数生成一次抛射(纯函数,便于测试)。
 * 返回:起点在屏幕下方,初速度向上、稍微飘向中间。
 */
export function makeLaunch(
  w: number,
  h: number,
  rx: number,
  rvx: number,
  rvy: number,
): { x: number; y: number; vx: number; vy: number } {
  const x = w * (0.2 + 0.6 * rx);
  const vx = (w * 0.5 - x) * 0.6 + (rvx - 0.5) * w * 0.25;
  const vy = -(h * 1.05 + rvy * h * 0.3);
  return { x, y: h + 30, vx, vy };
}

/** 重力加速度(和屏幕高度成正比,保证不同屏幕手感一致)。 */
export function gravityFor(h: number): number {
  return h * 0.9;
}
