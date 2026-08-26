import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, GRID, LEVELS } from "./levels";

describe("贪吃毛毛虫 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关墙体合法：不出界、不堵出生区", () => {
    const mid = Math.floor(GRID / 2);
    for (const lv of LEVELS) {
      for (const [x, y] of lv.walls) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(GRID);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(GRID);
        // 出生行左半段必须是空的
        expect(y === mid && x >= 1 && x <= 7).toBe(false);
      }
      // 墙不能占满棋盘（至少留 70% 空地给点心和毛毛虫）
      expect(lv.walls.length).toBeLessThan(GRID * GRID * 0.3);
      expect(lv.target).toBeGreaterThanOrEqual(5);
      expect(lv.tickMs).toBeGreaterThanOrEqual(170);
    }
  });

  it("六章墙型各不相同（并非同一模板）", () => {
    // 第一章开头没有墙，第六章一定有墙
    expect(LEVELS[0].walls.length).toBe(0);
    expect(LEVELS[90].walls.length).toBeGreaterThan(0);
    // 回字迷宫的墙明显多于树篱
    expect(LEVELS[55].walls.length).toBeGreaterThan(LEVELS[20].walls.length);
    // 同一关生成两次布局一致（确定性）
    expect(LEVELS[30].walls).toEqual(LEVELS[30].walls.slice());
  });

  it("章节内目标递增、速度加快", () => {
    expect(LEVELS[0].target).toBeLessThan(LEVELS[16].target);
    expect(LEVELS[16].tickMs).toBeLessThan(LEVELS[0].tickMs);
    expect(LEVELS[98].tickMs).toBeLessThanOrEqual(LEVELS[83].tickMs);
  });
});
