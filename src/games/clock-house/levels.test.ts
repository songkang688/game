import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { allowedQuarters, buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount } from "./levels";

describe("时钟小屋 99 关", () => {
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
        expect(q.choices[q.correct]).toContain(q.answer);
      }
    }
  });

  it("整点钟楼只考整点，之后逐章加入半点、1 刻、3 刻", () => {
    expect(allowedQuarters(0)).toEqual([0]);
    expect(allowedQuarters(20)).toContain(2);
    expect(allowedQuarters(40)).toContain(1);
    expect(allowedQuarters(60)).toContain(3);
    for (let i = 0; i < 17; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind === "read") {
          expect(q.answer).not.toContain("半");
          expect(q.answer).not.toContain("刻");
        }
      }
    }
  });

  it("认钟面题答案与钟面 data 属性一致", () => {
    for (const i of [0, 20, 40, 60, 80, 98]) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "read") continue;
        const m = q.promptHTML.match(/data-h="(\d+)" data-q="(\d)"/);
        expect(m).not.toBeNull();
        const h = Number(m![1]);
        const qt = Number(m![2]);
        const expected = qt === 0 ? `${h} 点` : qt === 1 ? `${h} 点 1 刻` : qt === 2 ? `${h} 点半` : `${h} 点 3 刻`;
        expect(q.answer).toBe(expected);
      }
    }
  });

  it("再过几小时题算术正确", () => {
    let seen = 0;
    for (let i = 83; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "next") continue;
        seen++;
        const m = q.ask.match(/现在是 (\d+) 点，再过 (\d+) 小时/);
        expect(m).not.toBeNull();
        let after = Number(m![1]) + Number(m![2]);
        if (after > 12) after -= 12;
        expect(q.answer).toBe(`${after} 点`);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("抽 20+ 题机器校验：认钟/拨针/推理时刻全对、引导语口语化（≤15 个汉字）", () => {
    const fmt = (h: number, qt: number) =>
      qt === 0 ? `${h} 点` : qt === 1 ? `${h} 点 1 刻` : qt === 2 ? `${h} 点半` : `${h} 点 3 刻`;
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      if (q.kind === "read") {
        const m = q.promptHTML.match(/data-h="(\d+)" data-q="(\d)"/);
        expect(m).not.toBeNull();
        expect(q.answer).toBe(fmt(Number(m![1]), Number(m![2])));
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "set") {
        const label = q.ask.match(/「(.+)」/)![1];
        const cm = q.choices[q.correct].match(/data-h="(\d+)" data-q="(\d)"/);
        expect(cm).not.toBeNull();
        expect(fmt(Number(cm![1]), Number(cm![2]))).toBe(label);
      } else {
        const m = q.ask.match(/现在是 (\d+) 点，再过 (\d+) 小时/);
        expect(m).not.toBeNull();
        let after = Number(m![1]) + Number(m![2]);
        if (after > 12) after -= 12;
        expect(q.answer).toBe(`${after} 点`);
        expect(q.choices[q.correct]).toBe(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六层玩法各有侧重（并非同一模板）", () => {
    // 前四章都是认钟面，但允许的分钟类型不同；后两章加入拨针与推理
    const sigs = new Set(
      [2, 19, 36, 52, 68, 90].map((i) => `${kindPool(i).join(",")}|${allowedQuarters(i).slice().sort().join("")}`)
    );
    expect(sigs.size).toBeGreaterThanOrEqual(6);
    expect(kindPool(70)).toContain("set");
    expect(kindPool(95)).toContain("next");
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});
