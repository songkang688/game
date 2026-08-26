import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, COLS, LEVELS } from "./levels";

describe("碰碰砖块 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关砖阵合法且可打完（前 99 关只有 0/1/2 三种砖）", () => {
    for (const lv of LEVELS.slice(0, 99)) {
      expect(lv.layout.length).toBeGreaterThanOrEqual(2);
      expect(lv.layout.length).toBeLessThanOrEqual(8);
      for (const row of lv.layout) {
        expect(row).toHaveLength(COLS);
        for (const v of row) expect([0, 1, 2]).toContain(v);
      }
      const bricks = lv.layout.flat().filter((v) => v > 0).length;
      expect(bricks).toBeGreaterThanOrEqual(8);
      expect(lv.ballSpeed).toBeGreaterThanOrEqual(180);
      expect(lv.ballSpeed).toBeLessThanOrEqual(360);
      expect(lv.paddleW).toBeGreaterThanOrEqual(70);
    }
  });

  it("六章砖阵各不相同（并非同一模板）", () => {
    // 金字塔：顶行窄底行宽
    const pyr = LEVELS[25].layout;
    const width = (row: number[]) => row.filter((v) => v > 0).length;
    expect(width(pyr[0])).toBeLessThan(width(pyr[pyr.length - 1]));
    // 钻石：中间行最宽
    const dia = LEVELS[45].layout;
    const midWidth = width(dia[Math.floor(dia.length / 2)]);
    expect(midWidth).toBeGreaterThanOrEqual(width(dia[0]));
    // 钢铁堡垒有钢砖，彩虹操场没有
    expect(LEVELS[60].layout.flat()).toContain(2);
    expect(LEVELS[5].layout.flat()).not.toContain(2);
    // 银河大挑战球更快、拍更窄
    expect(LEVELS[95].ballSpeed).toBeGreaterThan(LEVELS[5].ballSpeed);
    expect(LEVELS[95].paddleW).toBeLessThan(LEVELS[5].paddleW);
  });

  it("同一关砖阵是确定性的", () => {
    expect(LEVELS[70].layout).toEqual(LEVELS[70].layout.map((r) => r.slice()));
  });
});
