import { describe, expect, it } from "vitest";
import {
  BANANA_CHANCE,
  COMBO_WINDOW,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  HEARTS_PER_ROUND,
  ROUNDS,
  arcadePace,
  arcadeStars,
  comboBonus,
  comboLabel,
  gravityFor,
  makeLaunch,
  segCircleHit,
  starsForClassic,
} from "./logic";

describe("fruit-slice 刀光碰撞", () => {
  it("线段切到圆", () => {
    expect(segCircleHit(0, 0, 100, 0, 50, 5, 10)).toBe(true);
    expect(segCircleHit(0, 0, 100, 0, 50, 30, 10)).toBe(false);
    expect(segCircleHit(0, 0, 0, 0, 5, 0, 10)).toBe(true);
  });

  it("抛射起点在屏幕下方、初速向上", () => {
    const l = makeLaunch(640, 480, 0.5, 0.5, 0.5);
    expect(l.y).toBeGreaterThan(480);
    expect(l.vy).toBeLessThan(0);
    expect(gravityFor(480)).toBeGreaterThan(0);
  });
});

describe("fruit-slice 连击爆击", () => {
  it("两连起才有爆击分,越多越值", () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(2);
    expect(comboBonus(3)).toBe(6);
    expect(comboBonus(4)).toBe(12);
  });

  it("爆击文案:双果/三连/多连", () => {
    expect(comboLabel(1)).toBeNull();
    expect(comboLabel(2)).toContain("双果");
    expect(comboLabel(3)).toContain("三连");
    expect(comboLabel(5)).toContain("5");
    expect(COMBO_WINDOW).toBeGreaterThan(0);
  });
});

describe("fruit-slice 经典回合", () => {
  it("至少 3 回合,目标分递增,炸弹越来越多", () => {
    expect(ROUNDS.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < ROUNDS.length; i++) {
      expect(ROUNDS[i].target).toBeGreaterThan(ROUNDS[i - 1].target);
      expect(ROUNDS[i].bombChance).toBeGreaterThanOrEqual(ROUNDS[i - 1].bombChance);
    }
    expect(HEARTS_PER_ROUND).toBe(3);
  });

  it("每回合时间和抛射数量合理", () => {
    for (const r of ROUNDS) {
      expect(r.time).toBeGreaterThanOrEqual(30);
      expect(r.volleyMin).toBeLessThanOrEqual(r.volleyMax);
      expect(r.maxOnScreen).toBeGreaterThanOrEqual(r.volleyMax);
    }
  });
});

describe("fruit-slice 香蕉与街机", () => {
  it("彩虹香蕉触发限时双倍水果雨", () => {
    expect(FRENZY_SECONDS).toBeGreaterThan(0);
    expect(FRENZY_MULTIPLIER).toBeGreaterThanOrEqual(2);
    expect(BANANA_CHANCE).toBeGreaterThan(0);
    expect(BANANA_CHANCE).toBeLessThan(0.2);
  });

  it("街机难度随分数上升:间隔变短、炸弹变多,且有上下限", () => {
    const p0 = arcadePace(0);
    const p200 = arcadePace(200);
    expect(p200.interval).toBeLessThan(p0.interval);
    expect(p200.bombChance).toBeGreaterThan(p0.bombChance);
    expect(arcadePace(99999).interval).toBeGreaterThanOrEqual(0.7);
    expect(arcadePace(99999).bombChance).toBeLessThanOrEqual(0.34);
  });

  it("街机星级按分数分档,低分算没通关", () => {
    expect(arcadeStars(10)).toBe(0);
    expect(arcadeStars(40)).toBe(1);
    expect(arcadeStars(90)).toBe(2);
    expect(arcadeStars(150)).toBe(3);
  });
});

describe("fruit-slice 结算", () => {
  it("经典星级:不重试少碰炸弹 3 星", () => {
    expect(starsForClassic(0, 0)).toBe(3);
    expect(starsForClassic(0, 1)).toBe(3);
    expect(starsForClassic(0, 4)).toBe(2);
    expect(starsForClassic(1, 0)).toBe(2);
    expect(starsForClassic(2, 2)).toBe(1);
  });
});
