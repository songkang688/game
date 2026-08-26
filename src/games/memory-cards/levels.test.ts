import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, THEME_EMOJIS, goalSpeechLine } from "./levels";

describe("记忆翻翻乐 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关卡片数量与表情池匹配", () => {
    for (const lv of LEVELS) {
      expect(lv.pairs).toBeGreaterThanOrEqual(3);
      // 表情池必须够用
      expect(lv.pairs).toBeLessThanOrEqual(THEME_EMOJIS[lv.theme].length);
      expect(lv.maxMiss).toBeGreaterThan(0);
      expect([2, 3]).toContain(lv.matchSize);
      expect(lv.cols).toBeGreaterThanOrEqual(3);
      if (lv.timeLimit > 0) expect(lv.timeLimit).toBeGreaterThanOrEqual(20);
    }
  });

  it("六章机关互不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.matchSize}-${lv.imp > 0 ? "章鱼" : ""}${lv.peekMs > 0 ? "偷看" : ""}${lv.timeLimit > 0 ? "限时" : ""}`;
    };
    const reps = [0, 20, 40, 55, 70, 85].map(sig);
    expect(new Set(reps).size).toBeGreaterThanOrEqual(5);
    // 太空基地一定是三连卡
    expect(LEVELS[55].matchSize).toBe(3);
  });

  it("章节内组数递增", () => {
    expect(LEVELS[0].pairs).toBeLessThan(LEVELS[16].pairs);
    expect(LEVELS[83].pairs).toBeLessThanOrEqual(LEVELS[98].pairs);
  });

  it("六套主题表情池各 12 个且不重样", () => {
    expect(THEME_EMOJIS).toHaveLength(6);
    for (const pool of THEME_EMOJIS) {
      expect(pool.length).toBeGreaterThanOrEqual(12);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("进关朗读句：组数必念，偷看/章鱼/倒计时按配置追加", () => {
    for (const lv of LEVELS) {
      const line = goalSpeechLine(lv);
      expect(line).toContain(`${lv.pairs} ${lv.matchSize === 3 ? "组" : "对"}`);
      if (lv.peekMs > 0) expect(line).toContain("偷看");
      if (lv.imp > 0) expect(line).toContain("章鱼");
      if (lv.timeLimit > 0) expect(line).toContain(`${lv.timeLimit} 秒`);
    }
  });
});
