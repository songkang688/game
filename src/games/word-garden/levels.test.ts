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

describe("识字小花园 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
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
    for (let i = 0; i < 188; i++) {
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

  it("抽 20+ 题机器校验：字-图-音-词配对正确、引导语口语化（≤15 个汉字）", () => {
    const ALL_CARDS = CHAPTER_POOLS.flat();
    const NUM_VALUE: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      if (q.kind === "pic2char") {
        const card = ALL_CARDS.find((c) => c.char === q.answer && q.promptHTML.includes(c.emoji));
        expect(card).toBeDefined();
        expect(q.ask).toContain(card!.word);
        expect(q.choices[q.correct]).toBe(card!.char);
      } else if (q.kind === "char2pic") {
        const card = ALL_CARDS.find((c) => c.char === q.promptHTML);
        expect(card).toBeDefined();
        expect(q.answer).toBe(card!.emoji);
        expect(q.choices[q.correct]).toContain(card!.emoji);
      } else if (q.kind === "py2char") {
        const card = ALL_CARDS.find((c) => c.char === q.answer && q.promptHTML.includes(c.pinyin));
        expect(card).toBeDefined();
        expect(q.choices[q.correct]).toBe(card!.char);
      } else if (q.kind === "char2word") {
        const char = q.promptHTML.trim().slice(-1);
        const card = ALL_CARDS.find((c) => c.char === char);
        expect(card).toBeDefined();
        expect(q.answer).toBe(card!.word);
        expect(q.choices[q.correct]).toBe(card!.word);
      } else {
        // count：图里的个数 = 汉字数字的数值
        const n = NUM_VALUE[q.answer];
        expect(n).toBeGreaterThanOrEqual(1);
        const strip = q.promptHTML.replace(/<[^>]+>/g, "").trim();
        expect(strip.split(/\s+/)).toHaveLength(n);
        expect(q.choices[q.correct]).toBe(q.answer);
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
