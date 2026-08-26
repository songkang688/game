/**
 * 朵朵大战星星 · 双人键位。
 *
 * 两套键位分别放在两张表里，**没有任何一个键同时属于两个人**，
 * 所以同屏两个人各按各的，谁也抢不走谁的键（`keys.test.ts` 会一直盯着这条）。
 *  · 朵朵（1P）：W A S D 走动 + F 挥击 + G 重击
 *  · 星星（2P）：↑ ← ↓ → 走动 + L 挥击 + K 重击
 *  · Esc：暂停（两个人共用）
 */
import { emptyInput, type Input } from "./ai";

export type Seat = "p1" | "p2";

/** 朵朵：WASD + F（挥击）/ G（重击） */
export const P1_KEYS: Readonly<Record<string, keyof Input>> = {
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  KeyF: "light",
  KeyG: "heavy",
};

/** 星星：方向键 + L（挥击）/ K（重击） */
export const P2_KEYS: Readonly<Record<string, keyof Input>> = {
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
  KeyL: "light",
  KeyK: "heavy",
};

export function keyMap(seat: Seat): Readonly<Record<string, keyof Input>> {
  return seat === "p1" ? P1_KEYS : P2_KEYS;
}

/** 这个键归游戏管吗（管的才 preventDefault，别的键留给页面） */
export function isWatchedKey(code: string): boolean {
  return code in P1_KEYS || code in P2_KEYS;
}

/**
 * 把「现在按着哪些键」翻译成某个座位的操作。
 * 只看自己那张表，别人的键一个都不认，所以两套键位天然互不抢占。
 * `pad` 是触屏按键按下的状态，和键盘取并集（两种操作方式完全等价）。
 */
export function readKeys(pressed: ReadonlySet<string>, seat: Seat, pad?: Input): Input {
  const out: Input = pad ? { ...pad } : emptyInput();
  const map = keyMap(seat);
  for (const code of pressed) {
    const key = map[code];
    if (key) out[key] = true;
  }
  return out;
}

/** 暂停键（Esc）；壳层也监听 Esc，游戏接住之后要 preventDefault 让壳层让路 */
export function isPauseKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}
