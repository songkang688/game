import { describe, expect, it } from "vitest";
import { fitLineWith, unlockedWithRoot } from "./mapFit";
import { isLevelUnlocked, isThemeUnlocked, mapLayout, themeSize } from "./logic";

const measure10 = (s: string): number => s.length * 10;

describe("fitLineWith:果园卡标题按卡宽截断", () => {
  it("塞得下原样返回、塞不下补省略号且不超宽", () => {
    expect(fitLineWith(measure10, "第1章 阳光果园", 200)).toBe("第1章 阳光果园");
    const out = fitLineWith(measure10, "第10章 回旋果谷超长名字", 90);
    expect(out.endsWith("…")).toBe(true);
    expect(measure10(out)).toBeLessThanOrEqual(90);
  });
});

describe("mapLayout:行距夹上限、整块居中(1.3 UX 走查修复)", () => {
  it("11 回合 3 行在 390×730 上行距不超过上限", () => {
    const layout = mapLayout(390, 730, 11);
    expect(layout.rows).toBe(3);
    const ys = [...new Set(layout.spots.map((s) => s.y))].sort((a, b) => a - b);
    expect(ys).toHaveLength(3);
    const gap = ys[1] - ys[0];
    expect(gap).toBeLessThanOrEqual(Math.max(layout.r * 3.2, 84) + 0.001);
    // 整块在 [96, h-62] 里垂直居中:上下留白相等
    expect(ys[0] - 96).toBeCloseTo(730 - 62 - ys[2], 4);
  });
  it("30 回合的长章仍然排得下且不重叠(密章行为不变)", () => {
    const layout = mapLayout(360, 640, 30);
    for (const s of layout.spots) {
      expect(s.y - s.r).toBeGreaterThanOrEqual(0);
      expect(s.y + s.r).toBeLessThanOrEqual(640);
    }
  });
  it("十二章总回合数不受排版改动影响", () => {
    let sum = 0;
    for (let ci = 0; ci < 12; ci++) sum += mapLayout(360, 640, themeSize(ci)).spots.length;
    expect(sum).toBe(188);
  });
});

describe("unlockedWithRoot:管理员权限开着全回合可进", () => {
  const noStars: number[] = new Array<number>(188).fill(0);
  it("root 开:锁死的回合与果园都放行", () => {
    expect(unlockedWithRoot(true, isLevelUnlocked(noStars, 88))).toBe(true);
    expect(unlockedWithRoot(true, isThemeUnlocked(noStars, 6))).toBe(true);
  });
  it("root 关:回落到星级解锁", () => {
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 0))).toBe(true);
    expect(unlockedWithRoot(false, isLevelUnlocked(noStars, 1))).toBe(false);
  });
});
