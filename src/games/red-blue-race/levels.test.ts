import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, TRACK_LEN } from "./levels";

describe("红蓝赛跑 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法、机关在赛道内", () => {
    for (const lv of LEVELS) {
      expect(lv.aiSpeed).toBeGreaterThan(5);
      expect(lv.aiSpeed).toBeLessThan(20);
      expect(lv.tapStep).toBeGreaterThan(0);
      for (const ob of lv.obstacles) {
        expect(ob.pos).toBeGreaterThanOrEqual(10);
        expect(ob.pos + ob.len).toBeLessThanOrEqual(TRACK_LEN);
      }
      // 机关之间不重叠
      const sorted = [...lv.obstacles].sort((a, b) => a.pos - b.pos);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].pos).toBeGreaterThanOrEqual(sorted[i - 1].pos + 4);
      }
    }
  });

  it("六章赛道机关各不相同（并非同一模板）", () => {
    const typesAt = (i: number) => new Set(LEVELS[i].obstacles.map((o) => o.type));
    expect(LEVELS[5].obstacles).toHaveLength(0);
    expect(typesAt(25).has("puddle")).toBe(true);
    expect(typesAt(45).has("hurdle")).toBe(true);
    expect(typesAt(60).has("hill")).toBe(true);
    expect(typesAt(75).has("star")).toBe(true);
    // 冠军巡回混合多种机关
    expect(typesAt(95).size).toBeGreaterThanOrEqual(3);
  });

  it("电脑速度随章节递增", () => {
    expect(LEVELS[0].aiSpeed).toBeLessThan(LEVELS[16].aiSpeed);
    expect(LEVELS[0].aiSpeed).toBeLessThan(LEVELS[98].aiSpeed);
  });
});
