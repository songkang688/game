import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "./level99";
import {
  CHEERS,
  FAIL_LINE,
  MAX_QUESTIONS,
  PRAISES,
  SKIP_NOTE,
  bonusStreakStep,
  clampQuestions,
  defaultMaxWrong,
  quizFinishLine,
  quizProgressText,
  quizStars,
  shouldHint
} from "./quiz99";

describe("quiz99 悄悄提示规则", () => {
  it("同一道题连错 2 次就给提示", () => {
    expect(shouldHint(1, 1, 3)).toBe(false);
    expect(shouldHint(2, 2, 3)).toBe(true);
    expect(shouldHint(3, 3, 3)).toBe(true);
  });

  it("总错数到上限（再错就失败）时,哪怕本题才错 1 次也给提示", () => {
    // 前两题各错 1 次 + 本题错 1 次 = 总 3 次(maxWrong=3):最后机会必须点亮答案
    expect(shouldHint(1, 3, 3)).toBe(true);
    // 总错数没到上限、本题也才错 1 次:先让孩子自己想
    expect(shouldHint(1, 2, 3)).toBe(false);
  });

  it("maxWrong 更宽松时按同样规则推迟提示", () => {
    expect(shouldHint(1, 4, 6)).toBe(false);
    expect(shouldHint(1, 6, 6)).toBe(true);
    expect(shouldHint(2, 2, 6)).toBe(true);
  });
});

describe("quiz99 题量上限跟随 188", () => {
  it("一关最多 188 道题", () => {
    expect(MAX_QUESTIONS).toBe(TOTAL_LEVELS);
    expect(MAX_QUESTIONS).toBe(188);
  });

  it("clampQuestions 截断超长题组、短题组原样返回", () => {
    const many = Array.from({ length: 300 }, (_, i) => i);
    expect(clampQuestions(many)).toHaveLength(188);
    expect(clampQuestions(many)[187]).toBe(187);
    const few = [1, 2, 3];
    expect(clampQuestions(few)).toEqual(few);
    expect(clampQuestions([])).toEqual([]);
  });

  it("defaultMaxWrong：短题组维持 1.0 的 3 次容错", () => {
    expect(defaultMaxWrong(5)).toBe(3);
    expect(defaultMaxWrong(12)).toBe(3);
    expect(defaultMaxWrong(24)).toBe(3);
    expect(defaultMaxWrong(0)).toBe(3);
  });

  it("defaultMaxWrong：题量越大容错越宽松", () => {
    expect(defaultMaxWrong(40)).toBe(5);
    expect(defaultMaxWrong(188)).toBe(24);
    expect(defaultMaxWrong(188)).toBeGreaterThan(defaultMaxWrong(24));
  });

  it("quizStars：短题组的评星与 1.0 完全一致", () => {
    expect(quizStars(0, 10)).toBe(3);
    expect(quizStars(1, 10)).toBe(2);
    expect(quizStars(2, 10)).toBe(2);
    expect(quizStars(3, 10)).toBe(1);
  });

  it("quizStars：188 题的 2 星阈值按一成放宽", () => {
    expect(quizStars(0, 188)).toBe(3);
    expect(quizStars(19, 188)).toBe(2);
    expect(quizStars(20, 188)).toBe(1);
  });

  it("bonusStreakStep：长题组把连对奖励节奏放慢", () => {
    expect(bonusStreakStep(10)).toBe(4);
    expect(bonusStreakStep(24)).toBe(4);
    expect(bonusStreakStep(25)).toBe(8);
    expect(bonusStreakStep(188)).toBe(8);
  });

  it("quizProgressText：长题组额外报还剩多少题", () => {
    expect(quizProgressText(0, 10)).toBe("第 1 / 10 题");
    expect(quizProgressText(0, 188)).toBe("第 1 / 188 题 · 还剩 187");
    expect(quizProgressText(187, 188)).toBe("第 188 / 188 题 · 还剩 0");
  });
});

describe("quiz99 文案只鼓励不批评", () => {
  it("答错与收尾文案里没有任何批评措辞", () => {
    const all = [...CHEERS, FAIL_LINE, quizFinishLine(3, 188), quizFinishLine(0, 188)].join("");
    expect(all).not.toMatch(/笨|蠢|差劲|不行|失败|真糟/);
  });

  it("答对夸奖不空、也不肉麻低幼", () => {
    expect(PRAISES.length).toBeGreaterThan(0);
    expect(PRAISES.join("")).not.toMatch(/宝宝|乖乖|小笨蛋/);
  });

  it("跳过提示是「回来拿下」的口气，不指责孩子", () => {
    expect(SKIP_NOTE).toContain("跳过");
    expect(SKIP_NOTE).not.toMatch(/偷懒|不该|逃避/);
  });

  it("收尾文案按是否全对给不同的肯定", () => {
    expect(quizFinishLine(0, 188)).toBe("全部一次答对，太了不起啦！");
    expect(quizFinishLine(2, 188)).toBe("188 道题全部完成！");
  });
});
