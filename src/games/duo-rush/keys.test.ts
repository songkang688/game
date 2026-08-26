import { describe, expect, it } from "vitest";
import {
  P1_KEYS,
  P2_KEYS,
  isPauseKey,
  isWatchedKey,
  keyMap,
  resolveKey,
  seatAtPoint,
  swipeAction,
} from "./keys";

describe("双人键位", () => {
  it("朵朵是 W A S D，星星是四个方向键", () => {
    expect(Object.keys(P1_KEYS).sort()).toEqual(["KeyA", "KeyD", "KeyS", "KeyW"]);
    expect(Object.keys(P2_KEYS).sort()).toEqual([
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
    ]);
  });

  it("两张键表零交集,两个人同屏各按各的抢不走对方的键", () => {
    const shared = Object.keys(P1_KEYS).filter((code) => code in P2_KEYS);
    expect(shared).toEqual([]);
  });

  it("两个人的四个动作一一对应,没有谁少一手", () => {
    expect(Object.values(P1_KEYS).sort()).toEqual(Object.values(P2_KEYS).sort());
    expect(new Set(Object.values(P1_KEYS)).size).toBe(4);
  });

  it("keyMap 按座位取表", () => {
    expect(keyMap(0)).toBe(P1_KEYS);
    expect(keyMap(1)).toBe(P2_KEYS);
  });

  it("resolveKey 认得出这个键是谁的、要干什么", () => {
    expect(resolveKey("KeyW")).toEqual({ seat: 0, action: "jump" });
    expect(resolveKey("KeyA")).toEqual({ seat: 0, action: "left" });
    expect(resolveKey("KeyS")).toEqual({ seat: 0, action: "slide" });
    expect(resolveKey("KeyD")).toEqual({ seat: 0, action: "right" });
    expect(resolveKey("ArrowUp")).toEqual({ seat: 1, action: "jump" });
    expect(resolveKey("ArrowLeft")).toEqual({ seat: 1, action: "left" });
    expect(resolveKey("ArrowDown")).toEqual({ seat: 1, action: "slide" });
    expect(resolveKey("ArrowRight")).toEqual({ seat: 1, action: "right" });
  });

  it("不相干的键一律不接管,留给页面自己用", () => {
    for (const code of ["KeyQ", "Space", "Enter", "Tab", "KeyL"]) {
      expect(resolveKey(code)).toBeNull();
      expect(isWatchedKey(code)).toBe(false);
    }
    expect(isWatchedKey("KeyW")).toBe(true);
    expect(isWatchedKey("ArrowLeft")).toBe(true);
  });

  it("Esc 是两人共用的暂停键(老浏览器的 Esc 旧名字也认)", () => {
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("Esc")).toBe(true);
    expect(isPauseKey("KeyW")).toBe(false);
    expect(isWatchedKey("Escape")).toBe(false);
  });
});

describe("手机滑动", () => {
  it("四个方向各自对上一个动作", () => {
    expect(swipeAction(-60, 4)).toBe("left");
    expect(swipeAction(60, -4)).toBe("right");
    expect(swipeAction(3, -60)).toBe("jump");
    expect(swipeAction(-3, 60)).toBe("slide");
  });

  it("手抖那么一点点不算滑动", () => {
    expect(swipeAction(6, -7)).toBeNull();
    expect(swipeAction(0, 0)).toBeNull();
  });

  it("斜着滑时听位移大的那个轴", () => {
    expect(swipeAction(80, -40)).toBe("right");
    expect(swipeAction(-40, 80)).toBe("slide");
  });
});

describe("左右半屏各归各人", () => {
  const size = { width: 400, height: 300 };

  it("上下分屏时上半屏是朵朵、下半屏是星星", () => {
    expect(seatAtPoint(200, 40, size, "column")).toBe(0);
    expect(seatAtPoint(200, 260, size, "column")).toBe(1);
  });

  it("左右分屏时左半屏是朵朵、右半屏是星星", () => {
    expect(seatAtPoint(40, 150, size, "row")).toBe(0);
    expect(seatAtPoint(360, 150, size, "row")).toBe(1);
  });
});
