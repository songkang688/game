import { describe, expect, it } from "vitest";
import { fitLineWith, mapRowYs, unlockedWithRoot } from "./mapFit";
import { isLevelUnlocked, isThemeUnlocked } from "./logic";

/** 每个字符 10px 的假量宽器,好算账 */
const measure10 = (s: string): number => s.length * 10;

describe("fitLineWith:章节卡文字按卡宽截断", () => {
  it("塞得下就原样返回", () => {
    expect(fitLineWith(measure10, "第1章 草地花园", 200)).toBe("第1章 草地花园");
  });
  it("塞不下截断补省略号,且截完真的不超宽", () => {
    const out = fitLineWith(measure10, "新手花园,认识小怪和五种塔", 80);
    expect(out.endsWith("…")).toBe(true);
    expect(measure10(out)).toBeLessThanOrEqual(80);
  });
  it("宽度只够省略号时也不炸", () => {
    expect(fitLineWith(measure10, "很长很长的标题", 10)).toBe("…");
  });
  it("非法宽度返回空串,不画出界", () => {
    expect(fitLineWith(measure10, "abc", 0)).toBe("");
    expect(fitLineWith(measure10, "abc", Number.NaN)).toBe("");
  });
});

describe("mapRowYs:行距夹上限、整块居中", () => {
  it("行少时行距不再摊满整个画布(390 手机 11 关 3 行的老毛病)", () => {
    const ys = mapRowYs(3, 96, 690, 96);
    expect(ys).toHaveLength(3);
    expect(ys[1] - ys[0]).toBe(96);
    expect(ys[2] - ys[1]).toBe(96);
    // 整块在 [96,690] 里居中:上下留白相等
    expect(ys[0] - 96).toBeCloseTo(690 - ys[2], 6);
  });
  it("行多时保持均摊(不超过原有密度)", () => {
    const ys = mapRowYs(8, 96, 690, 96);
    expect(ys[0]).toBeCloseTo(96, 6);
    expect(ys[7]).toBeCloseTo(690, 6);
  });
  it("单行放在正中", () => {
    expect(mapRowYs(1, 100, 300, 96)).toEqual([200]);
  });
});

describe("unlockedWithRoot:管理员权限开着全关可进", () => {
  const noStars = new Array<number>(188).fill(0);
  it("root 开:锁死的关也放行", () => {
    expect(isLevelUnlocked(noStars, 50)).toBe(false);
    expect(unlockedWithRoot(true, isLevelUnlocked(noStars, 50))).toBe(true);
    expect(unlockedWithRoot(true, isThemeUnlocked(noStars, 5))).toBe(true);
  });
  it("root 关:回落到星级解锁,第 1 关照常开", () => {
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 0))).toBe(true);
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 1))).toBe(false);
  });
});
