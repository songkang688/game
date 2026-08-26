import { describe, expect, it } from "vitest";
import {
  MOVE_ACTIONS,
  P1_KEYS,
  P2_KEYS,
  PAD_LAYOUT,
  STICK_OFFSET,
  TAP_ACTIONS,
  TOUCH_HIT_PX,
  isPauseKey,
  isWatchedKey,
  keyMap,
  moveVector,
  padSpacingPx,
  resolveKey,
} from "./keys";

describe("双人键位", () => {
  it("朵朵是 WASD + F + G", () => {
    expect(P1_KEYS.KeyW).toBe("up");
    expect(P1_KEYS.KeyA).toBe("left");
    expect(P1_KEYS.KeyS).toBe("down");
    expect(P1_KEYS.KeyD).toBe("right");
    expect(P1_KEYS.KeyF).toBe("grab");
    expect(P1_KEYS.KeyG).toBe("skill");
  });

  it("星星是方向键 + L + K", () => {
    expect(P2_KEYS.ArrowUp).toBe("up");
    expect(P2_KEYS.ArrowLeft).toBe("left");
    expect(P2_KEYS.ArrowDown).toBe("down");
    expect(P2_KEYS.ArrowRight).toBe("right");
    expect(P2_KEYS.KeyL).toBe("grab");
    expect(P2_KEYS.KeyK).toBe("skill");
  });

  it("两张键位表零交集,同屏两个人抢不到对方的键", () => {
    for (const code of Object.keys(P1_KEYS)) {
      expect(code in P2_KEYS, `${code} 同时属于两个人`).toBe(false);
    }
    expect(Object.keys(P1_KEYS).length).toBe(Object.keys(P2_KEYS).length);
  });

  it("每人六个键:四个方向 + 出手 + 技能", () => {
    for (const seat of [0, 1] as const) {
      const actions = Object.values(keyMap(seat));
      for (const a of [...MOVE_ACTIONS, ...TAP_ACTIONS]) {
        expect(actions, `${seat} 号位缺 ${a}`).toContain(a);
      }
      expect(actions.length).toBe(6);
    }
  });

  it("认得出一个键归谁,不认识的键不接管", () => {
    expect(resolveKey("KeyW")).toEqual({ seat: 0, action: "up" });
    expect(resolveKey("KeyK")).toEqual({ seat: 1, action: "skill" });
    expect(resolveKey("Space")).toBeNull();
    expect(isWatchedKey("ArrowLeft")).toBe(true);
    expect(isWatchedKey("KeyZ")).toBe(false);
  });

  it("Esc 暂停,别的键不是暂停", () => {
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("Esc")).toBe(true);
    expect(isPauseKey("Enter")).toBe(false);
  });
});

describe("走位向量", () => {
  it("没按方向就不动", () => {
    expect(moveVector({})).toEqual({ x: 0, y: 0 });
    expect(moveVector({ grab: true })).toEqual({ x: 0, y: 0 });
  });

  it("斜着走不会比直着走快", () => {
    const straight = moveVector({ right: true });
    const diagonal = moveVector({ right: true, down: true });
    expect(Math.hypot(straight.x, straight.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("左右同时按会抵消,不会抽搐", () => {
    expect(moveVector({ left: true, right: true })).toEqual({ x: 0, y: 0 });
    expect(moveVector({ up: true, down: true })).toEqual({ x: 0, y: 0 });
  });

  it("上是负 y、下是正 y(和画面坐标一致)", () => {
    expect(moveVector({ up: true }).y).toBeLessThan(0);
    expect(moveVector({ down: true }).y).toBeGreaterThan(0);
  });
});

describe("手机控件布局", () => {
  it("热区下限不小于 44px", () => {
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
  });

  it("摇杆和两个动作钮在 360px 宽的半场里不重叠", () => {
    const w = 336; // 360 减去外层内边距
    const h = 190;
    const pairs: Array<[keyof typeof PAD_LAYOUT, keyof typeof PAD_LAYOUT]> = [
      ["stick", "grab"],
      ["stick", "skill"],
      ["grab", "skill"],
    ];
    for (const [a, b] of pairs) {
      expect(padSpacingPx(PAD_LAYOUT[a], PAD_LAYOUT[b], w, h), `${a} 和 ${b} 挨太近`).toBeGreaterThanOrEqual(
        TOUCH_HIT_PX,
      );
    }
  });

  it("摇杆在左半边、动作钮在右半边,两只手不打架", () => {
    expect(PAD_LAYOUT.stick.x).toBeLessThan(0.5);
    expect(PAD_LAYOUT.grab.x).toBeGreaterThan(0.5);
    expect(PAD_LAYOUT.skill.x).toBeGreaterThan(0.5);
  });

  it("四个方向钮不出半场边界,在 360px 上也整个露在外面", () => {
    const w = 336;
    const h = 186;
    const half = TOUCH_HIT_PX / 2;
    const spots = [
      { x: PAD_LAYOUT.stick.x - STICK_OFFSET.x, y: PAD_LAYOUT.stick.y },
      { x: PAD_LAYOUT.stick.x + STICK_OFFSET.x, y: PAD_LAYOUT.stick.y },
      { x: PAD_LAYOUT.stick.x, y: PAD_LAYOUT.stick.y - STICK_OFFSET.y },
      { x: PAD_LAYOUT.stick.x, y: PAD_LAYOUT.stick.y + STICK_OFFSET.y },
      PAD_LAYOUT.grab,
      PAD_LAYOUT.skill,
    ];
    for (const s of spots) {
      expect(s.x * w - half).toBeGreaterThanOrEqual(0);
      expect(s.x * w + half).toBeLessThanOrEqual(w);
      expect(s.y * h - half).toBeGreaterThanOrEqual(0);
      expect(s.y * h + half).toBeLessThanOrEqual(h);
    }
  });

  it("相邻的方向钮之间留得下手指", () => {
    const w = 336;
    const h = 186;
    const up = { x: PAD_LAYOUT.stick.x, y: PAD_LAYOUT.stick.y - STICK_OFFSET.y };
    const left = { x: PAD_LAYOUT.stick.x - STICK_OFFSET.x, y: PAD_LAYOUT.stick.y };
    const down = { x: PAD_LAYOUT.stick.x, y: PAD_LAYOUT.stick.y + STICK_OFFSET.y };
    expect(padSpacingPx(up, left, w, h)).toBeGreaterThanOrEqual(TOUCH_HIT_PX);
    expect(padSpacingPx(up, down, w, h)).toBeGreaterThanOrEqual(TOUCH_HIT_PX);
  });
});
