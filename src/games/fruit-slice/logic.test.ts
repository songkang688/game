import { describe, expect, it } from "vitest";
import {
  TARGET_SCORE,
  comboBonus,
  gravityFor,
  makeLaunch,
  segCircleHit,
  starsForTime,
} from "./logic";

describe("fruit-slice 刀光切圆", () => {
  it("穿过圆心必中", () => {
    expect(segCircleHit(0, 50, 100, 50, 50, 50, 20)).toBe(true);
  });

  it("擦边算中,离远了不中", () => {
    expect(segCircleHit(0, 0, 100, 0, 50, 19, 20)).toBe(true);
    expect(segCircleHit(0, 0, 100, 0, 50, 30, 20)).toBe(false);
  });

  it("线段没伸到圆那里就不算中", () => {
    expect(segCircleHit(0, 0, 10, 0, 100, 0, 20)).toBe(false);
  });

  it("零长度线段相当于点", () => {
    expect(segCircleHit(50, 50, 50, 50, 50, 60, 20)).toBe(true);
    expect(segCircleHit(0, 0, 0, 0, 50, 60, 20)).toBe(false);
  });
});

describe("fruit-slice 得分", () => {
  it("一刀 3 个才有连击奖励", () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(0);
    expect(comboBonus(3)).toBe(3);
    expect(comboBonus(5)).toBe(5);
  });

  it("目标分是正数,越快通关星星越多", () => {
    expect(TARGET_SCORE).toBeGreaterThan(0);
    expect(starsForTime(30)).toBe(3);
    expect(starsForTime(60)).toBe(2);
    expect(starsForTime(90)).toBe(1);
  });
});

describe("fruit-slice 抛射", () => {
  it("起点在屏幕下方中段,初速向上", () => {
    for (const roll of [0, 0.5, 0.99]) {
      const l = makeLaunch(800, 600, roll, roll, roll);
      expect(l.x).toBeGreaterThanOrEqual(800 * 0.2);
      expect(l.x).toBeLessThanOrEqual(800 * 0.8);
      expect(l.y).toBeGreaterThan(600);
      expect(l.vy).toBeLessThan(0);
    }
  });

  it("能飞到半空再落回来(用重力积分验证)", () => {
    const h = 600;
    const g = gravityFor(h);
    const l = makeLaunch(800, h, 0.5, 0.5, 0.5);
    let y = l.y;
    let vy = l.vy;
    let minY = y;
    const dt = 1 / 60;
    for (let t = 0; t < 5; t += dt) {
      vy += g * dt;
      y += vy * dt;
      minY = Math.min(minY, y);
    }
    expect(minY).toBeLessThan(h * 0.5); // 至少飞过半屏
    expect(y).toBeGreaterThan(h); // 最后落回屏幕外
  });
});
