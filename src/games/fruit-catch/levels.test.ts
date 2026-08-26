import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_SETS } from "./levels";

describe("接住小水果 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关参数合法", () => {
    for (const lv of LEVELS) {
      expect(lv.target).toBeGreaterThanOrEqual(8);
      expect(lv.target).toBeLessThanOrEqual(40);
      expect(lv.spawnMs).toBeGreaterThanOrEqual(450);
      expect(lv.badChance).toBeLessThanOrEqual(0.3);
      expect(lv.badChance + lv.goldChance).toBeLessThan(0.5);
      expect(lv.theme).toBeGreaterThanOrEqual(0);
      expect(lv.theme).toBeLessThan(THEME_SETS.length);
    }
  });

  it("六章天气机关各不相同（并非同一模板）", () => {
    // 第一章无炸弹，第二章有炸弹
    expect(LEVELS[0].badChance).toBe(0);
    expect(LEVELS[20].badChance).toBeGreaterThan(0);
    // 大风天有风，其他早期章节无风
    expect(LEVELS[55].wind).toBeGreaterThan(0);
    expect(LEVELS[0].wind).toBe(0);
    // 金色午后金星概率更高
    expect(LEVELS[40].goldChance).toBeGreaterThan(LEVELS[0].goldChance);
    // 前 99 关六个主题都有覆盖
    expect(new Set(LEVELS.slice(0, 99).map((l) => l.theme)).size).toBe(6);
  });

  it("章节内目标与速度递增", () => {
    expect(LEVELS[0].target).toBeLessThan(LEVELS[16].target);
    expect(LEVELS[0].speed).toBeLessThan(LEVELS[16].speed);
    expect(LEVELS[83].target).toBeLessThan(LEVELS[98].target);
  });
});
