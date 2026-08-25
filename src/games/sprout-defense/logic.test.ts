import { describe, expect, it } from "vitest";
import {
  HOME_X,
  LANES,
  PLANT_INFO,
  bubbleHitsBug,
  bugReachesPlant,
  buildWaveSchedule,
  canAfford,
  starsForPlantsLost,
} from "./logic";

describe("sprout-defense 露珠经济", () => {
  it("露珠够才种得起", () => {
    expect(canAfford(1, "sparkle")).toBe(true);
    expect(canAfford(0, "sparkle")).toBe(false);
    expect(canAfford(2, "bubble")).toBe(true);
    expect(canAfford(1, "bubble")).toBe(false);
  });

  it("植物价格与耐久合理", () => {
    expect(PLANT_INFO.sparkle.cost).toBeLessThan(PLANT_INFO.bubble.cost);
    expect(PLANT_INFO.sparkle.hp).toBeGreaterThan(0);
    expect(PLANT_INFO.bubble.hp).toBeGreaterThan(0);
  });
});

describe("sprout-defense 虫虫时间表", () => {
  it("按时间递增,车道合法,难度递增", () => {
    const s = buildWaveSchedule();
    expect(s.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].time).toBeGreaterThanOrEqual(s[i - 1].time);
    }
    for (const b of s) {
      expect(b.lane).toBeGreaterThanOrEqual(0);
      expect(b.lane).toBeLessThan(LANES);
      expect(b.hp).toBeGreaterThan(0);
    }
    expect(s[s.length - 1].hp).toBeGreaterThan(s[0].hp);
  });

  it("每条车道都会来虫", () => {
    const lanes = new Set(buildWaveSchedule().map((b) => b.lane));
    expect(lanes.size).toBe(LANES);
  });
});

describe("sprout-defense 碰撞", () => {
  it("泡泡足够近才算命中", () => {
    expect(bubbleHitsBug(3.0, 3.2)).toBe(true);
    expect(bubbleHitsBug(3.0, 3.5)).toBe(false);
  });

  it("虫子走进植物格才开始啃", () => {
    expect(bugReachesPlant(3.5, 3)).toBe(true);
    expect(bugReachesPlant(3.7, 3)).toBe(false); // 还没走到
    expect(bugReachesPlant(2.5, 3)).toBe(false); // 已经走过了
  });

  it("家门口在种植区左侧", () => {
    expect(HOME_X).toBeLessThan(0);
  });
});

describe("sprout-defense 星星", () => {
  it("损失植物越少星星越多", () => {
    expect(starsForPlantsLost(0)).toBe(3);
    expect(starsForPlantsLost(2)).toBe(2);
    expect(starsForPlantsLost(5)).toBe(1);
  });
});
