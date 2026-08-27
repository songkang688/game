import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { ALL_PAINTS, buildLevel, CHAPTERS, LEVELS, MIX_TABLE, PICTURES } from "./levels";

describe("涂色小屋 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188；线稿至少一章一幅（1.2 起共 16 幅）", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(PICTURES.length).toBeGreaterThanOrEqual(CHAPTERS.length);
    expect(PICTURES).toHaveLength(16);
    for (const p of PICTURES) {
      expect(p.regions.length).toBeGreaterThanOrEqual(8);
      expect(new Set(p.regions.map((r) => r.id)).size).toBe(p.regions.length);
    }
  });

  it("每关任务合法：区域存在、颜色可得、任务不重复", () => {
    for (let i = 0; i < 188; i++) {
      const lv = LEVELS[i];
      const pic = PICTURES[lv.pic];
      const regionIds = new Set(pic.regions.map((r) => r.id));
      expect(lv.tasks.length).toBeGreaterThanOrEqual(4);
      expect(new Set(lv.tasks.map((k) => k.region)).size).toBe(lv.tasks.length);
      for (const k of lv.tasks) {
        expect(regionIds.has(k.region)).toBe(true);
        expect(ALL_PAINTS[k.color]).toBeDefined();
        // 每种任务颜色要么直接在调色盘里，要么能调出来
        expect(lv.palette.includes(k.color) || lv.needMix.includes(k.color)).toBe(true);
      }
      // 需调的颜色必须真的有配方
      for (const c of lv.needMix) {
        expect(Object.values(MIX_TABLE)).toContain(c);
        expect(lv.palette).not.toContain(c);
      }
      expect(lv.maxWrong).toBeGreaterThanOrEqual(3);
    }
  });

  it("同一关重试布局一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildLevel(i))).toBe(JSON.stringify(buildLevel(i)));
    }
  });

  it("六章玩法各不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.pic}|${lv.mode}|${lv.needMix.length > 3 ? "深" : ""}`;
    };
    const sigs = new Set([sig(2), sig(19), sig(36), sig(52), sig(68), sig(95)]);
    expect(sigs.size).toBe(6);
    expect(LEVELS[40].mode).toBe("mix");
    expect(LEVELS[55].mode).toBe("number");
    expect(LEVELS[75].needMix.some((c) => ["深红", "金黄", "深蓝"].includes(c))).toBe(true);
    expect(LEVELS[95].mode).toBe("memory");
    expect(LEVELS[95].previewMs).toBeGreaterThan(0);
  });

  it("难度递进：任务变多、容错变少、记忆预览变短", () => {
    expect(LEVELS[0].tasks.length).toBeLessThan(LEVELS[16].tasks.length);
    expect(LEVELS[0].maxWrong).toBeGreaterThanOrEqual(LEVELS[98].maxWrong);
    expect(LEVELS[98].previewMs).toBeLessThan(LEVELS[83].previewMs);
  });
});
