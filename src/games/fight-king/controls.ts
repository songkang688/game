/**
 * 朵星格斗王 —— 键位表与输入换算（纯函数，不碰 DOM）。
 *
 * 两位玩家的键位必须完全不重叠，否则同屏对战会互相抢键；
 * 这件事由 `controls.test.ts` 钉死，谁改键位都会当场被测试拦下来。
 */
import { inputOf, type InputFrame } from "./engine";

export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  light: string;
  heavy: string;
}

/** 朵朵（1 号位）：WASD 走位，F 轻击、G 重击 */
export const P1_KEYS: KeyMap = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  light: "KeyF",
  heavy: "KeyG"
};

/** 星星（2 号位）：方向键走位，L 轻击、K 重击 */
export const P2_KEYS: KeyMap = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  light: "KeyL",
  heavy: "KeyK"
};

export const KEY_MAPS: [KeyMap, KeyMap] = [P1_KEYS, P2_KEYS];

/** 暂停键 */
export const PAUSE_KEY = "Escape";

/** 某个键位表里全部按键 */
export function keysOf(map: KeyMap): string[] {
  return [map.up, map.down, map.left, map.right, map.light, map.heavy];
}

/** 两套键位有没有重叠（返回重叠的键，空数组表示互不抢占） */
export function overlappingKeys(a: KeyMap, b: KeyMap): string[] {
  const setB = new Set(keysOf(b));
  return keysOf(a).filter((k) => setB.has(k));
}

/** 这个键归游戏管吗（归游戏管的要 preventDefault，免得方向键把页面滚跑） */
export function isGameKey(code: string): boolean {
  return keysOf(P1_KEYS).includes(code) || keysOf(P2_KEYS).includes(code) || code === PAUSE_KEY;
}

/** 从"当前按住的键"集合里读出一位玩家这一帧的输入 */
export function readKeys(pressed: ReadonlySet<string>, map: KeyMap): InputFrame {
  return {
    up: pressed.has(map.up),
    down: pressed.has(map.down),
    left: pressed.has(map.left),
    right: pressed.has(map.right),
    light: pressed.has(map.light),
    heavy: pressed.has(map.heavy)
  };
}

/** 两个输入求并集（键盘 + 触屏一起用时合并） */
export function mergeInput(a: InputFrame, b: InputFrame): InputFrame {
  return {
    up: a.up || b.up,
    down: a.down || b.down,
    left: a.left || b.left,
    right: a.right || b.right,
    light: a.light || b.light,
    heavy: a.heavy || b.heavy
  };
}

/** 同时按住左右等于没按（免得摇杆抖动时角色原地发抖） */
export function normalizeInput(i: InputFrame): InputFrame {
  const bothX = i.left && i.right;
  return { ...i, left: bothX ? false : i.left, right: bothX ? false : i.right };
}

/** 虚拟摇杆死区：摸得太轻不算方向 */
export const STICK_DEADZONE = 16;

/**
 * 虚拟摇杆：手指相对摇杆中心的偏移 → 方向键。
 * 上下和左右可以同时成立（斜着推就是"跳着往前"）。
 */
export function stickDirection(dx: number, dy: number, deadzone = STICK_DEADZONE): InputFrame {
  const out = inputOf({});
  if (Math.abs(dx) > deadzone) {
    if (dx > 0) out.right = true;
    else out.left = true;
  }
  if (Math.abs(dy) > deadzone) {
    // 屏幕坐标 y 向下为正：手指往上推是 dy 为负
    if (dy < 0) out.up = true;
    else out.down = true;
  }
  return out;
}

/** 触屏时 1 号位在左半屏、2 号位在右半屏 */
export function sideOfTouch(clientX: number, viewportWidth: number): 0 | 1 {
  return clientX < viewportWidth / 2 ? 0 : 1;
}

/** 键位说明文案（帮助面板与训练模式共用） */
export function keyHintLines(): string[] {
  return [
    "🌸 朵朵：W 跳 / A 左 / S 蹲 / D 右，F 轻击、G 重击",
    "⭐ 星星：方向键走位，L 轻击、K 重击",
    "前 + 轻击 = 必杀一，前 + 重击 = 必杀二，后 + 重击 = 必杀三",
    "轻击 + 重击 一起按 = 抱抱摔；蹲下 + 轻击 + 重击 = 超必杀（要满槽）",
    "按住「远离对手」的方向键就是格挡；蹲着挡下段，站着挡上段",
    "倒地那一下按轻击可以受身，Esc 暂停"
  ];
}
