import { describe, expect, it } from "vitest";
import { assertTotal } from "../level99";
import { TIER_GHOST_SPEED } from "./ghosts";
import { CHAPTERS, TOTAL, chaptersValid, configFor, endlessConfig, mazeFor, planFor, rateLevel } from "./levels";
import { dotsLeft, isEnclosed, reachableDots } from "./maze";
import { autoClear, dummySurviveMs, remaining } from "./logic";

describe("豆豆迷宫 · 188 关切分", () => {
  it("章节和恒等 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(chaptersValid()).toBe(true);
    expect(TOTAL).toBe(188);
    expect(CHAPTERS.length).toBe(8);
  });

  it("每一章都有名字、颜色和一句说明", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.desc.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#/);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("难度整体往上走：越靠后步进越快、小幽灵越多", () => {
    expect(planFor(0).ghostCount).toBe(0);
    expect(planFor(30).ghostCount).toBe(1);
    expect(planFor(187).ghostCount).toBe(4);
    expect(planFor(187).stepMs).toBeLessThan(planFor(0).stepMs);
  });

  it("第 1 / 100 / 188 关的地图都封闭且可以清空", () => {
    for (const level of [0, 99, 187]) {
      const m = mazeFor(level);
      expect(isEnclosed(m), `第 ${level + 1} 关边框漏了`).toBe(true);
      expect(reachableDots(m), `第 ${level + 1} 关有吃不到的豆`).toBe(dotsLeft(m));
    }
  });

  it("全部 188 关的地图都能从出生点清光豆子", () => {
    for (let level = 0; level < TOTAL; level += 1) {
      const m = mazeFor(level);
      expect(reachableDots(m), `第 ${level + 1} 关有吃不到的豆`).toBe(dotsLeft(m));
    }
  });

  it("无尽模式一圈比一圈快，档位逐步升到地狱", () => {
    const first = endlessConfig(0);
    const later = endlessConfig(9);
    expect(later.stepMs).toBeLessThan(first.stepMs);
    expect(TIER_GHOST_SPEED[later.tier]).toBeGreaterThan(TIER_GHOST_SPEED[first.tier]);
    expect(reachableDots(later.maze)).toBe(dotsLeft(later.maze));
  });

  it("评星按剩余小星命给：满命三星，掉光只剩一星", () => {
    expect(rateLevel(4, 4)).toBe(3);
    expect(rateLevel(2, 4)).toBe(2);
    expect(rateLevel(1, 4)).toBe(1);
  });

  it("第 1 / 100 / 188 关都能被清图机器人真的打通", () => {
    for (const level of [0, 99, 187]) {
      const state = autoClear({ ...configFor(level), ghostCount: 0 }, 5, 40000);
      expect(state.over, `第 ${level + 1} 关没打完`).toBe(true);
      expect(state.won, `第 ${level + 1} 关没赢`).toBe(true);
      expect(remaining(state)).toBe(0);
    }
  });

  it("固定 seed 下地狱档让假人活得明显更短", () => {
    const base = configFor(120);
    const easy = dummySurviveMs({ ...base, tier: "rookie", ghostCount: 4, lives: 3 }, 11, 40000);
    const hell = dummySurviveMs({ ...base, tier: "hell", ghostCount: 4, lives: 3 }, 11, 40000);
    expect(hell).toBeLessThan(easy);
  });
});
