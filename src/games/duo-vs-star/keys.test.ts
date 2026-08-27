/**
 * 双人键位巡检：这一份专门守「同屏两个人各按各的，谁也抢不走谁的键」。
 * 用真实的 KeyboardEvent.code 字符串驱动，和浏览器里收到的完全一致。
 */
import { describe, expect, it } from "vitest";
import { emptyInput, type Input } from "./ai";
import { P1_KEYS, P2_KEYS, isPauseKey, isWatchedKey, keyMap, readKeys } from "./keys";
import { createMatch, stepMatch } from "./battle";

function down(...codes: string[]): Set<string> {
  return new Set(codes);
}

describe("两套键位的分工", () => {
  it("鸭梨是 WASD + F / G", () => {
    expect(P1_KEYS.KeyW).toBe("up");
    expect(P1_KEYS.KeyA).toBe("left");
    expect(P1_KEYS.KeyS).toBe("down");
    expect(P1_KEYS.KeyD).toBe("right");
    expect(P1_KEYS.KeyF).toBe("light");
    expect(P1_KEYS.KeyG).toBe("heavy");
  });

  it("康康是方向键 + L / K", () => {
    expect(P2_KEYS.ArrowUp).toBe("up");
    expect(P2_KEYS.ArrowLeft).toBe("left");
    expect(P2_KEYS.ArrowDown).toBe("down");
    expect(P2_KEYS.ArrowRight).toBe("right");
    expect(P2_KEYS.KeyL).toBe("light");
    expect(P2_KEYS.KeyK).toBe("heavy");
  });

  it("两张表没有任何一个键重合", () => {
    const p1 = Object.keys(P1_KEYS);
    const p2 = Object.keys(P2_KEYS);
    expect(p1).toHaveLength(6);
    expect(p2).toHaveLength(6);
    for (const code of p1) expect(p2).not.toContain(code);
    for (const code of p2) expect(p1).not.toContain(code);
  });

  it("两张表都把六种操作配齐了", () => {
    const wanted: Array<keyof Input> = ["up", "down", "left", "right", "light", "heavy"];
    for (const seat of ["p1", "p2"] as const) {
      const values = Object.values(keyMap(seat));
      for (const w of wanted) expect(values).toContain(w);
    }
  });

  it("只有这十二个键归游戏管，别的键留给页面", () => {
    for (const code of [...Object.keys(P1_KEYS), ...Object.keys(P2_KEYS)]) {
      expect(isWatchedKey(code)).toBe(true);
    }
    for (const code of ["Space", "Tab", "Enter", "KeyQ", "KeyZ", "F5"]) {
      expect(isWatchedKey(code)).toBe(false);
    }
  });

  it("Esc 是暂停键", () => {
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("Esc")).toBe(true);
    expect(isPauseKey("p")).toBe(false);
  });
});

describe("互不抢占", () => {
  it("按 1P 的键，2P 一个动作都收不到", () => {
    const pressed = down("KeyD", "KeyW", "KeyF");
    expect(readKeys(pressed, "p1")).toEqual({ ...emptyInput(), right: true, up: true, light: true });
    expect(readKeys(pressed, "p2")).toEqual(emptyInput());
  });

  it("按 2P 的键，1P 一个动作都收不到", () => {
    const pressed = down("ArrowLeft", "KeyK");
    expect(readKeys(pressed, "p2")).toEqual({ ...emptyInput(), left: true, heavy: true });
    expect(readKeys(pressed, "p1")).toEqual(emptyInput());
  });

  it("两个人同时按，各拿各的那一份", () => {
    const pressed = down("KeyA", "KeyG", "ArrowRight", "KeyL");
    expect(readKeys(pressed, "p1")).toEqual({ ...emptyInput(), left: true, heavy: true });
    expect(readKeys(pressed, "p2")).toEqual({ ...emptyInput(), right: true, light: true });
  });

  it("不认识的键一概忽略", () => {
    expect(readKeys(down("Space", "Tab", "KeyZ"), "p1")).toEqual(emptyInput());
    expect(readKeys(down("Space", "Tab", "KeyZ"), "p2")).toEqual(emptyInput());
  });

  it("一个键都没按就是全空", () => {
    expect(readKeys(new Set(), "p1")).toEqual(emptyInput());
  });

  it("触屏按键和键盘取并集，两种操作方式完全等价", () => {
    const pad: Input = { ...emptyInput(), light: true };
    expect(readKeys(down("KeyD"), "p1", pad)).toEqual({ ...emptyInput(), right: true, light: true });
    // 传进来的触屏状态不会被改写
    expect(pad).toEqual({ ...emptyInput(), light: true });
  });

  it("接到擂台上：1P 按 D、2P 按 ←，两个人真的各走各的", () => {
    const s = createMatch({
      stageId: "cloud-square",
      slots: [
        { charId: "duoduo", team: 0, control: "p1" },
        { charId: "xingxing", team: 1, control: "p2" },
      ],
      stocks: 2,
      timeLimit: 0,
      itemEvery: 0,
      seed: 1,
    });
    const dt = 1 / 60;
    for (let i = 0; i < 90; i++) stepMatch(s, dt, {}); // 先落地站稳
    const start = [s.actors[0].x, s.actors[1].x];

    const pressed = down("KeyD", "ArrowLeft");
    for (let i = 0; i < 36; i++) {
      stepMatch(s, dt, { 0: readKeys(pressed, "p1"), 1: readKeys(pressed, "p2") });
    }
    expect(s.actors[0].x).toBeGreaterThan(start[0] + 20);
    expect(s.actors[1].x).toBeLessThan(start[1] - 20);

    // 只按 1P 的键：2P 立刻停下，不会跟着跑
    const only1 = down("KeyA");
    const mid = [s.actors[0].x, s.actors[1].x];
    for (let i = 0; i < 36; i++) {
      stepMatch(s, dt, { 0: readKeys(only1, "p1"), 1: readKeys(only1, "p2") });
    }
    expect(s.actors[0].x).toBeLessThan(mid[0] - 20);
    expect(Math.abs(s.actors[1].x - mid[1])).toBeLessThan(1);
  });
});
