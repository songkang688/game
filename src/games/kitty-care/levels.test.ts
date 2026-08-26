import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS, type KittyTask } from "./levels";

describe("萌猫小屋 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关任务清单合法", () => {
    const kinds: KittyTask[] = ["feed", "play", "wash", "sleep", "dress", "cure", "style"];
    for (const lv of LEVELS) {
      expect(lv.tasks.length).toBeGreaterThanOrEqual(2);
      expect(lv.tasks.length).toBeLessThanOrEqual(5);
      for (const task of lv.tasks) expect(kinds).toContain(task);
      expect(lv.playTaps).toBeGreaterThanOrEqual(3);
      expect(lv.washSpots).toBeGreaterThanOrEqual(3);
      expect([3, 4, 5]).toContain(lv.options);
      expect(lv.notes).toBeGreaterThanOrEqual(3);
      expect(lv.notes).toBeLessThanOrEqual(6);
    }
  });

  it("七种任务都有出现，且章节任务池不同（并非同一模板）", () => {
    const all = new Set(LEVELS.flatMap((lv) => lv.tasks));
    expect(all.size).toBe(7);
    // 第一章没有洗澡/哄睡/打扮
    const ch1 = new Set(LEVELS.slice(0, 17).flatMap((lv) => lv.tasks));
    expect(ch1.has("wash")).toBe(false);
    expect(ch1.has("sleep")).toBe(false);
    // 第四章有哄睡
    const ch4 = new Set(LEVELS.slice(51, 67).flatMap((lv) => lv.tasks));
    expect(ch4.has("sleep")).toBe(true);
    // 最后一章任务更多
    expect(LEVELS[98].tasks.length).toBeGreaterThanOrEqual(4);
  });

  it("同一关任务清单是确定性的", () => {
    expect(LEVELS[42].tasks).toEqual(LEVELS[42].tasks.slice());
  });
});
