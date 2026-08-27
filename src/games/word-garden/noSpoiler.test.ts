/**
 * 识字小花园 · 题干不许写着答案的守门用例（窗口5 第1轮学习优化员补）。
 *
 * 测试员在档A 记了 W5-A-02：188 关里有 25 道题的**题干自身**把要填的那个字写出来了
 * ——成语「兴高采烈」的释义写着「高兴」、偏旁「木」的义项词写着「树木」，
 * 孩子不会这条成语、不认识这个偏旁也能照着抄。
 *
 * 现有的「答案唯一」只管三个选项之间，管不到题干，所以这一份专门盯题干：
 *  1. 数据层：每张成语卡的释义不含被挖掉的那个字；
 *  2. 生成层：188 关每一道成语题 / 偏旁题的 `ask` 都不含正确答案。
 * 别的题型（近反义、多音字、看字选意思）题干里点名的是**被问的那个词**、不是答案，
 * 属于玩法本身，不在这条线里。
 */
import { describe, expect, it } from "vitest";
import { buildQuestions, isBuildCharLevel } from "./levels";
import { IDIOM_CARDS, RADICAL_CARDS, radicalTargets } from "./logic";

const LEVELS = Array.from({ length: 188 }, (_, i) => i);

describe("识字小花园 · 题干不许把答案写出来", () => {
  it("成语卡：释义句里一个字都不许和挖空的那个字重复", () => {
    for (const card of IDIOM_CARDS) {
      const blanked = Array.from(card.idiom)[card.blank];
      expect(
        card.meaning.includes(blanked),
        `「${card.idiom}」的释义「${card.meaning}」写着答案字「${blanked}」`
      ).toBe(false);
    }
  });

  it("偏旁卡：义项词里出现过的字不许拿来当答案，剔完每张卡还剩得下题", () => {
    for (const card of RADICAL_CARDS) {
      const targets = radicalTargets(card);
      expect(targets.length, `「${card.radical}」剔完就没字可问了`).toBeGreaterThanOrEqual(3);
      for (const ch of targets) {
        expect(card.topic.includes(ch), `「${card.topic}」里写着答案字「${ch}」`).toBe(false);
      }
    }
    // 自检有效性：确实有卡被剔掉了字，否则这条等于空转
    const trimmed = RADICAL_CARDS.filter((c) => radicalTargets(c).length < c.chars.length);
    expect(trimmed.length).toBeGreaterThanOrEqual(2);
  });

  it("188 关每一道成语题与偏旁题的题干都不含正确答案", () => {
    let checked = 0;
    for (const lv of LEVELS) {
      if (isBuildCharLevel(lv)) continue;
      for (const q of buildQuestions(lv)) {
        if (q.kind !== "idiom" && q.kind !== "radical") continue;
        expect(
          q.ask.includes(q.answer),
          `第 ${lv + 1} 关 ${q.kind} 的题干写着答案：${q.ask} → ${q.answer}`
        ).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});
