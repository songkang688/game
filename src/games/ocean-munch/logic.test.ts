import { describe, expect, it } from "vitest";
import {
  START_RADIUS,
  TARGET_RADIUS,
  canEat,
  circlesOverlap,
  grow,
  isDanger,
  spawnRadius,
  starsForTime,
} from "./logic";

describe("ocean-munch 吃与被吃", () => {
  it("明显更大才能吃", () => {
    expect(canEat(20, 15)).toBe(true);
    expect(canEat(20, 18)).toBe(true);
    expect(canEat(20, 19)).toBe(false); // 只差一点点,还不能吃
    expect(canEat(20, 20)).toBe(false);
    expect(canEat(15, 20)).toBe(false);
  });

  it("对方明显更大才危险,差不多大是安全的", () => {
    expect(isDanger(20, 30)).toBe(true);
    expect(isDanger(20, 21)).toBe(false);
    expect(isDanger(20, 18)).toBe(false);
  });

  it("差不多大的鱼:既不能吃也不危险", () => {
    expect(canEat(20, 20.5)).toBe(false);
    expect(isDanger(20, 20.5)).toBe(false);
  });
});

describe("ocean-munch 成长", () => {
  it("每次至少长一点,并封顶到目标", () => {
    expect(grow(20, 1)).toBeGreaterThan(20);
    expect(grow(TARGET_RADIUS - 0.5, 30)).toBe(TARGET_RADIUS);
  });

  it("从初始吃到目标是有限次数", () => {
    let r = START_RADIUS;
    let steps = 0;
    while (r < TARGET_RADIUS && steps < 500) {
      r = grow(r, r * 0.6);
      steps++;
    }
    expect(r).toBe(TARGET_RADIUS);
    expect(steps).toBeLessThan(60);
  });
});

describe("ocean-munch 生成与碰撞", () => {
  it("roll < 0.66 生成的鱼一定能被吃", () => {
    for (const roll of [0, 0.2, 0.4, 0.65]) {
      const r = spawnRadius(20, roll);
      expect(canEat(20, r)).toBe(true);
    }
  });

  it("roll 大时生成危险大鱼,且有上限", () => {
    expect(isDanger(20, spawnRadius(20, 0.9))).toBe(true);
    expect(spawnRadius(100, 0.999)).toBeLessThanOrEqual(64);
    expect(spawnRadius(3, 0)).toBeGreaterThanOrEqual(6);
  });

  it("圆碰撞有宽容度", () => {
    expect(circlesOverlap(0, 0, 10, 14, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 30, 0, 10)).toBe(false);
  });
});

describe("ocean-munch 星星", () => {
  it("越快通关星星越多", () => {
    expect(starsForTime(30)).toBe(3);
    expect(starsForTime(60)).toBe(2);
    expect(starsForTime(100)).toBe(1);
  });
});
