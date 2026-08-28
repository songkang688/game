import { describe, expect, it } from "vitest";
import { fitLineWith, mapRowYs, unlockedWithRoot } from "./mapFit";
import { isUnlockedWith } from "./campaign";

const measure10 = (s: string): number => s.length * 10;

describe("fitLineWith:文字按宽截断(与卡片 fitText 同口径的纯函数版)", () => {
  it("塞得下原样返回、塞不下补省略号", () => {
    expect(fitLineWith(measure10, "青草世界", 100)).toBe("青草世界");
    const out = fitLineWith(measure10, "开满小花的新手跑道,慢慢来", 80);
    expect(out.endsWith("…")).toBe(true);
    expect(measure10(out)).toBeLessThanOrEqual(80);
  });
});

describe("mapRowYs:世界地图行距夹上限、整块居中", () => {
  it("11 关 3 行不再摊满整个画布高", () => {
    const ys = mapRowYs(3, 96, 690, 89.6);
    expect(ys[1] - ys[0]).toBeCloseTo(89.6, 6);
    expect(ys[0] - 96).toBeCloseTo(690 - ys[2], 6);
  });
  it("行多(自然行距低于上限)时保持原有均摊", () => {
    const ys = mapRowYs(8, 96, 690, 96);
    expect(ys[0]).toBeCloseTo(96, 6);
    expect(ys[7]).toBeCloseTo(690, 6);
  });
});

describe("unlockedWithRoot:管理员权限开着全关可进", () => {
  const noStars: number[] = new Array<number>(188).fill(0);
  it("root 开:第 100 关也放行", () => {
    expect(isUnlockedWith(noStars, [], 100)).toBe(false);
    expect(unlockedWithRoot(true, isUnlockedWith(noStars, [], 100))).toBe(true);
  });
  it("root 关:回落到「上一关有星或被跳过」", () => {
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [], 0))).toBe(true);
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [], 1))).toBe(false);
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [0], 1))).toBe(true);
  });
});
