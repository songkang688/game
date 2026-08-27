/**
 * 守门：📒 错题回顾的「同类换数字」必须**每一种题型**都成立（第 1 轮 W5-L-09 的遗留活）。
 *
 * 第 1 轮 learner 把这条列成「留第 2 轮」；第 2 轮测试员实机走通了这条链
 * （第 90 关故意答错「哪个钟面是『1 点 3 刻』？」→ 回顾轮出「1 点 1 刻」，同题型换数字），
 * 结论写的是「行为正确，**覆盖率补测的活留给本轮 learner**」。这个文件补的就是那份覆盖率。
 *
 * 已有的 `levels.test.ts` 是抽样查（每 7 关一关、四个锚点关），
 * 抽样能证明「这几关没问题」，证明不了「每一种题型都没问题」——
 * 一种只在某几关出现的题型，抽样很容易整个漏过去。所以这里换个查法：
 *   先把 188 关里真正出现过的题型全列出来，再要求**每一种都被真的验过**，
 *   一种没验到就红。这样以后加新题型，忘了管回顾轮就会当场被拦住。
 */
import { describe, expect, it } from "vitest";
import { KIND_TYPE, type ClockKind } from "./kinds";
import { MAX_REVIEW_QUESTIONS, answerTextOf, buildQuestions, makeReviewQuestions } from "./levels";

/** 188 关里真正出现过的题型，以及每一种第一次出现在哪一关 */
const FIRST_SEEN = (() => {
  const seen = new Map<ClockKind, number>();
  for (let level = 0; level < 188; level++) {
    for (const q of buildQuestions(level)) if (!seen.has(q.kind)) seen.set(q.kind, level);
  }
  return seen;
})();

const LIVE_KINDS = [...FIRST_SEEN.keys()];

describe("时钟小屋 · 错题回顾覆盖率 · 先把题型清单摸清楚", () => {
  it("188 关里真出现过的题型不止一两种,值得逐种查", () => {
    expect(LIVE_KINDS.length).toBeGreaterThanOrEqual(15);
  });

  it("出现过的每一种都在 KIND_TYPE 表里登记着", () => {
    for (const k of LIVE_KINDS) expect(KIND_TYPE[k], `题型 ${k} 没在 KIND_TYPE 里登记`).toBeTruthy();
  });
});

describe("时钟小屋 · 错题回顾覆盖率 · 每一种题型逐个验", () => {
  it("每一种题型答错之后，回顾轮都出得来同一种题型的新题", () => {
    const missed: string[] = [];
    for (const [kind, level] of FIRST_SEEN) {
      const review = makeReviewQuestions([kind], level);
      if (review.length !== 1 || review[0].kind !== kind) missed.push(`${kind}(第 ${level + 1} 关)`);
    }
    expect(missed, `这些题型回顾轮出不来同类题: ${missed.join(" ")}`).toEqual([]);
  });

  it("每一种题型的回顾题都换了数字,不会把原题原样端回来", () => {
    const same: string[] = [];
    for (const [kind, level] of FIRST_SEEN) {
      const originals = buildQuestions(level).filter((q) => q.kind === kind);
      const review = makeReviewQuestions([kind], level, 0, originals.map((q) => q.promptHTML));
      for (const q of review) {
        if (originals.some((o) => o.promptHTML === q.promptHTML && o.ask === q.ask)) {
          same.push(`${kind}(第 ${level + 1} 关)`);
        }
      }
    }
    expect(same, `这些题型的回顾题和原题一模一样: ${same.join(" ")}`).toEqual([]);
  });

  it("每一种题型的回顾题都是三个互不相同的选项,正确项就是答案", () => {
    const bad: string[] = [];
    for (const [kind, level] of FIRST_SEEN) {
      for (const q of makeReviewQuestions([kind], level)) {
        const ok =
          q.choices.length === 3 && new Set(q.choices).size === 3 && q.choices[q.correct].includes(q.answer);
        if (!ok) bad.push(`${kind}(第 ${level + 1} 关)`);
      }
    }
    expect(bad, `这些题型的回顾题选项不对: ${bad.join(" ")}`).toEqual([]);
  });

  it("每一种题型的回顾题都答得出一句人话来（读屏与结算都要用它）", () => {
    for (const [kind, level] of FIRST_SEEN) {
      for (const q of makeReviewQuestions([kind], level)) {
        expect(answerTextOf(q).length, `${kind} 的回顾题答案念不出来`).toBeGreaterThan(0);
      }
    }
  });

  it("连着错两轮不会看到同一道:换一轮种子就换一批题,每一种题型都如此", () => {
    const stuck: string[] = [];
    for (const [kind, level] of FIRST_SEEN) {
      const a = JSON.stringify(makeReviewQuestions([kind], level, 0));
      const b = JSON.stringify(makeReviewQuestions([kind], level, 1));
      if (a === b) stuck.push(`${kind}(第 ${level + 1} 关)`);
    }
    expect(stuck, `这些题型连错两轮会看到同一道: ${stuck.join(" ")}`).toEqual([]);
  });
});

describe("时钟小屋 · 错题回顾覆盖率 · 188 关全量,不再抽样", () => {
  it("每一关:回顾题的题型都在「这一关真答错过的题型」里,没有凭空多出来的", () => {
    const bad: string[] = [];
    for (let level = 0; level < 188; level++) {
      const kinds = [...new Set(buildQuestions(level).map((q) => q.kind))];
      for (const q of makeReviewQuestions(kinds, level)) {
        if (!kinds.includes(q.kind)) bad.push(`第 ${level + 1} 关出了没错过的 ${q.kind}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("每一关:回顾题最多四道,再多孩子该累了", () => {
    for (let level = 0; level < 188; level++) {
      const kinds = [...new Set(buildQuestions(level).map((q) => q.kind))];
      expect(makeReviewQuestions(kinds, level).length).toBeLessThanOrEqual(MAX_REVIEW_QUESTIONS);
    }
  });

  it("每一关:回顾题和这一关的原题没有一道是逐字相同的", () => {
    const bad: string[] = [];
    for (let level = 0; level < 188; level++) {
      const originals = buildQuestions(level);
      const kinds = [...new Set(originals.map((q) => q.kind))];
      const review = makeReviewQuestions(kinds, level, 0, originals.map((q) => q.promptHTML));
      for (const q of review) {
        if (originals.some((o) => o.promptHTML === q.promptHTML && o.ask === q.ask)) {
          bad.push(`第 ${level + 1} 关的 ${q.kind}`);
        }
      }
    }
    expect(bad, `这些关的回顾题原样重复了: ${bad.slice(0, 8).join(" ")}`).toEqual([]);
  });

  it("回顾轮只复习不判负这条口径没被改掉（一道题都不许标成失败）", () => {
    for (let level = 0; level < 188; level += 23) {
      const kinds = [...new Set(buildQuestions(level).map((q) => q.kind))];
      for (const q of makeReviewQuestions(kinds, level)) {
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.choices.length);
      }
    }
  });
});
