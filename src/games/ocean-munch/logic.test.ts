import { describe, expect, it } from "vitest";
import {
  BOSS_HP,
  BOSS_R,
  LEVELS,
  SHIELD_SECONDS,
  START_RADIUS,
  ZONE_STYLE,
  bossBiteReady,
  canEat,
  circlesOverlap,
  eatScore,
  grow,
  isDanger,
  spawnRadius,
  starsForRun,
} from "./logic";

describe("ocean-munch 吃鱼规则", () => {
  it("明显更大才能吃,明显更小才危险,差不多大平安无事", () => {
    expect(canEat(20, 15)).toBe(true);
    expect(canEat(20, 19.5)).toBe(false);
    expect(isDanger(20, 30)).toBe(true);
    expect(isDanger(20, 21)).toBe(false);
    expect(canEat(20, 21) || isDanger(20, 21)).toBe(false);
  });

  it("圆形碰撞有宽容度", () => {
    expect(circlesOverlap(0, 0, 10, 10, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 30, 0, 10)).toBe(false);
  });

  it("吃鱼长大但不超过封顶", () => {
    expect(grow(20, 10, 48)).toBeGreaterThan(20);
    expect(grow(47.8, 30, 48)).toBe(48);
  });

  it("spawnRadius:小 roll 出小鱼,大 roll 出大鱼,bigBias 提高大鱼占比", () => {
    expect(spawnRadius(20, 0.1)).toBeLessThan(20);
    expect(spawnRadius(20, 0.95)).toBeGreaterThan(20);
    // bias 大时,原本还算"小鱼区"的 roll 会变成大鱼
    expect(spawnRadius(20, 0.6, 0.25)).toBeGreaterThan(20);
    expect(spawnRadius(20, 0.6, 0)).toBeLessThan(20);
  });
});

describe("ocean-munch 关卡", () => {
  it("至少 5 关且覆盖 3 片海域,只有最后一关有 BOSS", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
    const zones = new Set(LEVELS.map((l) => l.zone));
    expect(zones.size).toBeGreaterThanOrEqual(3);
    expect(LEVELS[LEVELS.length - 1].boss).toBe(true);
    expect(LEVELS.slice(0, -1).every((l) => !l.boss)).toBe(true);
  });

  it("每关目标都比初始大小大,难度元素逐步引入", () => {
    for (const l of LEVELS) expect(l.targetR).toBeGreaterThan(START_RADIUS);
    expect(LEVELS[0].jellies).toBe(0);
    expect(LEVELS[0].puffers).toBe(false);
    expect(LEVELS.some((l) => l.jellies > 0)).toBe(true);
    expect(LEVELS.some((l) => l.puffers)).toBe(true);
  });

  it("三片海域都有配色", () => {
    expect(ZONE_STYLE.shallow.name).toBeTruthy();
    expect(ZONE_STYLE.coral.top).toMatch(/^#/);
    expect(ZONE_STYLE.deep.bottom).toMatch(/^#/);
  });
});

describe("ocean-munch 连吃与道具", () => {
  it("连吃分数递增且封顶", () => {
    expect(eatScore(1)).toBe(10);
    expect(eatScore(2)).toBeGreaterThan(eatScore(1));
    expect(eatScore(8)).toBe(eatScore(20));
  });

  it("护盾有时长,BOSS 有血量", () => {
    expect(SHIELD_SECONDS).toBeGreaterThan(0);
    expect(BOSS_HP).toBeGreaterThanOrEqual(3);
  });

  it("长到 BOSS 六成大才能咬", () => {
    expect(bossBiteReady(BOSS_R * 0.5)).toBe(false);
    expect(bossBiteReady(BOSS_R * 0.62)).toBe(true);
    expect(bossBiteReady(30, 40)).toBe(true);
  });
});

describe("ocean-munch 结算", () => {
  it("星级由重试次数与掉心数决定", () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(0, 1)).toBe(3);
    expect(starsForRun(0, 4)).toBe(2);
    expect(starsForRun(1, 2)).toBe(2);
    expect(starsForRun(2, 0)).toBe(1);
  });
});
