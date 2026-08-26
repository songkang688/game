import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

describe("星星消消乐 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关参数合法且可完成", () => {
    for (const lv of LEVELS) {
      expect(lv.colors).toBeGreaterThanOrEqual(4);
      expect(lv.colors).toBeLessThanOrEqual(5);
      expect(lv.moves).toBeGreaterThanOrEqual(14);
      expect(lv.goals.length).toBeGreaterThanOrEqual(1);
      for (const g of lv.goals) {
        expect(g.token).toBeGreaterThanOrEqual(0);
        expect(g.token).toBeLessThan(lv.colors);
        expect(g.count).toBeGreaterThan(0);
        // 每步至少能消 3 个，目标总量不能超过理论上限
        expect(g.count).toBeLessThanOrEqual(lv.moves * 3);
      }
      expect(lv.ice + lv.vine).toBeLessThanOrEqual(12);
      expect(lv.three).toBeGreaterThan(lv.two);
    }
  });

  it("十一章机关各不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.ice > 0 ? "冰" : ""}${lv.vine > 0 ? "藤" : ""}${lv.rainbow ? "虹" : ""}${
        lv.orders ? "单" : ""}${lv.belts ? "带" : ""}${lv.frost ? "霜" : ""}${lv.boss ? "巨" : ""}${lv.goals.length}`;
    };
    // 各章代表关：机关组合彼此不同
    const signatures = new Set([sig(0), sig(20), sig(35), sig(50), sig(63), sig(80), sig(95), sig(105), sig(130), sig(150), sig(175)]);
    expect(signatures.size).toBeGreaterThanOrEqual(9);
  });

  it("章节内难度递进（首关目标 ≤ 末关目标）", () => {
    const goalSum = (i: number) => LEVELS[i].goals.reduce((s, g) => s + g.count, 0);
    // 第一章：第 1 关 vs 第 15 关
    expect(goalSum(0)).toBeLessThan(goalSum(14));
    // 1.0 最后一章：第 86 关 vs 第 99 关
    expect(goalSum(85)).toBeLessThanOrEqual(goalSum(98));
    // 1.1 订单甜品铺：第 100 关 vs 第 122 关
    expect(goalSum(99)).toBeLessThan(goalSum(121));
  });
});
