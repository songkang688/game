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
import { IDIOM_CARDS, LOOKALIKE_SETS, RADICAL_CARDS, radicalTargets } from "./logic";

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

/**
 * 上面那一组只看 `ask`。监督复审时把 `promptHTML` 一起扫了一遍，又掉出两处
 * （窗口5 第1轮监督修复员 W5-F-02 / W5-F-03）：
 *  - 成语「百发百中」挖的是第二个「百」，露在外面的「百发□中」里第一个「百」还在，
 *    孩子照着抄就行——释义干净没用，题面自己把答案摆出来了；
 *  - 形近字「操 / 操场」的提示写着「学校里跑步做操的地方」，那个「操」就是答案。
 * 这两条走的是同一条规矩：**题干渲染出来的任何文本都不许含答案**，只是一个在题面、
 * 一个在提示句。下面按题型收口，`promptHTML` 与 `ask` 一起看。
 */
describe("识字小花园 · 题面渲染出来的字也不许是答案", () => {
  /** 挖空以后还露在外面的那几个字 */
  const shownOf = (idiom: string, blank: number): string =>
    Array.from(idiom).filter((_, i) => i !== blank).join("");

  it("成语卡：挖空以后露在外面的那几个字里也不许再出现答案字", () => {
    for (const card of IDIOM_CARDS) {
      const blanked = Array.from(card.idiom)[card.blank];
      expect(
        shownOf(card.idiom, card.blank).includes(blanked),
        `「${card.idiom}」挖第 ${card.blank} 位，题面「${shownOf(card.idiom, card.blank)}」里还留着答案字「${blanked}」`
      ).toBe(false);
    }
  });

  it("形近字卡：提示句里不许写着要填的那个字", () => {
    for (const item of LOOKALIKE_SETS.flat()) {
      expect(
        item.hint.includes(item.char),
        `「${item.word}」的提示「${item.hint}」写着答案字「${item.char}」`
      ).toBe(false);
    }
    // 同一条规矩字卡那边早就有（bank.test.ts 的「不把答案字或示例词直接抄进去」），
    // 形近字这批是 1.1 后加的，一直没人钉
    expect(LOOKALIKE_SETS.flat().length).toBeGreaterThan(50);
  });

  it("188 关的成语题 / 偏旁题 / 形近字题，题面与题干都读不出答案", () => {
    const strip = (html: string): string => html.replace(/<[^>]+>/g, "");
    let checked = 0;
    for (const lv of LEVELS) {
      if (isBuildCharLevel(lv)) continue;
      for (const q of buildQuestions(lv)) {
        if (q.kind !== "idiom" && q.kind !== "radical" && q.kind !== "lookalike") continue;
        const text = `${strip(q.promptHTML ?? "")} ${q.ask}`;
        expect(
          text.includes(q.answer),
          `第 ${lv + 1} 关 ${q.kind} 的题面读得出答案：${text.trim()} → ${q.answer}`
        ).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
