/**
 * 音乐星星 · 范奏与慢速练习（1.2 新增，纯函数）。
 *
 * 想法很朴素：跟不上就先慢下来，慢下来一定能弹对；
 * 但**慢速通关只给一星**，想拿三星必须回到全速——奖励留给真练会的那一次。
 */
import { rateBelow } from "../level99";

/** 可选的练习倍率（1.0 是全速） */
export const SPEEDS: readonly number[] = [0.6, 0.8, 1.0];

/** 全速 */
export const FULL_SPEED = 1;

/** 倍率对应的按钮文字 */
export function speedLabel(speed: number): string {
  if (speed >= FULL_SPEED) return "全速";
  return `${speed.toFixed(1)} 倍慢速`;
}

/** 把任意输入夹成一个合法的倍率（不在表里就选最接近的） */
export function clampSpeed(speed: unknown): number {
  const n = typeof speed === "number" ? speed : Number(speed);
  if (!Number.isFinite(n)) return FULL_SPEED;
  let best = SPEEDS[SPEEDS.length - 1];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const s of SPEEDS) {
    const gap = Math.abs(s - n);
    if (gap < bestGap) {
      best = s;
      bestGap = gap;
    }
  }
  return best;
}

/** 慢速时时长要拉长：0.6 倍速 = 时长除以 0.6 */
export function scaleMs(ms: number, speed: number): number {
  const s = clampSpeed(speed);
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / s);
}

/** 这个倍率下最多能拿几星：慢速封顶 1 星，全速才放开到 3 星 */
export function starCap(speed: number): 1 | 3 {
  return clampSpeed(speed) >= FULL_SPEED ? 3 : 1;
}

/**
 * 本关最终星级：全速按失误数评（0 次 3 星、≤2 次 2 星、再多 1 星），
 * 慢速一律 1 星。
 */
export function rateWithSpeed(misses: number, speed: number): 1 | 2 | 3 {
  const cap = starCap(speed);
  const got = rateBelow(misses, 0, 2);
  return Math.min(cap, got) as 1 | 2 | 3;
}

/** 慢速过关时给孩子的说法：不批评，只把「再来一次全速」讲清楚 */
export function speedHint(speed: number): string {
  return clampSpeed(speed) >= FULL_SPEED
    ? "全速弹下来的，三颗星实实在在。"
    : "慢速先练熟是聪明做法，回到全速再弹一遍就能拿满星。";
}

/** 哪些章节不给范奏：简谱视奏台本来就是照谱直接弹 */
export function allowsDemo(mode: string | undefined): boolean {
  return mode !== "score";
}
