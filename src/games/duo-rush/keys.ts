/**
 * 梨康双人冲刺 · 双人键位与触屏手势。
 *
 * 两套键位分别放在两张表里，**没有任何一个键同时属于两个人**，
 * 所以同屏两个人各按各的，谁也抢不走谁的键（`keys.test.ts` 一直盯着这条）。
 *  · 鸭梨（1P）：`W` 跳 / `A` 左道 / `S` 下滑 / `D` 右道 / `F` 用道具 / `G` 加油
 *  · 康康（2P）：`↑` 跳 / `←` 左道 / `↓` 下滑 / `→` 右道 / `L` 用道具 / `K` 加油
 *  · `Esc`：暂停（两个人共用）
 *
 * 移动四键是 1.1 就定下来的，`P1_KEYS` / `P2_KEYS` 原样不动；
 * 1.2 的道具键与加油键单独放在 `P1_EXTRA_KEYS` / `P2_EXTRA_KEYS`，
 * 合起来查是 `fullKeyMap(seat)`，四张表两两零交集。
 *
 * 手机上没有键盘，就把画面切成两半，各自在自己那半边滑动，
 * 上滑跳、下滑滚、左右滑换道，和键盘完全等价；道具与加油是两颗贴边的圆按钮。
 */

export type Seat = 0 | 1;

/**
 * 一次操作：换到左边那条道 / 右边那条道 / 起跳 / 下滑 /
 * 用掉手上的道具 / 给对手加油（纯打气，不影响成绩）
 */
export type Action = "left" | "right" | "jump" | "slide" | "use" | "cheer";

/** 移动四键（1.1 定的，别改） */
export type MoveAction = "left" | "right" | "jump" | "slide";

export const P1_KEYS: Readonly<Record<string, MoveAction>> = {
  KeyW: "jump",
  KeyA: "left",
  KeyS: "slide",
  KeyD: "right",
};

export const P2_KEYS: Readonly<Record<string, MoveAction>> = {
  ArrowUp: "jump",
  ArrowLeft: "left",
  ArrowDown: "slide",
  ArrowRight: "right",
};

/** 1.2 新增：鸭梨的副键，F 用道具、G 加油 */
export const P1_EXTRA_KEYS: Readonly<Record<string, Action>> = {
  KeyF: "use",
  KeyG: "cheer",
};

/** 1.2 新增：康康的副键，L 用道具、K 加油 */
export const P2_EXTRA_KEYS: Readonly<Record<string, Action>> = {
  KeyL: "use",
  KeyK: "cheer",
};

export function keyMap(seat: Seat): Readonly<Record<string, MoveAction>> {
  return seat === 0 ? P1_KEYS : P2_KEYS;
}

export function extraKeyMap(seat: Seat): Readonly<Record<string, Action>> {
  return seat === 0 ? P1_EXTRA_KEYS : P2_EXTRA_KEYS;
}

/** 一个座位的完整键表（移动四键 + 两个副键） */
export function fullKeyMap(seat: Seat): Readonly<Record<string, Action>> {
  return { ...keyMap(seat), ...extraKeyMap(seat) };
}

/** 这个键归游戏管吗（管的才 preventDefault，别的键留给页面） */
export function isWatchedKey(code: string): boolean {
  return (
    code in P1_KEYS || code in P2_KEYS || code in P1_EXTRA_KEYS || code in P2_EXTRA_KEYS
  );
}

/**
 * 一个键属于谁、要做什么。
 * 四张表两两零交集，所以两人同时按下也各归各的，不会串台。
 */
export function resolveKey(code: string): { seat: Seat; action: Action } | null {
  const a1 = P1_KEYS[code] ?? P1_EXTRA_KEYS[code];
  if (a1) return { seat: 0, action: a1 };
  const a2 = P2_KEYS[code] ?? P2_EXTRA_KEYS[code];
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

/* ---------------- 触屏控件（1.2 新增） ---------------- */

/** 触屏按钮的最小热区：44px 是手指的下限，再小就按不准了 */
export const TOUCH_MIN_PX = 44;
/** 两颗按钮之间至少留这么多空隙，避免误触 */
export const TOUCH_GAP_PX = 8;

export interface PadButton {
  action: Extract<Action, "use" | "cheer">;
  label: string;
  emoji: string;
}

/** 每半屏配两颗圆按钮：用道具、加油 */
export const PAD_BUTTONS: readonly PadButton[] = [
  { action: "use", label: "用道具", emoji: "✨" },
  { action: "cheer", label: "加油", emoji: "📣" },
];

export interface PadRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 一个座位的两颗触屏按钮摆在哪儿：永远贴在**自己那半屏**的内侧下角，
 * 热区固定 `TOUCH_MIN_PX`，两颗之间留 `TOUCH_GAP_PX`，所以既不会互相压，
 * 也不会伸进对方的半屏里（360px 窄屏上照样成立，`keys.test.ts` 会算给你看）。
 */
export function padRects(
  size: { width: number; height: number },
  layout: "column" | "row",
  seat: Seat,
): [PadRect, PadRect] {
  const s = TOUCH_MIN_PX;
  const pane =
    layout === "column"
      ? { x: 0, y: seat === 0 ? 0 : size.height / 2, width: size.width, height: size.height / 2 }
      : { x: seat === 0 ? 0 : size.width / 2, y: 0, width: size.width / 2, height: size.height };
  const y = pane.y + pane.height - s - TOUCH_GAP_PX;
  const right = pane.x + pane.width - s - TOUCH_GAP_PX;
  return [
    { x: right - s - TOUCH_GAP_PX, y, width: s, height: s },
    { x: right, y, width: s, height: s },
  ];
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
