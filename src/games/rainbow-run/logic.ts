// 彩虹跑跑 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export type SwipeDir = "left" | "right" | "up" | "down";

/** 根据滑动位移判断方向;太短就不算滑动。 */
export function detectSwipe(dx: number, dy: number, minDist = 24): SwipeDir | null {
  if (Math.hypot(dx, dy) < minDist) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type ObstacleKind = "rock" | "hurdle" | "bar";
export type PlayerAction = "run" | "jump" | "slide";

/** 同一车道相遇时会不会撞上:跳过小栅栏、趴过彩虹杆,大软糖只能换道。 */
export function wouldHit(kind: ObstacleKind, action: PlayerAction): boolean {
  if (kind === "hurdle") return action !== "jump";
  if (kind === "bar") return action !== "slide";
  return true;
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(2, lane));
}

export function starsForHearts(hearts: number): 1 | 2 | 3 {
  if (hearts >= 3) return 3;
  if (hearts === 2) return 2;
  return 1;
}

export const RUN_SECONDS = 60;
export const MAX_HEARTS = 3;
