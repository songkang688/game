import { afterEach, describe, expect, it } from "vitest";
import { CLICK_GUARD_MS } from "../../ui/dialogs";
import {
  CONFETTI_PIECES,
  FINISH_SLOWMO_MS,
  RUN_CYCLE_MAX_MS,
  RUN_CYCLE_MIN_MS,
  SETTLE_GUARD_MS,
  confettiCount,
  prefersReducedMotion,
  runCycleMs,
  settleClickAccepted,
  speedLinesAnimated,
  speedRatio
} from "./feel";

type MediaGlobal = { matchMedia?: (q: string) => { matches: boolean } };

afterEach(() => {
  delete (globalThis as MediaGlobal).matchMedia;
});

describe("红蓝赛跑 · 结算冷静期(1.1 的平台级修复不许破坏)", () => {
  it("自建浮层用的就是平台那把 400ms 的尺", () => {
    expect(SETTLE_GUARD_MS).toBe(CLICK_GUARD_MS);
    expect(SETTLE_GUARD_MS).toBe(400);
  });

  it("浮层刚弹出的 400ms 内狂点不算数，之后才吃点击", () => {
    expect(settleClickAccepted(1000, 1000)).toBe(false);
    expect(settleClickAccepted(1000, 1399)).toBe(false);
    expect(settleClickAccepted(1000, 1400)).toBe(true);
    expect(settleClickAccepted(1000, 5000)).toBe(true);
  });
});

describe("红蓝赛跑 · 跑步动画随速度变频", () => {
  it("跑得越快循环越短，两头都有夹子", () => {
    expect(runCycleMs(0)).toBe(RUN_CYCLE_MAX_MS);
    expect(runCycleMs(1)).toBe(RUN_CYCLE_MIN_MS);
    expect(runCycleMs(0.5)).toBeCloseTo((RUN_CYCLE_MAX_MS + RUN_CYCLE_MIN_MS) / 2, 10);
    expect(runCycleMs(9)).toBe(RUN_CYCLE_MIN_MS);
    expect(runCycleMs(-2)).toBe(RUN_CYCLE_MAX_MS);
    expect(runCycleMs(Number.NaN)).toBe(RUN_CYCLE_MAX_MS);
  });

  it("速度比单调不增地映射到周期上", () => {
    let prev = runCycleMs(0);
    for (let r = 0.1; r <= 1.0001; r += 0.1) {
      const cur = runCycleMs(r);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it("速度比自己也夹在 0..1，除数为 0 时不炸", () => {
    expect(speedRatio(3, 6)).toBeCloseTo(0.5, 10);
    expect(speedRatio(12, 6)).toBe(1);
    expect(speedRatio(-1, 6)).toBe(0);
    expect(speedRatio(3, 0)).toBe(0);
    expect(speedRatio(Number.NaN, 6)).toBe(0);
  });
});

describe("红蓝赛跑 · 冲线演出与减弱动效", () => {
  it("冲线慢镜 300ms，彩带有固定条数", () => {
    expect(FINISH_SLOWMO_MS).toBe(300);
    expect(CONFETTI_PIECES).toBeGreaterThan(8);
    expect(confettiCount(false)).toBe(CONFETTI_PIECES);
  });

  it("开了减弱动效：彩带 0 条、速度线不抖", () => {
    expect(confettiCount(true)).toBe(0);
    expect(speedLinesAnimated(true)).toBe(false);
    expect(speedLinesAnimated(false)).toBe(true);
  });

  it("读不到系统偏好就当没开，读得到就照着来", () => {
    expect(prefersReducedMotion()).toBe(false);
    (globalThis as MediaGlobal).matchMedia = () => ({ matches: true });
    expect(prefersReducedMotion()).toBe(true);
    (globalThis as MediaGlobal).matchMedia = () => ({ matches: false });
    expect(prefersReducedMotion()).toBe(false);
    (globalThis as MediaGlobal).matchMedia = () => {
      throw new Error("这台设备不支持 matchMedia");
    };
    expect(prefersReducedMotion()).toBe(false);
  });
});
