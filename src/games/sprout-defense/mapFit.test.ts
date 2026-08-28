import { describe, expect, it } from "vitest";
import { fitLineWith, mapRowYs, unlockedWithRoot } from "./mapFit";
import { isLevelUnlocked, isThemeUnlocked } from "./logic";

const measure10 = (s: string): number => s.length * 10;

describe("fitLineWith:花园章节卡文字按卡宽截断", () => {
  it("塞得下就原样返回", () => {
    expect(fitLineWith(measure10, "第1章 阳光小院", 200)).toBe("第1章 阳光小院");
  });
  it("塞不下截断补省略号,截完不超宽", () => {
    const out = fitLineWith(measure10, "第11章 地底根系迷宫大挑战", 90);
    expect(out.endsWith("…")).toBe(true);
    expect(measure10(out)).toBeLessThanOrEqual(90);
  });
});

describe("mapRowYs:行距夹上限、整块居中", () => {
  it("行少不摊满画布,上下留白相等", () => {
    const ys = mapRowYs(3, 96, 690, 89.6);
    expect(ys[1] - ys[0]).toBeCloseTo(89.6, 6);
    expect(ys[0] - 96).toBeCloseTo(690 - ys[2], 6);
  });
  it("行多(自然行距低于上限)时保持均摊", () => {
    const ys = mapRowYs(8, 96, 690, 96);
    expect(ys[0]).toBeCloseTo(96, 6);
    expect(ys[7]).toBeCloseTo(690, 6);
  });
});

describe("unlockedWithRoot:管理员权限开着全关可进", () => {
  const noStars: number[] = new Array<number>(188).fill(0);
  it("root 开:锁死的关与章节都放行", () => {
    expect(unlockedWithRoot(true, isLevelUnlocked(noStars, 100))).toBe(true);
    expect(unlockedWithRoot(true, isThemeUnlocked(noStars, 8))).toBe(true);
  });
  it("root 关:回落到星级解锁", () => {
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 0))).toBe(true);
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 3))).toBe(false);
  });
});
