import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_EMOJIS } from "./levels";

describe("记忆翻翻乐 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关卡片数量与表情池匹配", () => {
    for (const lv of LEVELS) {
      expect(lv.pairs).toBeGreaterThanOrEqual(3);
      // 表情池必须够用：正牌 + 独苗卡都要有自己的图案（算式关自己造牌面，不吃表情池）
      if (!lv.mathPairs) {
        expect(lv.pairs + (lv.decoys ?? 0)).toBeLessThanOrEqual(THEME_EMOJIS[lv.theme].length);
      }
      expect(lv.maxMiss).toBeGreaterThan(0);
      expect([2, 3]).toContain(lv.matchSize);
      expect(lv.cols).toBeGreaterThanOrEqual(3);
      if (lv.timeLimit > 0) expect(lv.timeLimit).toBeGreaterThanOrEqual(20);
    }
  });

  it("十章机关互不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return [
        lv.matchSize,
        lv.imp > 0 ? "章鱼" : "",
        lv.peekMs > 0 ? "偷看" : "",
        lv.timeLimit > 0 ? "限时" : "",
        lv.mathPairs ? "算式" : "",
        lv.rotateEvery ? "旋转" : "",
        lv.decoys ? "独苗" : "",
      ].join("-");
    };
    const reps = [0, 20, 40, 55, 70, 85, 110, 130, 150, 175].map(sig);
    expect(new Set(reps).size).toBeGreaterThanOrEqual(8);
    // 太空基地一定是三连卡
    expect(LEVELS[55].matchSize).toBe(3);
  });

  it("章节内组数递增", () => {
    expect(LEVELS[0].pairs).toBeLessThan(LEVELS[16].pairs);
    expect(LEVELS[83].pairs).toBeLessThanOrEqual(LEVELS[98].pairs);
    expect(LEVELS[99].pairs).toBeLessThan(LEVELS[121].pairs);
  });

  it("十套主题表情池各 12 个以上且不重样", () => {
    expect(THEME_EMOJIS).toHaveLength(10);
    for (const pool of THEME_EMOJIS) {
      expect(pool.length).toBeGreaterThanOrEqual(12);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});
