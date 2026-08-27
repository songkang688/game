// 美术套件 · sparkle:星屑彩纸 500ms、seed 复现、destroy 清零。
import { describe, expect, it } from "vitest";
import {
  SPARKLE_COLORS,
  SPARKLE_LIFE_MS,
  clearSparkles,
  spawnSparkles,
  stepSparkles,
} from "./sparkle";

describe("星屑彩纸", () => {
  it("寿命常量 500ms;颜色全部来自粉彩盘", () => {
    expect(SPARKLE_LIFE_MS).toBe(500);
    const ps = spawnSparkles(1, 100, 100, 20);
    expect(ps).toHaveLength(20);
    for (const p of ps) {
      expect(SPARKLE_COLORS).toContain(p.color as (typeof SPARKLE_COLORS)[number]);
      expect(p.lifeMs).toBe(SPARKLE_LIFE_MS);
    }
  });

  it("同 seed 撒出同一把;不同 seed 不一样", () => {
    expect(spawnSparkles(7, 50, 60, 10)).toEqual(spawnSparkles(7, 50, 60, 10));
    expect(spawnSparkles(7, 50, 60, 10)).not.toEqual(spawnSparkles(8, 50, 60, 10));
  });

  it("步进会动、会掉、到 500ms 散干净", () => {
    let ps = spawnSparkles(3, 0, 0, 12);
    const x0 = ps[0].x;
    ps = stepSparkles(ps, 100);
    expect(ps).toHaveLength(12);
    expect(ps[0].x).not.toBe(x0);
    ps = stepSparkles(ps, SPARKLE_LIFE_MS);
    expect(ps).toHaveLength(0);
  });

  it("clearSparkles(destroy 用):粒子当场归零", () => {
    const ps = spawnSparkles(5, 10, 10, 16);
    clearSparkles(ps);
    expect(ps).toHaveLength(0);
  });
});
