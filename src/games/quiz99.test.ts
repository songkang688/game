import { describe, expect, it } from "vitest";
import { shouldHint } from "./quiz99";

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
