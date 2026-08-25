import { describe, expect, it } from "vitest";
import {
  BUG_INFO,
  HOME_X,
  LANES,
  LEVEL_COUNT,
  PLANT_INFO,
  PLANT_KINDS,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  projectileCanHit,
  shovelRefund,
  starsForRun,
  wavesInLevel,
} from "./logic";

describe("sprout-defense 植物", () => {
  it("至少 4 种植物,各有定位", () => {
    expect(PLANT_KINDS.length).toBeGreaterThanOrEqual(4);
    expect(PLANT_INFO.nut.hp).toBeGreaterThan(PLANT_INFO.bubble.hp);
    expect(PLANT_INFO.sparkle.cost).toBeLessThanOrEqual(PLANT_INFO.star.cost);
  });

  it("露珠够才能种", () => {
    expect(canAfford(3, "star")).toBe(true);
    expect(canAfford(2, "star")).toBe(false);
    expect(canAfford(1, "sparkle")).toBe(true);
  });

  it("铲子退半价(向上取整)", () => {
    expect(shovelRefund("sparkle")).toBe(1);
    expect(shovelRefund("bubble")).toBe(1);
    expect(shovelRefund("star")).toBe(2);
  });
});

describe("sprout-defense 虫虫", () => {
  it("三种虫:壳壳虫带护甲,飘飘虫会飞", () => {
    expect(BUG_INFO.armor.armor).toBeGreaterThan(0);
    expect(BUG_INFO.flyer.flying).toBe(true);
    expect(BUG_INFO.walker.flying).toBe(false);
  });

  it("泡泡打不到飞虫,星星都能打", () => {
    expect(projectileCanHit("bubble", true)).toBe(false);
    expect(projectileCanHit("bubble", false)).toBe(true);
    expect(projectileCanHit("star", true)).toBe(true);
    expect(projectileCanHit("star", false)).toBe(true);
  });

  it("伤害先敲护甲,敲碎那一下会报告 brokeArmor", () => {
    let bug = { hp: 3, armor: 2 };
    let res = applyDamage(bug, 1);
    expect(res).toEqual({ hp: 3, armor: 1, brokeArmor: false });
    res = applyDamage(res, 1);
    expect(res.armor).toBe(0);
    expect(res.hp).toBe(3);
    expect(res.brokeArmor).toBe(true);
    res = applyDamage(res, 1);
    expect(res.hp).toBe(2);
    expect(res.brokeArmor).toBe(false);
  });

  it("虫子血量随关卡上涨", () => {
    expect(bugHp("walker", 5)).toBeGreaterThan(bugHp("walker", 1));
  });
});

describe("sprout-defense 关卡时间表", () => {
  it("共 5 关,波数递增,时间有序,车道合法", () => {
    expect(LEVEL_COUNT).toBe(5);
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const schedule = buildLevelSchedule(level);
      expect(schedule.length).toBeGreaterThan(0);
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].time).toBeGreaterThanOrEqual(schedule[i - 1].time);
      }
      for (const s of schedule) {
        expect(s.lane).toBeGreaterThanOrEqual(0);
        expect(s.lane).toBeLessThan(LANES);
        expect(s.wave).toBeLessThan(wavesInLevel(level));
      }
    }
    expect(wavesInLevel(5)).toBeGreaterThan(wavesInLevel(1));
  });

  it("第 1 关只有爬爬虫;后面关卡才有飞虫和壳壳虫", () => {
    const l1 = buildLevelSchedule(1);
    expect(l1.every((s) => s.kind === "walker")).toBe(true);
    const l2 = buildLevelSchedule(2);
    expect(l2.some((s) => s.kind === "flyer")).toBe(true);
    expect(l2.some((s) => s.kind === "armor")).toBe(false);
    const l3 = buildLevelSchedule(3);
    expect(l3.some((s) => s.kind === "armor")).toBe(true);
  });

  it("关卡越深虫越多,同关表是确定性的", () => {
    for (let level = 2; level <= LEVEL_COUNT; level++) {
      expect(buildLevelSchedule(level).length).toBeGreaterThan(
        buildLevelSchedule(level - 1).length,
      );
    }
    expect(buildLevelSchedule(3)).toEqual(buildLevelSchedule(3));
  });
});

describe("sprout-defense 碰撞", () => {
  it("泡泡命中判定", () => {
    expect(bubbleHitsBug(3.0, 3.2)).toBe(true);
    expect(bubbleHitsBug(3.0, 3.5)).toBe(false);
  });

  it("虫子啃植物判定", () => {
    expect(bugReachesPlant(2.5, 2)).toBe(true);
    expect(bugReachesPlant(3.2, 2)).toBe(false);
    expect(HOME_X).toBeLessThan(0);
  });
});

describe("sprout-defense 结算", () => {
  it("星级由重试与损失植物决定", () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(0, 2)).toBe(3);
    expect(starsForRun(0, 5)).toBe(2);
    expect(starsForRun(1, 0)).toBe(2);
    expect(starsForRun(2, 1)).toBe(1);
  });
});
