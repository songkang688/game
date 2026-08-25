import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { SINGLE_VOWELS, COMPOUND_VOWELS, buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount } from "./levels";

describe("拼音小火车 99 关", () => {
  it("恰好 99 关", () => {
    expect(LEVELS).toHaveLength(99);
  });

  it("至少 6 个主题章节，章节大小之和为 99", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关题目合法：3 个唯一选项、正确项与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.choices[q.correct]).toBe(q.answer);
      }
    }
  });

  it("单韵母站只考单韵母，复韵母站只考复韵母", () => {
    for (let i = 0; i < 17; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind === "vowel") expect(SINGLE_VOWELS).toContain(q.answer);
      }
    }
    for (let i = 67; i < 83; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind === "vowel") expect(COMPOUND_VOWELS).toContain(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六站题型各有侧重（并非同一模板）", () => {
    const signatures = new Set(
      [2, 19, 36, 52, 68, 85].map((i) => kindPool(i).slice().sort().join(","))
    );
    expect(signatures.size).toBeGreaterThanOrEqual(5);
    expect(kindPool(40)).toContain("match");
    expect(kindPool(55)).toContain("tone");
    expect(kindPool(90)).toContain("syllable");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});
