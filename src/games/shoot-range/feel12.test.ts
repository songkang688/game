/**
 * 1.2 手感三件套的单测(规格第四节第一行):
 * 出手前摇 ≤ 80ms、命中顿感 4–6 帧、散布随连发增大并随停手回收。
 * 这三条是「手感」的硬指标,数值一改这里就红。
 */
import { describe, expect, it } from "vitest";
import {
  FRAME_S,
  HIT_STOP_MAX_FRAMES,
  HIT_STOP_MIN_FRAMES,
  RECOIL_KICK,
  SPREAD_MAX,
  SPREAD_PER_SHOT,
  SPREAD_RECOVER_PER_S,
  SPREAD_SETTLE_DELAY,
  WINDUP_MS,
  WINDUP_S,
  crosshairRadius,
  hitStopFrames,
  hitStopSeconds,
  recoilAfterShot,
  shakeAmount,
  shotsToMaxSpread,
  spreadAfterShot,
  spreadOffset,
  spreadRecoverSeconds,
  stepHitStop,
  stepRecoil,
  stepSpread,
  windupProgress,
} from "./feel12";
import { mulberry32 } from "../level99";

describe("shoot-range 1.2 手感 · 出手前摇", () => {
  it("前摇不超过规格的 80ms,也不能短到没有实感", () => {
    expect(WINDUP_MS).toBeLessThanOrEqual(80);
    expect(WINDUP_MS).toBeGreaterThanOrEqual(40);
    expect(WINDUP_S).toBeCloseTo(WINDUP_MS / 1000, 6);
  });

  it("前摇进度从 0 走到 1,发射台就是照它压下去再弹回来的", () => {
    expect(windupProgress(WINDUP_S)).toBeCloseTo(0, 6);
    expect(windupProgress(WINDUP_S / 2)).toBeCloseTo(0.5, 6);
    expect(windupProgress(0)).toBe(1);
    expect(windupProgress(-1)).toBe(1);
    // 一帧一帧走,进度单调不回头
    let prev = -1;
    for (let left = WINDUP_S; left >= 0; left -= FRAME_S) {
      const p = windupProgress(left);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe("shoot-range 1.2 手感 · 命中顿感", () => {
  it("顿感永远在 4–6 帧之间,大事件顿得久一点", () => {
    expect(HIT_STOP_MIN_FRAMES).toBe(4);
    expect(HIT_STOP_MAX_FRAMES).toBe(6);
    for (const kind of ["normal", "shield", "big"] as const) {
      const f = hitStopFrames(kind);
      expect(f).toBeGreaterThanOrEqual(4);
      expect(f).toBeLessThanOrEqual(6);
      expect(hitStopSeconds(kind)).toBeCloseTo(f / 60, 6);
    }
    expect(hitStopFrames("big")).toBeGreaterThan(hitStopFrames("normal"));
    expect(hitStopFrames("shield")).toBeGreaterThan(hitStopFrames("normal"));
  });

  it("顿感最长也就 100ms,一帧一帧扣得干净,不会扣成负数", () => {
    expect(hitStopSeconds("big")).toBeLessThanOrEqual(0.1);
    let left = hitStopSeconds("big");
    for (let i = 0; i < 7; i++) left = stepHitStop(left, FRAME_S);
    expect(left).toBe(0);
    expect(stepHitStop(0.01, 5)).toBe(0);
  });
});

describe("shoot-range 1.2 手感 · 准星散布", () => {
  it("连发越打越撒,但撒到封顶就不再涨", () => {
    let spread = 0;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      spread = spreadAfterShot(spread);
      seen.push(spread);
    }
    expect(seen[0]).toBeCloseTo(SPREAD_PER_SHOT, 6);
    expect(seen[1]).toBeGreaterThan(seen[0]);
    expect(Math.max(...seen)).toBe(SPREAD_MAX);
    expect(shotsToMaxSpread()).toBe(Math.ceil(SPREAD_MAX / SPREAD_PER_SHOT));
  });

  it("停手才收:连点的间隙不收,停稳之后一路收回 0", () => {
    let spread = SPREAD_MAX;
    // 还在连点的间隙里(距上一发不到 SPREAD_SETTLE_DELAY):一点都不收
    for (let i = 0; i < 5; i++) spread = stepSpread(spread, 1 / 60, SPREAD_SETTLE_DELAY - 0.01);
    expect(spread).toBe(SPREAD_MAX);
    // 停手之后一秒能收回 SPREAD_RECOVER_PER_S
    spread = stepSpread(spread, 1, 1);
    expect(spread).toBeCloseTo(Math.max(0, SPREAD_MAX - SPREAD_RECOVER_PER_S), 6);
    // 一直停手就一定回到 0,而且不会变成负数
    for (let i = 0; i < 200; i++) spread = stepSpread(spread, 1 / 60, 2);
    expect(spread).toBe(0);
  });

  it("散布回收曲线可算:满散布收干净的时间就是那条公式", () => {
    const want = spreadRecoverSeconds(SPREAD_MAX);
    expect(want).toBeCloseTo(SPREAD_MAX / SPREAD_RECOVER_PER_S + SPREAD_SETTLE_DELAY, 6);
    let spread = SPREAD_MAX;
    let t = SPREAD_SETTLE_DELAY;
    for (let i = 0; i < 600 && spread > 0; i++) {
      spread = stepSpread(spread, 1 / 60, t);
      t += 1 / 60;
    }
    expect(spread).toBe(0);
    expect(t).toBeLessThan(want + 0.2);
  });

  it("落点在散布圆里,散布为 0 就是瞄哪打哪;给定随机流结果可复现", () => {
    expect(spreadOffset(0, () => 0.5)).toEqual({ dx: 0, dy: 0 });
    const runA = mulberry32(7);
    const runB = mulberry32(7);
    for (let i = 0; i < 20; i++) {
      const a = spreadOffset(SPREAD_MAX, runA);
      const b = spreadOffset(SPREAD_MAX, runB);
      expect(a).toEqual(b);
      expect(Math.hypot(a.dx, a.dy)).toBeLessThanOrEqual(SPREAD_MAX + 1e-9);
    }
  });
});

describe("shoot-range 1.2 手感 · 后坐力与 reduced-motion", () => {
  it("准星被弹上去之后自己落回来,连发也不会越弹越高", () => {
    let kick = 0;
    for (let i = 0; i < 8; i++) kick = recoilAfterShot(kick);
    expect(kick).toBeLessThanOrEqual(RECOIL_KICK * 2);
    kick = stepRecoil(kick, 1);
    expect(kick).toBe(0);
    expect(stepRecoil(-5, 0.1)).toBe(0);
  });

  it("prefers-reduced-motion 关掉抖动和屏震,散布数值照样看得见", () => {
    const spread = 20;
    const calm = crosshairRadius(spread, 0.3, true);
    expect(calm).toBe(20 + spread);
    // 不减动态时准星圈会呼吸,但幅度很小
    const lively = crosshairRadius(spread, 0.3, false);
    expect(Math.abs(lively - calm)).toBeLessThanOrEqual(2.5);
    // 散布越大,圈越大——这条在两种模式下都成立
    expect(crosshairRadius(30, 0, true)).toBeGreaterThan(crosshairRadius(5, 0, true));
    expect(shakeAmount(hitStopSeconds("big"), true)).toBe(0);
    expect(shakeAmount(hitStopSeconds("big"), false)).toBeGreaterThan(0);
    expect(shakeAmount(0, false)).toBe(0);
  });
});
