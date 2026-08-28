import { describe, expect, it } from "vitest";
import { fitLineWith, mapCols, mapRowYs, nodeRadiusCap, unlockedWithRoot } from "./mapFit";
import { isUnlockedWith } from "./campaign";

const measure10 = (s: string): number => s.length * 10;

describe("fitLineWith:海域卡文字按卡宽截断", () => {
  it("塞得下就原样返回", () => {
    expect(fitLineWith(measure10, "第1章 浅浅海湾", 200)).toBe("第1章 浅浅海湾");
  });
  it("塞不下截断补省略号,截完不超宽", () => {
    const out = fitLineWith(measure10, "阳光沙滩边的新手海湾,水母和鼓鼓鱼慢悠悠", 100);
    expect(out.endsWith("…")).toBe(true);
    expect(measure10(out)).toBeLessThanOrEqual(100);
  });
  it("非法宽度返回空串", () => {
    expect(fitLineWith(measure10, "abc", -5)).toBe("");
  });
});

describe("mapRowYs:行距夹上限、整块居中", () => {
  it("11 关 3 行不再摊满整个画布高", () => {
    const ys = mapRowYs(3, 96, 668, 89.6);
    expect(ys[1] - ys[0]).toBeCloseTo(89.6, 6);
    expect(ys[0] - 96).toBeCloseTo(668 - ys[2], 6);
  });
  it("行多时保持原有均摊", () => {
    const ys = mapRowYs(8, 96, 668, 96);
    expect(ys[0]).toBeCloseTo(96, 6);
    expect(ys[7]).toBeCloseTo(668, 6);
  });
});

describe("mapCols / nodeRadiusCap:小海域节点图不再缩在正中(trio-r7 收 r4 遗留,同 garden-guard 法)", () => {
  it("11 关小海域:竖屏 3 列(4 行更满),横屏 6 列(2 行)", () => {
    expect(mapCols(11, 350, 730)).toBe(3);
    expect(mapCols(11, 843, 322)).toBe(6);
    expect(mapCols(11, 952, 654)).toBe(6);
  });
  it("29/30 关大海域保持原样:竖屏 4 列,横屏 6 列", () => {
    expect(mapCols(30, 350, 730)).toBe(4);
    expect(mapCols(29, 843, 322)).toBe(6);
  });
  it("小海域节点半径上限放大到 36,大海域保持 28", () => {
    expect(nodeRadiusCap(11)).toBe(36);
    expect(nodeRadiusCap(30)).toBe(28);
  });
  it("竖屏 390 手机上小海域节点确实能放大:3 列的列宽限制 > 36 上限", () => {
    // drawMap 里 nr = min(cap, 列宽/2.4, 行高/2.6):350 宽 3 列时列宽约 88.7,88.7/2.4≈37>36
    const colSpan = (350 * 0.76) / mapCols(11, 350, 730);
    expect(colSpan / 2.4).toBeGreaterThan(36);
  });
});

describe("unlockedWithRoot:管理员权限开着全关可进", () => {
  const noStars: number[] = new Array<number>(188).fill(0);
  it("root 开:锁死的关也放行", () => {
    expect(isUnlockedWith(noStars, [], 50)).toBe(false);
    expect(unlockedWithRoot(true, isUnlockedWith(noStars, [], 50))).toBe(true);
  });
  it("root 关:回落到星级/跳关解锁", () => {
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [], 0))).toBe(true);
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [], 1))).toBe(false);
    expect(unlockedWithRoot(false, isUnlockedWith(noStars, [0], 1))).toBe(true);
  });
});
