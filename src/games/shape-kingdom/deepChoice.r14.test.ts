/**
 * N-37 残余(trio-r14 A):shape-kingdom root×深关三选项。
 * 撞车取 r13 先合版（只在 :has(.l99-jump) 下收），补选项 sticky。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REVIEW = readFileSync(new URL("./review.ts", import.meta.url), "utf8");

describe("N-37 形状王国深关选项进 412", () => {
  it("只收 root 直达行叠着的本款宿主,clock/识字不走这条", () => {
    expect(REVIEW).toContain(".l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-prompt svg");
    expect(REVIEW).toContain(".l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-choices{position:sticky;bottom:0");
    expect(REVIEW).not.toContain("@media (max-height:500px) and (min-width:640px)");
  });
});
