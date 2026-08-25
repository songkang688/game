import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

describe("红蓝拔河 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法：孩子每秒点 5 下就能拉得动", () => {
    for (const lv of LEVELS) {
      expect(lv.aiRate).toBeGreaterThan(3);
      // 每秒 5 次点击的拉力要能超过小电脑
      expect(lv.pullPower * 5).toBeGreaterThan(lv.aiRate * 0.8);
      expect(lv.pullPower).toBeGreaterThan(0);
    }
  });

  it("六章机关各不相同（并非同一模板）", () => {
    expect(LEVELS[5].star || LEVELS[5].redlight || LEVELS[5].rhythm).toBe(false);
    expect(LEVELS[25].star).toBe(true);
    expect(LEVELS[45].redlight).toBe(true);
    expect(LEVELS[60].rhythm).toBe(true);
    expect(LEVELS[75].star).toBe(true);
    expect(LEVELS[75].aiRate).toBeGreaterThan(LEVELS[25].aiRate);
    const last = LEVELS[95];
    expect(last.star && last.redlight).toBe(true);
  });

  it("章节内小电脑力气递增", () => {
    expect(LEVELS[0].aiRate).toBeLessThan(LEVELS[16].aiRate);
    expect(LEVELS[83].aiRate).toBeLessThan(LEVELS[98].aiRate);
  });
});
