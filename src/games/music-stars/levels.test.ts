import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { TWINKLE_FINALE } from "./logic";
import { buildMelodies, CHAPTERS, LEVELS } from "./levels";

describe("音乐星星 99 关", () => {
  it("恰好 99 关", () => {
    expect(LEVELS).toHaveLength(99);
  });

  it("至少 6 个主题章节，章节大小之和为 99", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关参数合法且旋律可弹", () => {
    for (let i = 0; i < 99; i++) {
      const lv = LEVELS[i];
      expect(lv.starCount).toBeGreaterThanOrEqual(3);
      expect(lv.starCount).toBeLessThanOrEqual(5);
      expect(lv.seqLen).toBeGreaterThanOrEqual(3);
      expect(lv.seqLen).toBeLessThanOrEqual(8);
      expect(lv.rounds).toBeGreaterThanOrEqual(2);
      expect(lv.rounds).toBeLessThanOrEqual(4);
      expect(lv.noteMs).toBeGreaterThanOrEqual(380);
      expect(lv.noteMs).toBeLessThanOrEqual(900);
      expect(lv.maxMiss).toBeGreaterThanOrEqual(3);
      const melodies = buildMelodies(i);
      expect(melodies.length).toBe(lv.rounds + (lv.finale ? 1 : 0));
      for (let m = 0; m < lv.rounds; m++) {
        expect(melodies[m]).toHaveLength(lv.seqLen);
        for (const note of melodies[m]) {
          expect(note).toBeGreaterThanOrEqual(0);
          expect(note).toBeLessThan(lv.starCount);
        }
      }
    }
  });

  it("同一关重试旋律一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildMelodies(i))).toBe(JSON.stringify(buildMelodies(i)));
    }
  });

  it("六章玩法各不相同（并非同一模板）", () => {
    const sig = (i: number) => {
      const lv = LEVELS[i];
      return `${lv.starCount}|${lv.replays}|${lv.noteMs < 600 ? "快" : "慢"}|${lv.finale ? "终曲" : ""}`;
    };
    const sigs = new Set([sig(2), sig(19), sig(36), sig(52), sig(68), sig(95)]);
    expect(sigs.size).toBeGreaterThanOrEqual(5);
    // 回声森林限制重听次数；星光音乐会末段有终曲
    expect(LEVELS[55].replays).toBe(1);
    expect(LEVELS[98].finale).toBe(true);
    expect(buildMelodies(98).at(-1)).toEqual(TWINKLE_FINALE);
  });

  it("难度递进：首章乐句短、末章乐句长", () => {
    expect(LEVELS[0].seqLen).toBeLessThan(LEVELS[98].seqLen);
    expect(LEVELS[0].starCount).toBeLessThan(LEVELS[40].starCount);
    // 闪电章节越弹越快
    expect(LEVELS[82].noteMs).toBeLessThan(LEVELS[67].noteMs);
  });
});
