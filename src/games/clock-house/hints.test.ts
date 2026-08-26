/**
 * 时钟小屋 1.2：悄悄提示巡检。
 *
 * 提示只讲方法，一个数字都不许有。这一份把 188 关全部题目的正确答案扒出来，
 * 逐条去撞对应题型的提示语——撞上任何一个答案字符串就算泄题。
 */
import { describe, expect, it } from "vitest";
import { isAnswerLeak } from "../../ui/guide";
import { HINT_PREFIX, METHOD_HINTS, hasDigits, methodHint } from "./hints";
import { CLOCK_TYPES, typeOfKind, type ClockType } from "./kinds";
import { answerTextOf, buildQuestions, makeReviewQuestions } from "./levels";

const TOTAL = 188;

/** 188 关全部题目（含错题回顾轮出的题），一次扒完给下面几条用 */
const ALL_QUESTIONS = Array.from({ length: TOTAL }, (_, level) => buildQuestions(level)).flat();

describe("时钟小屋 · 悄悄提示只讲方法", () => {
  it("九类题型每一类都有一句方法提示，而且都是完整的一句话", () => {
    for (const type of CLOCK_TYPES) {
      const line = METHOD_HINTS[type];
      expect(line, `${type} 没有提示语`).toBeTruthy();
      expect(line.length, `${type} 的提示太短，讲不清方法`).toBeGreaterThanOrEqual(12);
      expect(line.endsWith("。"), `${type} 的提示没写完`).toBe(true);
    }
    expect(new Set(Object.values(METHOD_HINTS)).size).toBe(CLOCK_TYPES.length);
  });

  it("提示语里一个数字都没有", () => {
    for (const type of CLOCK_TYPES) {
      expect(hasDigits(METHOD_HINTS[type]), `${type} 的提示里出现了数字`).toBe(false);
    }
    expect(hasDigits("先看时针")).toBe(false);
    expect(hasDigits("答案是 3 点")).toBe(true);
  });

  it("methodHint 按题型给话，带上「悄悄提示」的前缀（展示与朗读用的是同一句）", () => {
    expect(methodHint("readMin")).toBe(`${HINT_PREFIX}${METHOD_HINTS.readFace}`);
    expect(methodHint("read")).toBe(methodHint("readMin"));
    expect(methodHint("h24")).toBe(methodHint("h12"));
    expect(methodHint("span")).toBe(methodHint("spanNoon"));
    expect(methodHint("tableWait")).toBe(methodHint("routine"));
    // 不同题型给的方法必须真的不一样，不能糊一句通用话了事
    const lines = new Set(CLOCK_TYPES.map((t) => METHOD_HINTS[t]));
    expect(lines.size).toBe(CLOCK_TYPES.length);
  });

  it("188 关全部题目的答案，一个都不出现在对应题型的提示里", () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThan(1000);
    let checked = 0;
    for (const q of ALL_QUESTIONS) {
      const answer = answerTextOf(q);
      const hint = methodHint(q.kind);
      expect(hint.includes(answer), `${q.kind} 的提示里出现了答案「${answer}」`).toBe(false);
      checked++;
    }
    expect(checked).toBe(ALL_QUESTIONS.length);
  });

  it("换个方向再扫一遍：任何一句提示都不含任何一题的答案（含错题回顾轮）", () => {
    const answers = new Set(ALL_QUESTIONS.map((q) => answerTextOf(q)));
    for (const level of [0, 40, 99, 130, 160, 187]) {
      for (const q of makeReviewQuestions([...new Set(buildQuestions(level).map((x) => x.kind))], level)) {
        answers.add(answerTextOf(q));
      }
    }
    expect(answers.size).toBeGreaterThan(100);
    for (const type of CLOCK_TYPES) {
      const line = methodHint(type === "readFace" ? "readMin" : firstKindOf(type));
      for (const answer of answers) {
        expect(line.includes(answer), `${type} 的提示撞上了答案「${answer}」`).toBe(false);
      }
    }
  });

  it("提示语过得了平台那套「答案过滤器」，不会被当成泄题隐藏掉", () => {
    for (const type of CLOCK_TYPES) {
      expect(isAnswerLeak(METHOD_HINTS[type]), `${type} 的提示被答案过滤器拦了`).toBe(false);
      expect(isAnswerLeak(methodHint(firstKindOf(type)))).toBe(false);
      expect(METHOD_HINTS[type]).not.toContain("答案");
      expect(METHOD_HINTS[type]).not.toContain("选项");
    }
  });
});

/** 找一个属于这个题型的种类，用来反查提示语 */
function firstKindOf(type: ClockType): Parameters<typeof methodHint>[0] {
  const kinds = ALL_QUESTIONS.map((q) => q.kind).filter((k) => typeOfKind(k) === type);
  return kinds[0] ?? "read";
}
