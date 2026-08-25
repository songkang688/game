import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { COLOR_NAMES, SHAPE_NAMES, SHAPE_SIDES, type ShapeColor, type ShapeKind } from "./logic";
import { buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount, shapeSVG } from "./levels";

describe("形状王国 99 关", () => {
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
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct]).toContain(q.answer);
      }
    }
  });

  it("数数题的答案与图里的目标形状数量一致", () => {
    const nameToKind = new Map<string, ShapeKind>(
      (Object.entries(SHAPE_NAMES) as Array<[ShapeKind, string]>).map(([k, n]) => [n, k])
    );
    let seen = 0;
    for (let i = 67; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "countshape") continue;
        seen++;
        const m = q.ask.match(/几个(.+)？/);
        expect(m).not.toBeNull();
        const target = nameToKind.get(m![1]);
        expect(target).toBeDefined();
        const hits = q.promptHTML.match(new RegExp(`data-kind="${target}"`, "g")) ?? [];
        expect(String(hits.length)).toBe(q.answer);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it("抽 20+ 题机器校验：形状/颜色/大小/数边判定正确、引导语口语化（≤15 个汉字）", () => {
    const nameToKind = new Map<string, ShapeKind>(
      (Object.entries(SHAPE_NAMES) as Array<[ShapeKind, string]>).map(([k, n]) => [n, k])
    );
    const nameToColor = new Map<string, ShapeColor>(
      (Object.entries(COLOR_NAMES) as Array<[ShapeColor, string]>).map(([k, n]) => [n, k])
    );
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      if (q.kind === "shape") {
        const m = q.promptHTML.match(/data-kind="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(SHAPE_NAMES[m![1] as ShapeKind]).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "findshape") {
        const name = q.ask.match(/「(.+)」/)![1];
        expect(q.choices[q.correct]).toContain(`data-kind="${nameToKind.get(name)}"`);
      } else if (q.kind === "color") {
        const m = q.promptHTML.match(/data-color="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(COLOR_NAMES[m![1] as ShapeColor]).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "findcolor") {
        const name = q.ask.match(/哪个是(.+)的？/)![1];
        expect(q.choices[q.correct]).toContain(`data-color="${nameToColor.get(name)}"`);
      } else if (q.kind === "size") {
        const sizes = q.choices.map((c) => Number(c.match(/width="(\d+)"/)![1]));
        const goal = q.ask.includes("最大") ? Math.max(...sizes) : Math.min(...sizes);
        expect(sizes[q.correct]).toBe(goal);
      } else if (q.kind === "sides") {
        const m = q.promptHTML.match(/data-kind="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(String(SHAPE_SIDES[m![1] as ShapeKind])).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else {
        const name = q.ask.match(/几个(.+)？/)![1];
        const hits = q.promptHTML.match(new RegExp(`data-kind="${nameToKind.get(name)}"`, "g")) ?? [];
        expect(String(hits.length)).toBe(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六区题型各有侧重（并非同一模板）", () => {
    const signatures = new Set(
      [2, 19, 36, 52, 68, 85].map((i) => kindPool(i).slice().sort().join(","))
    );
    expect(signatures.size).toBeGreaterThanOrEqual(6);
    expect(kindPool(2)).toContain("shape");
    expect(kindPool(19)).toContain("color");
    expect(kindPool(40)).toContain("size");
    expect(kindPool(55)).toContain("sides");
    expect(kindPool(70)).toContain("countshape");
  });

  it("shapeSVG 八种形状都能生成", () => {
    for (const k of ["circle", "triangle", "square", "rectangle", "star", "heart", "diamond", "pentagon"] as const) {
      const svg = shapeSVG(k, "red", 80);
      expect(svg).toContain(`data-kind="${k}"`);
      expect(svg).toContain("<svg");
    }
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});
