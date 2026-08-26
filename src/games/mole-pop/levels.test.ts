import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

describe("地鼠嘭嘭 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关参数合法且理论可达", () => {
    for (const lv of LEVELS) {
      expect(lv.upMsMin).toBeGreaterThanOrEqual(350);
      expect(lv.upMsMax).toBeGreaterThan(lv.upMsMin);
      expect(lv.gapMs).toBeGreaterThanOrEqual(300);
      expect(lv.maxConcurrent).toBeGreaterThanOrEqual(1);
      expect(lv.goldChance + lv.bunnyChance + lv.sleepyChance).toBeLessThanOrEqual(0.7);
      // 时长内冒头的地鼠总数必须明显多于目标分（金地鼠还能加倍）
      const spawns = (lv.duration * 1000) / (lv.gapMs + lv.upMsMin) * lv.maxConcurrent;
      expect(spawns * (1 - lv.bunnyChance)).toBeGreaterThan(lv.target);
    }
  });

  it("六章机关各不相同（并非同一模板）", () => {
    expect(LEVELS[5].sleepyChance).toBe(0);
    expect(LEVELS[20].sleepyChance).toBeGreaterThan(0);
    expect(LEVELS[40].upMsMax).toBeLessThan(LEVELS[5].upMsMax);
    expect(LEVELS[55].goldChance).toBeGreaterThan(0);
    expect(LEVELS[70].bunnyChance).toBeGreaterThan(0);
    const last = LEVELS[90];
    expect(last.goldChance).toBeGreaterThan(0);
    expect(last.bunnyChance).toBeGreaterThan(0);
    expect(last.sleepyChance).toBeGreaterThan(0);
  });

  it("章节内目标递增、节奏更快", () => {
    expect(LEVELS[0].target).toBeLessThan(LEVELS[16].target);
    expect(LEVELS[16].gapMs).toBeLessThan(LEVELS[0].gapMs);
    expect(LEVELS[83].target).toBeLessThan(LEVELS[98].target);
  });
});
