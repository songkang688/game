import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

describe("红蓝点点 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法：小电脑再快也给孩子留出反应时间", () => {
    for (const lv of LEVELS) {
      expect(lv.targetPoints).toBeGreaterThanOrEqual(5);
      expect(lv.targetPoints).toBeLessThanOrEqual(14);
      expect(lv.aiDelayMs).toBeGreaterThanOrEqual(600);
      expect(lv.trapChance).toBeLessThanOrEqual(0.4);
    }
  });

  it("六章规则各不相同（并非同一模板）", () => {
    expect(LEVELS[5].trapChance).toBe(0);
    expect(LEVELS[25].trapChance).toBeGreaterThan(0);
    expect(LEVELS[45].trapChance).toBeGreaterThan(0);
    // 闪电快拍比点点广场快得多
    expect(LEVELS[60].aiDelayMs).toBeLessThan(LEVELS[10].aiDelayMs);
    // 双子挑战一次两个
    expect(LEVELS[75].double).toBe(true);
    expect(LEVELS[5].double).toBe(false);
    // 主题覆盖 6 章
    expect(new Set(LEVELS.map((l) => l.theme)).size).toBe(6);
  });

  it("章节内小电脑越来越快", () => {
    expect(LEVELS[16].aiDelayMs).toBeLessThan(LEVELS[0].aiDelayMs);
    expect(LEVELS[98].aiDelayMs).toBeLessThan(LEVELS[83].aiDelayMs);
  });
});
