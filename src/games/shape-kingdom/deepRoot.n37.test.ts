/**
 * N-37 残余：shape-kingdom root×深关（第 91 关族）三张选项须进 915×412。
 * clock / 成语 / 偏旁 / 多音 本轮勿扩大到公共 quiz99。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "./levels";

const REVIEW = readFileSync(new URL("./review.ts", import.meta.url), "utf8");
const QUIZ = readFileSync(new URL("../quiz99.ts", import.meta.url), "utf8");

describe("N-37 r15 · shape-kingdom root×深关提示条让位", () => {
  it("第 91 关（下标 90）仍是答题关走回顾壳，不是作图关", () => {
    const total = CHAPTERS.reduce((n, ch) => n + ch.count, 0);
    expect(total).toBeGreaterThanOrEqual(91);
  });

  it("只收 .shk-round / .shk-quizhost，公共 .qz-choice 基线未改成线下收热区", () => {
    expect(REVIEW).toContain("N-37");
    expect(REVIEW).toContain("@media (max-height:500px)");
    expect(REVIEW).toContain(".shk-round{margin:0 0 2px;gap:2px;}");
    expect(REVIEW).toContain(".shk-quizhost .qz-prompt{min-height:36px");
    expect(REVIEW).toContain("max-height:72px");
    expect(QUIZ).toMatch(/\.qz-choice \{[^}]*min-height: 64px/);
    expect(QUIZ).toContain(".qz-choice { min-height: 46px;");
  });

  it("提示钮热区仍 ≥44", () => {
    expect(REVIEW).toMatch(/\.shk-hintbtn\{[^}]*min-height:44px/);
  });
});
