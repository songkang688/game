import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import {
  buildQuestions,
  CHAPTER_POOLS,
  CHAPTERS,
  FAMILY_CARDS,
  FOOD_CARDS,
  kindPool,
  LEVELS,
  NUMBER_CARDS,
  questionCount,
} from "./levels";

describe("识字小花园 99 关", () => {
  it("恰好 99 关", () => {
    expect(LEVELS).toHaveLength(99);
  });

  it("至少 6 个主题章节，章节大小之和为 99", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("新字库字段齐全且单字不重复", () => {
    for (const bank of [NUMBER_CARDS, FAMILY_CARDS, FOOD_CARDS]) {
      expect(new Set(bank.map((c) => c.char)).size).toBe(bank.length);
      for (const c of bank) {
        expect(c.char).toHaveLength(1);
        expect(c.pinyin.length).toBeGreaterThan(0);
        expect(c.word.length).toBeGreaterThan(0);
        expect(c.emoji.length).toBeGreaterThan(0);
      }
    }
    // 六章池子都够出 3 选 1 的题
    for (const pool of CHAPTER_POOLS) {
      expect(pool.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("每关题目合法：3 个唯一选项、正确项与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct]).toContain(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六章题型与字库各不相同（并非同一模板）", () => {
    const signatures = new Set(
      [2, 19, 36, 52, 68, 85].map((i) => kindPool(i).slice().sort().join(","))
    );
    expect(signatures.size).toBeGreaterThanOrEqual(5);
    // 数字章有数一数题型，亲亲花园有组词题型
    expect(kindPool(52)).toContain("count");
    expect(kindPool(75)).toContain("char2word");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});
