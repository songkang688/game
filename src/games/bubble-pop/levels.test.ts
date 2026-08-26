import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, goalSpeechLine } from "./levels";

describe("泡泡噗噗 99 关", () => {
  it("恰好 99 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(99);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法且目标可达", () => {
    for (const lv of LEVELS) {
      expect(lv.rows).toBeGreaterThanOrEqual(8);
      expect(lv.rows).toBeLessThanOrEqual(12);
      expect(lv.colors).toBeGreaterThanOrEqual(3);
      expect(lv.colors).toBeLessThanOrEqual(5);
      // 石头永远敲不掉，所以允许剩下的数量必须比石头多
      expect(lv.maxLeft).toBeGreaterThan(lv.stone);
      expect(lv.rainbow + lv.stone + lv.bolt + lv.frozen).toBeLessThanOrEqual(14);
    }
  });

  it("六章机关互不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return [lv.rainbow > 0, lv.stone > 0, lv.bolt > 0, lv.frozen > 0].map((b) => (b ? 1 : 0)).join("");
    };
    const reps = [5, 25, 42, 58, 74, 90].map(sig);
    expect(new Set(reps).size).toBeGreaterThanOrEqual(5);
  });

  it("章节内目标越来越紧", () => {
    expect(LEVELS[16].maxLeft).toBeLessThanOrEqual(LEVELS[0].maxLeft);
    expect(LEVELS[98].maxLeft).toBeLessThanOrEqual(LEVELS[83].maxLeft);
  });

  it("进关朗读句：目标必念，机关按配置用中文名字念出来", () => {
    const first = goalSpeechLine(LEVELS[0]);
    expect(first).toContain(`不超过 ${LEVELS[0].maxLeft} 个`);
    expect(first).not.toContain("彩虹");
    // 彩虹湾要念彩虹玩法，石头滩要念石头，冻冻港要念解冻
    expect(goalSpeechLine(LEVELS[25])).toContain("彩虹泡泡");
    expect(goalSpeechLine(LEVELS[42])).toContain("石头");
    expect(goalSpeechLine(LEVELS[74])).toContain("解冻");
  });
});
