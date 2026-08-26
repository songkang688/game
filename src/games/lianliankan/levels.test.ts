import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_EMOJIS, goalSpeechLine } from "./levels";

describe("连连看 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关棋盘合法：格子数为偶数、图案够用", () => {
    for (const lv of LEVELS) {
      expect((lv.rows * lv.cols) % 2).toBe(0);
      expect(lv.kinds).toBeLessThanOrEqual(THEME_EMOJIS[lv.theme].length);
      expect(lv.kinds).toBeGreaterThanOrEqual(4);
      expect(lv.seconds).toBeGreaterThanOrEqual(60);
      expect(lv.shuffles).toBeGreaterThanOrEqual(1);
    }
  });

  it("三种重力玩法都有出现（并非同一模板）", () => {
    const gravities = new Set(LEVELS.map((lv) => lv.gravity));
    expect(gravities.has("none")).toBe(true);
    expect(gravities.has("down")).toBe(true);
    expect(gravities.has("left")).toBe(true);
    // 玩具馆整章下落、海洋馆整章左滑
    expect(LEVELS[40].gravity).toBe("down");
    expect(LEVELS[55].gravity).toBe("left");
  });

  it("六套主题图案互不重复", () => {
    expect(THEME_EMOJIS).toHaveLength(6);
    for (const pool of THEME_EMOJIS) {
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.length).toBeGreaterThanOrEqual(14);
    }
  });

  it("章节内棋盘或图案递增", () => {
    expect(LEVELS[0].kinds).toBeLessThan(LEVELS[16].kinds);
    expect(LEVELS[83].kinds).toBeLessThanOrEqual(LEVELS[98].kinds);
  });

  it("进关朗读句：念倒计时目标，重力机关按配置提醒", () => {
    for (const lv of LEVELS) {
      const line = goalSpeechLine(lv);
      expect(line).toContain(`${lv.seconds} 秒`);
      if (lv.gravity === "down") expect(line).toContain("掉下来");
      if (lv.gravity === "left") expect(line).toContain("向左滑");
      if (lv.gravity === "none") expect(line).not.toContain("小心");
    }
  });
});
