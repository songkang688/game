import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

describe("气球砰砰 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(188);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关参数合法", () => {
    for (const lv of LEVELS) {
      expect(lv.target).toBeGreaterThanOrEqual(8);
      expect(lv.escapes).toBeGreaterThanOrEqual(3);
      expect(lv.spawnMs).toBeGreaterThanOrEqual(450);
      expect(lv.riseSpeed).toBeGreaterThan(30);
      expect(lv.riseSpeed).toBeLessThan(200);
      expect(lv.cloudChance + lv.rainbowChance).toBeLessThanOrEqual(0.4);
    }
  });

  it("前 99 关的三种玩法模式与机关分布正确（并非同一模板）", () => {
    expect(LEVELS[5].mode).toBe("free");
    expect(LEVELS[20].mode).toBe("color");
    expect(LEVELS[40].mode).toBe("number");
    expect(LEVELS[55].cloudChance).toBeGreaterThan(0);
    expect(LEVELS[70].rainbowChance).toBeGreaterThan(0);
    expect(LEVELS[90].night).toBe(true);
    const modes = new Set(LEVELS.slice(0, 99).map((l) => l.mode));
    expect(modes.size).toBe(3);
  });

  it("章节内难度递进", () => {
    expect(LEVELS[0].target).toBeLessThan(LEVELS[16].target);
    expect(LEVELS[0].riseSpeed).toBeLessThan(LEVELS[16].riseSpeed);
    expect(LEVELS[67].riseSpeed).toBeLessThan(LEVELS[82].riseSpeed);
  });
});
