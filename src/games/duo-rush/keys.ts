/**
 * 朵星双人冲刺 · 双人键位与触屏手势。
 *
 * 两套键位分别放在两张表里，**没有任何一个键同时属于两个人**，
 * 所以同屏两个人各按各的，谁也抢不走谁的键（`keys.test.ts` 一直盯着这条）。
 *  · 朵朵（1P）：`W` 跳 / `A` 左道 / `S` 下滑 / `D` 右道
 *  · 星星（2P）：`↑` 跳 / `←` 左道 / `↓` 下滑 / `→` 右道
 *  · `Esc`：暂停（两个人共用）
 *
 * 手机上没有键盘，就把画面切成两半，各自在自己那半边滑动，
 * 上滑跳、下滑滚、左右滑换道，和键盘完全等价。
 */

export type Seat = 0 | 1;

/** 一次操作：换到左边那条道 / 右边那条道 / 起跳 / 下滑 */
export type Action = "left" | "right" | "jump" | "slide";

export const P1_KEYS: Readonly<Record<string, Action>> = {
  KeyW: "jump",
  KeyA: "left",
  KeyS: "slide",
  KeyD: "right",
};

export const P2_KEYS: Readonly<Record<string, Action>> = {
  ArrowUp: "jump",
  ArrowLeft: "left",
  ArrowDown: "slide",
  ArrowRight: "right",
};

export function keyMap(seat: Seat): Readonly<Record<string, Action>> {
  return seat === 0 ? P1_KEYS : P2_KEYS;
}

/** 这个键归游戏管吗（管的才 preventDefault，别的键留给页面） */
export function isWatchedKey(code: string): boolean {
  return code in P1_KEYS || code in P2_KEYS;
}

/**
 * 一个键属于谁、要做什么。
 * 只查一张表就能查到，两张表零交集，所以两人同时按下也各归各的，不会串台。
 */
export function resolveKey(code: string): { seat: Seat; action: Action } | null {
  const a1 = P1_KEYS[code];
  if (a1) return { seat: 0, action: a1 };
  const a2 = P2_KEYS[code];
  if (a2) return { seat: 1, action: a2 };
  return null;
}

/** 暂停键（Esc）；壳层也监听 Esc，游戏接住之后要 preventDefault 让壳层让路 */
export function isPauseKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

/** 滑动多少像素才算数（太短的当成手抖，不触发） */
export const SWIPE_MIN_PX = 22;

/** 把一次滑动翻译成操作；横竖谁的位移大就听谁的。 */
export function swipeAction(dx: number, dy: number, minPx: number = SWIPE_MIN_PX): Action | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < minPx && ay < minPx) return null;
  if (ax >= ay) return dx < 0 ? "left" : "right";
  return dy < 0 ? "jump" : "slide";
}

/**
 * 手指落在哪半边就算谁的。
 * 上下分屏按 y 切，左右分屏按 x 切，和画面上的分屏方向永远一致。
 */
export function seatAtPoint(
  x: number,
  y: number,
  size: { width: number; height: number },
  layout: "column" | "row",
): Seat {
  if (layout === "column") return y < size.height / 2 ? 0 : 1;
  return x < size.width / 2 ? 0 : 1;
}
