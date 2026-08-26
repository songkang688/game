/**
 * 朵星格斗王 —— 键位与触屏摇杆的回归测试。
 *
 * 最重要的一条：**同屏双人的两套键位不许有任何重叠**。
 * 谁以后改键位改重了，这里第一时间红。
 */
import { describe, expect, it } from "vitest";
import {
  KEY_MAPS,
  P1_KEYS,
  P2_KEYS,
  PAUSE_KEY,
  STICK_DEADZONE,
  isGameKey,
  keyHintLines,
  keysOf,
  mergeInput,
  normalizeInput,
  overlappingKeys,
  readKeys,
  sideOfTouch,
  stickDirection
} from "./controls";
import { inputOf, neutralInput } from "./engine";

describe("双人键位", () => {
  it("两套键位一个都不重叠，互不抢占", () => {
    expect(overlappingKeys(P1_KEYS, P2_KEYS)).toEqual([]);
    expect(overlappingKeys(P2_KEYS, P1_KEYS)).toEqual([]);
    const all = [...keysOf(P1_KEYS), ...keysOf(P2_KEYS)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("朵朵是 WASD + F/G，星星是方向键 + L/K", () => {
    expect(P1_KEYS).toEqual({ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", light: "KeyF", heavy: "KeyG" });
    expect(P2_KEYS).toEqual({
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      light: "KeyL",
      heavy: "KeyK"
    });
    expect(KEY_MAPS[0]).toBe(P1_KEYS);
    expect(KEY_MAPS[1]).toBe(P2_KEYS);
  });

  it("暂停键是 Esc，而且不属于任何一位玩家", () => {
    expect(PAUSE_KEY).toBe("Escape");
    expect(keysOf(P1_KEYS)).not.toContain(PAUSE_KEY);
    expect(keysOf(P2_KEYS)).not.toContain(PAUSE_KEY);
  });

  it("游戏管的键认得出来，别的键一律放行", () => {
    expect(isGameKey("KeyW")).toBe(true);
    expect(isGameKey("ArrowLeft")).toBe(true);
    expect(isGameKey("Escape")).toBe(true);
    expect(isGameKey("KeyZ")).toBe(false);
    expect(isGameKey("Tab")).toBe(false);
  });

  it("按住一个人的键，另一个人一动不动", () => {
    const pressed = new Set(["KeyA", "KeyF"]);
    expect(readKeys(pressed, P1_KEYS)).toEqual({
      up: false,
      down: false,
      left: true,
      right: false,
      light: true,
      heavy: false
    });
    expect(readKeys(pressed, P2_KEYS)).toEqual(neutralInput());
  });

  it("两个人同时狂按，各读各的，一点不串", () => {
    const pressed = new Set(["KeyW", "KeyD", "KeyG", "ArrowDown", "ArrowLeft", "KeyL"]);
    const p1 = readKeys(pressed, P1_KEYS);
    const p2 = readKeys(pressed, P2_KEYS);
    expect(p1).toEqual({ up: true, down: false, left: false, right: true, light: false, heavy: true });
    expect(p2).toEqual({ up: false, down: true, left: true, right: false, light: true, heavy: false });
  });
});

describe("输入合并与整理", () => {
  it("键盘和触屏取并集", () => {
    const merged = mergeInput(inputOf({ left: true }), inputOf({ light: true }));
    expect(merged.left).toBe(true);
    expect(merged.light).toBe(true);
    expect(merged.right).toBe(false);
  });

  it("左右一起按当作没按，免得原地发抖", () => {
    const n = normalizeInput(inputOf({ left: true, right: true, light: true }));
    expect(n.left).toBe(false);
    expect(n.right).toBe(false);
    expect(n.light).toBe(true);
  });

  it("只按一个方向时原样保留", () => {
    expect(normalizeInput(inputOf({ right: true })).right).toBe(true);
    expect(normalizeInput(inputOf({ left: true })).left).toBe(true);
  });
});

describe("触屏虚拟摇杆", () => {
  it("推得太轻不算方向（死区）", () => {
    expect(stickDirection(0, 0)).toEqual(neutralInput());
    expect(stickDirection(STICK_DEADZONE, STICK_DEADZONE)).toEqual(neutralInput());
  });

  it("四个方向都推得出来", () => {
    expect(stickDirection(40, 0).right).toBe(true);
    expect(stickDirection(-40, 0).left).toBe(true);
    // 屏幕坐标 y 向下为正：往上推是负数
    expect(stickDirection(0, -40).up).toBe(true);
    expect(stickDirection(0, 40).down).toBe(true);
  });

  it("斜着推可以同时前进 + 起跳", () => {
    const d = stickDirection(40, -40);
    expect(d.right).toBe(true);
    expect(d.up).toBe(true);
    expect(d.left).toBe(false);
    expect(d.down).toBe(false);
  });

  it("摇杆永远不会同时给出左和右", () => {
    for (let dx = -60; dx <= 60; dx += 7) {
      for (let dy = -60; dy <= 60; dy += 7) {
        const d = stickDirection(dx, dy);
        expect(d.left && d.right).toBe(false);
        expect(d.up && d.down).toBe(false);
      }
    }
  });

  it("触屏左半屏归 1 号位、右半屏归 2 号位", () => {
    expect(sideOfTouch(10, 375)).toBe(0);
    expect(sideOfTouch(300, 375)).toBe(1);
    expect(sideOfTouch(639, 1280)).toBe(0);
    expect(sideOfTouch(641, 1280)).toBe(1);
  });
});

describe("键位说明", () => {
  it("六条说明都在，两套键位都写清楚了", () => {
    const lines = keyHintLines();
    expect(lines.length).toBeGreaterThanOrEqual(6);
    const all = lines.join("\n");
    expect(all).toContain("朵朵");
    expect(all).toContain("星星");
    expect(all).toContain("Esc");
    expect(all).toContain("格挡");
    expect(all).toContain("受身");
    expect(all).toContain("超必杀");
  });
});
