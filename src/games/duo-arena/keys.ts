/**
 * 朵星擂台 · 双人键位与触屏控件的翻译层。
 *
 * 1.1 的擂台只能用手指点,键盘一个键都不认,这一版按平台约定补齐两套键位:
 *  · 朵朵(1P):`W A S D` 走位 + `F` 出手 + `G` 技能
 *  · 星星(2P):`↑ ← ↓ →` 走位 + `L` 出手 + `K` 技能
 *  · `Esc`:暂停(两个人共用)
 *
 * 两张表零交集(`keys.test.ts` 一直盯着这条),所以同屏两个人各按各的,谁也抢不走谁的键。
 * 手机没有键盘,每个半场自带一套摇杆 + 两个动作钮,按钮按下 / 抬起对应键盘的按下 / 松开,
 * 语义完全等价。
 */

export type Seat = 0 | 1;

/** 一次操作:四个方向是持续按住的走位,出手与技能是按一下触发 */
export type Action = "up" | "down" | "left" | "right" | "grab" | "skill";

/** 按住才生效的方向键 */
export const MOVE_ACTIONS: readonly Action[] = ["up", "down", "left", "right"];

/** 按一下触发一次的动作键 */
export const TAP_ACTIONS: readonly Action[] = ["grab", "skill"];

export const P1_KEYS: Readonly<Record<string, Action>> = {
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  KeyF: "grab",
  KeyG: "skill",
};

export const P2_KEYS: Readonly<Record<string, Action>> = {
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
  KeyL: "grab",
  KeyK: "skill",
};

export function keyMap(seat: Seat): Readonly<Record<string, Action>> {
  return seat === 0 ? P1_KEYS : P2_KEYS;
}

/** 这个键归擂台管吗(管的才 preventDefault,别的键留给页面) */
export function isWatchedKey(code: string): boolean {
  return code in P1_KEYS || code in P2_KEYS;
}

/** 一个键属于谁、要做什么;两张表零交集,所以只会查到一个结果 */
export function resolveKey(code: string): { seat: Seat; action: Action } | null {
  const a1 = P1_KEYS[code];
  if (a1) return { seat: 0, action: a1 };
  const a2 = P2_KEYS[code];
  if (a2) return { seat: 1, action: a2 };
  return null;
}

/** 暂停键(Esc);壳层也听 Esc,擂台接住之后要 preventDefault 让壳层让路 */
export function isPauseKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

/** 当前按住的方向集合 */
export type HeldKeys = Readonly<Partial<Record<Action, boolean>>>;

/**
 * 把「按住了哪几个方向」翻译成一个长度 ≤ 1 的走位向量。
 * 斜着走会归一化,不会比直着走更快(这是老对战游戏最常见的漏洞)。
 * 左右同时按 / 上下同时按会互相抵消,不会抽搐。
 */
export function moveVector(held: HeldKeys): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (held.left) x -= 1;
  if (held.right) x += 1;
  if (held.up) y -= 1;
  if (held.down) y += 1;
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** 触屏热区下限(px);比这小的按钮小朋友按不准 */
export const TOUCH_HIT_PX = 44;

/** 手机上一个半场的控件布局:摇杆在左半边,两个动作钮在右半边,互不重叠 */
export interface PadLayout {
  /** 摇杆中心相对本半场的位置(0..1) */
  stick: { x: number; y: number };
  /** 出手钮中心 */
  grab: { x: number; y: number };
  /** 技能钮中心 */
  skill: { x: number; y: number };
}

export const PAD_LAYOUT: Readonly<PadLayout> = {
  stick: { x: 0.16, y: 0.74 },
  grab: { x: 0.78, y: 0.82 },
  skill: { x: 0.92, y: 0.62 },
};

/** 两个控件圆心之间至少要隔开多少(按热区直径算),小于这个数就会误触 */
export function padSpacingPx(a: { x: number; y: number }, b: { x: number; y: number }, widthPx: number, heightPx: number): number {
  return Math.hypot((a.x - b.x) * widthPx, (a.y - b.y) * heightPx);
}
