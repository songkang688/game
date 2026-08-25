import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { INITIALS, SYLLABLE_CARDS, TONE_MARKS, TONE_NAMES, VOWELS } from "./logic";
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

  it("抽 20+ 题机器校验：声母/韵母/声调/音节全对、引导语口语化（≤15 个汉字）", () => {
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      expect(q.choices[q.correct]).toBe(q.answer);
      if (q.kind === "vowel") {
        expect(VOWELS).toContain(q.answer);
        for (const c of q.choices) if (c !== q.answer) expect(INITIALS).toContain(c);
      } else if (q.kind === "initial") {
        expect(INITIALS).toContain(q.answer);
        for (const c of q.choices) if (c !== q.answer) expect(VOWELS).toContain(c);
      } else if (q.kind === "match") {
        expect(q.answer).toBe(q.promptHTML);
      } else if (q.kind === "tone") {
        const m = q.ask.match(/「(.+)」的(第[一二三四]声)/);
        expect(m).not.toBeNull();
        const idx = TONE_NAMES.indexOf(m![2]);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBe(TONE_MARKS[m![1]][idx]);
      } else {
        const m = q.ask.match(/「(.+)」的拼音/);
        expect(m).not.toBeNull();
        const card = SYLLABLE_CARDS.find((c) => c.word === m![1]);
        expect(card).toBeDefined();
        expect(q.answer).toBe(card!.pinyin);
        expect(q.promptHTML).toContain(card!.emoji);
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
