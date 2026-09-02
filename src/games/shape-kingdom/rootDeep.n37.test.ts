/**
 * N-37 残余：shape-kingdom 仅在 root×矮屏收题面，clock/识字不在这条选择器里。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REVIEW = readFileSync(new URL("./review.ts", import.meta.url), "utf8");
const QUIZ = readFileSync(new URL("../quiz99.ts", import.meta.url), "utf8");

describe("N-37 残余 shape-kingdom root×深关", () => {
  it("只收 .shk-quizhost，且必须 :has(.l99-jump)", () => {
    expect(REVIEW).toContain(".l99-stage-wrap:has(.l99-jump) .shk-quizhost .qz-prompt");
    expect(REVIEW).toContain("max-height:40px");
  });

  it("公共 quiz99 紧凑档未被本款改写（clock/识字零扩大）", () => {
    expect(QUIZ).toContain(".qz-choice { min-height: 46px");
    expect(REVIEW).not.toContain(".qz-choice { min-height:");
  });
});
