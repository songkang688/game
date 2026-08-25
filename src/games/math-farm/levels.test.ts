import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount } from "./levels";

describe("算数小农场 99 关", () => {
  it("恰好 99 关", () => {
    expect(LEVELS).toHaveLength(99);
  });

  it("至少 6 个主题章节，章节大小之和为 99", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("每关题目合法：选项唯一、正确项存在且与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      expect(qs.length).toBeGreaterThanOrEqual(4);
      expect(qs.length).toBeLessThanOrEqual(7);
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.choices.length);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      }
    }
  });

  it("算式题结果正确且不超过一年级范围（0..20）", () => {
    for (let i = 0; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (typeof q.answer !== "number") continue;
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(20);
        // 纯算式题（加/减/连算）能从题面直接验算
        const m = q.promptHTML.match(/^(\d+) ([+-]) (\d+)(?: ([+-]) (\d+))? = \?$/);
        if (m) {
          let v = m[2] === "+" ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
          if (m[4]) v = m[4] === "+" ? v + Number(m[5]) : v - Number(m[5]);
          expect(v).toBe(q.answer);
        }
      }
    }
  });

  it("抽 20+ 题机器校验：答案可从题面验算、引导语口语化（≤15 个汉字）", () => {
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    const kindsSeen = new Set(qs.map((q) => q.kind));
    expect(kindsSeen.size).toBeGreaterThanOrEqual(4);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      const text = q.promptHTML.replace(/<[^>]+>/g, "");
      if (q.kind === "count") {
        expect(text.trim().split(/\s+/)).toHaveLength(q.answer as number);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else if (q.kind === "add" || q.kind === "sub" || q.kind === "chain") {
        const m = text.match(/^(\d+) ([+-]) (\d+)(?: ([+-]) (\d+))? = \?$/);
        expect(m).not.toBeNull();
        let v = m![2] === "+" ? Number(m![1]) + Number(m![3]) : Number(m![1]) - Number(m![3]);
        if (m![4]) v = m![4] === "+" ? v + Number(m![5]) : v - Number(m![5]);
        expect(v).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else if (q.kind === "missing") {
        const m = text.match(/^(\d+|⬜) ([+-]) (\d+|⬜) = (\d+)$/);
        expect(m).not.toBeNull();
        const fill = (s: string) => (s === "⬜" ? Number(q.answer) : Number(s));
        const left = m![2] === "+" ? fill(m![1]) + fill(m![3]) : fill(m![1]) - fill(m![3]);
        expect(left).toBe(Number(m![4]));
        expect(q.choices[q.correct]).toBe(String(q.answer));
      } else {
        // compare：左边是数或算式，右边是数，符号必须判断正确
        const m = text.match(/^(.+) ○ (\d+)$/);
        expect(m).not.toBeNull();
        const lm = m![1].match(/^(\d+)(?: ([+-]) (\d+))?$/);
        expect(lm).not.toBeNull();
        let left = Number(lm![1]);
        if (lm![2]) left = lm![2] === "+" ? left + Number(lm![3]) : left - Number(lm![3]);
        const right = Number(m![2]);
        const sym = left > right ? "＞" : left < right ? "＜" : "＝";
        expect(q.answer).toBe(sym);
        expect(q.choices[q.correct]).toBe(sym);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 17, 40, 66, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六章题型各有侧重（并非同一模板）", () => {
    const sig = (i: number) => kindPool(i).slice().sort().join(",");
    const signatures = new Set([sig(2), sig(19), sig(36), sig(52), sig(68), sig(85)]);
    expect(signatures.size).toBeGreaterThanOrEqual(5);
    // 首章从数一数起步，末章有连加连减
    expect(kindPool(0)).toContain("count");
    expect(kindPool(98)).toContain("chain");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});
