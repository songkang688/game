import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_TILES } from "./levels";

describe("拼图乐园 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关板式合法、素材够用", () => {
    for (const lv of LEVELS) {
      expect(lv.rows).toBeGreaterThanOrEqual(3);
      expect(lv.cols).toBeGreaterThanOrEqual(3);
      // 拼块数 = 格子数 - 1，主题素材必须够
      expect(lv.rows * lv.cols - 1).toBeLessThanOrEqual(THEME_TILES[lv.theme].length);
      expect(lv.moveLimit).toBeGreaterThan(lv.two);
      expect(lv.two).toBeGreaterThan(lv.three);
      expect(lv.hints).toBeGreaterThanOrEqual(3);
    }
  });

  it("四种板式与记忆模式都有（并非同一模板）", () => {
    const shapes = new Set(LEVELS.map((l) => `${l.rows}x${l.cols}`));
    expect(shapes.has("3x3")).toBe(true);
    expect(shapes.has("3x4")).toBe(true);
    expect(shapes.has("4x4")).toBe(true);
    expect(LEVELS.some((l) => l.hidePreview)).toBe(true);
    expect(LEVELS[55].hidePreview).toBe(true);
    expect(LEVELS[70].rows * LEVELS[70].cols).toBe(16);
  });

  it("章节内打乱步数递增", () => {
    expect(LEVELS[0].shuffleSteps).toBeLessThan(LEVELS[16].shuffleSteps);
    expect(LEVELS[83].shuffleSteps).toBeLessThan(LEVELS[98].shuffleSteps);
  });

  it("六套主题素材至少 15 块且不重样", () => {
    expect(THEME_TILES).toHaveLength(6);
    for (const pool of THEME_TILES) {
      expect(pool.length).toBeGreaterThanOrEqual(15);
      expect(new Set(pool.map((p) => p.emoji)).size).toBe(pool.length);
    }
  });
});
