// 窗口 4 · QA 档C · 第 1 轮学习优化员:寻找外星朋友的两条落地改进的覆盖测试。
//
// L1-01 无尽三条曲线只留一个出处(原来 logic.ts 与 levels.ts 各写了一份)。
// L1-02 推理题按章分难度:第 6 章 3 条线索入门,第 7 章 4 条,第 8 章 5 条。
import { describe, expect, it } from "vitest";
import { chapterOf } from "../level99";
import {
  CHAPTERS,
  DEDUCE_FROM_CHAPTER,
  DEDUCE_LEVELS,
  MAX_CLUES,
  MIN_CLUES,
  buildDeduction,
  buildEndlessRound,
  clueBudgetFor,
  cluesAreTight,
  layoutSpots,
} from "./levels";
import {
  ENDLESS_MAX_TARGETS,
  endlessSeconds,
  endlessSpotCount,
  endlessTargetCount,
  solveDeduction,
} from "./logic";
import { mulberry32 } from "../level99";

describe("档C R1 学习优化 · L1-01 无尽曲线只剩一个出处", () => {
  it("第 1–80 轮的藏身点数、目标数、限时都和 logic.ts 的公式逐轮对得上", () => {
    for (let r = 1; r <= 80; r++) {
      const lv = buildEndlessRound(r);
      expect(lv.spots.length, `第 ${r} 轮藏身点数`).toBe(endlessSpotCount(r));
      if (lv.mode === "find") {
        expect(lv.targets.length, `第 ${r} 轮目标数`).toBe(endlessTargetCount(r));
        expect(lv.seconds, `第 ${r} 轮限时`).toBe(endlessSeconds(r));
      } else {
        // 推理轮的限时是另一条更宽松的曲线,目标恒为 1
        expect(lv.seconds).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("轮号越界也不会算出负数或者 0 个藏身点", () => {
    for (const r of [-9, 0, 0.4, 1]) {
      const lv = buildEndlessRound(r);
      expect(lv.spots.length).toBeGreaterThanOrEqual(4);
      expect(lv.seconds).toBeGreaterThan(0);
    }
  });

  it("三条曲线各自都有上下限,不会一路跑到极端", () => {
    for (let r = 1; r <= 200; r++) {
      expect(endlessSeconds(r)).toBeGreaterThanOrEqual(14);
      expect(endlessSpotCount(r)).toBeLessThanOrEqual(16);
      // 第 2 轮 L2-01 把目标数的天花板从 5 提到 8(前 12 轮的节奏一个都没动)
      expect(endlessTargetCount(r)).toBeLessThanOrEqual(ENDLESS_MAX_TARGETS);
    }
  });
});

describe("档C R1 学习优化 · L1-02 推理题的难度台阶", () => {
  it("按章给出的线索条数是 3 → 4 → 5,一档一档往上", () => {
    expect(clueBudgetFor(DEDUCE_FROM_CHAPTER)).toBe(MIN_CLUES);
    expect(clueBudgetFor(DEDUCE_FROM_CHAPTER + 1)).toBe(MIN_CLUES + 1);
    expect(clueBudgetFor(DEDUCE_FROM_CHAPTER + 2)).toBe(MAX_CLUES);
    expect(clueBudgetFor(0)).toBe(MIN_CLUES);
  });

  it("战役里每一道推理题的线索条数,正好等于它那一章的额度", () => {
    expect(DEDUCE_LEVELS.length).toBeGreaterThan(20);
    for (const lv of DEDUCE_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv.index);
      expect(lv.clues.length, `第 ${lv.index + 1} 关(第 ${ci + 1} 章)线索条数`).toBe(clueBudgetFor(ci));
    }
  });

  it("三章各自真的都有推理题,而且入门那一章确实是 3 条", () => {
    const byCh = new Map<number, number>();
    for (const lv of DEDUCE_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv.index);
      byCh.set(ci, (byCh.get(ci) ?? 0) + 1);
    }
    for (const ci of [DEDUCE_FROM_CHAPTER, DEDUCE_FROM_CHAPTER + 1, DEDUCE_FROM_CHAPTER + 2]) {
      expect(byCh.get(ci) ?? 0, `第 ${ci + 1} 章一道推理题都没有`).toBeGreaterThan(0);
    }
    const entry = DEDUCE_LEVELS.filter((lv) => chapterOf(CHAPTERS, lv.index) === DEDUCE_FROM_CHAPTER);
    expect(entry.every((lv) => lv.clues.length === MIN_CLUES)).toBe(true);
  });

  it("加了难度台阶之后,解唯一与「一条都不能少」这两条硬要求一条没丢", () => {
    for (const lv of DEDUCE_LEVELS) {
      expect(solveDeduction(lv.spots, lv.clues), `第 ${lv.index + 1} 关解不唯一`).toEqual([lv.answer]);
      expect(cluesAreTight(lv.spots, lv.clues), `第 ${lv.index + 1} 关有废话线索`).toBe(true);
    }
  });

  it("无尽的推理轮也跟着轮次加线索,前几轮 3 条、后面才到 5 条", () => {
    const early = buildEndlessRound(4);
    const late = buildEndlessRound(80);
    expect(early.mode).toBe("deduce");
    expect(late.mode).toBe("deduce");
    if (early.mode === "deduce" && late.mode === "deduce") {
      expect(early.clues.length).toBeLessThanOrEqual(late.clues.length);
      expect(early.clues.length).toBe(MIN_CLUES);
      expect(late.clues.length).toBe(MAX_CLUES);
      expect(solveDeduction(late.spots, late.clues)).toEqual([late.answer]);
    }
  });

  it("直接点名要几条时,拿不到正好的也会给最接近的,而且永远解唯一", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = mulberry32(seed * 6151 + 3);
      const spots = layoutSpots(rand, 6 + (seed % 10));
      for (const want of [MIN_CLUES, MIN_CLUES + 1, MAX_CLUES]) {
        const r = buildDeduction(spots, mulberry32(seed * 31 + want), want);
        expect(solveDeduction(spots, r.clues), `种子 ${seed} 想要 ${want} 条时解不唯一`).toEqual([
          r.answer,
        ]);
        expect(r.clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
        expect(r.clues.length).toBeLessThanOrEqual(MAX_CLUES);
      }
    }
  });

  it("不传 want 时按老口径给 4 条上下,老调用方不会被改坏", () => {
    const rand = mulberry32(97);
    const spots = layoutSpots(rand, 10);
    const r = buildDeduction(spots, mulberry32(41));
    expect(solveDeduction(spots, r.clues)).toEqual([r.answer]);
    expect(r.clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
    expect(r.clues.length).toBeLessThanOrEqual(MAX_CLUES);
  });
});
