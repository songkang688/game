/**
 * 数独花田 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项②：花瓣是「暗部 + 主色 + 高光」三层实心模拟渐变，三层颜色必须真的分了阶；
 *  ② id 撞车红线：这些 SVG 以 innerHTML 出现很多份，所以永远不许出现 <defs> / id= / url(#；
 *  ③ shade()/mix() 的提亮压暗是可量化的（灰度单调）。
 */
import { describe, expect, it } from "vitest";
import { PETAL_BLUE, PETAL_PINK, budSVG, mix, petalSVG, shade } from "./art";

function lum(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

describe("专项②:花瓣三层光影真的分了阶", () => {
  it("petalSVG 恰好三层 path,暗部/主色/高光灰度严格递增", () => {
    for (const color of [PETAL_PINK, PETAL_BLUE]) {
      const svg = petalSVG(color);
      const fills = [...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
      expect(fills.length, "三层实心").toBe(3);
      expect(lum(fills[0]), "第一层要是暗部").toBeLessThan(lum(fills[1]));
      expect(lum(fills[1]), "第三层要是高光").toBeLessThan(lum(fills[2]));
    }
  });

  it("花苞也有粉苞三阶 + 茎 + 两片萼叶(≥ 6 个图元)", () => {
    const svg = budSVG();
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(svg).toContain(shade(PETAL_PINK, 0.5));
    expect(svg).toContain(shade(PETAL_PINK, -0.16));
  });
});

describe("id 撞车红线:innerHTML 多份共存", () => {
  it("花瓣与花苞的 SVG 不含 <defs> / id= / url(#", () => {
    for (const svg of [petalSVG(PETAL_PINK), petalSVG(PETAL_BLUE), budSVG()]) {
      expect(svg).not.toContain("<defs");
      expect(svg).not.toContain(" id=");
      expect(svg).not.toContain("url(#");
    }
  });
});

describe("shade/mix 可量化", () => {
  it("shade 正参提亮、负参压暗;mix 两端取端点", () => {
    const base = "#7FBF6E";
    expect(lum(shade(base, 0.3))).toBeGreaterThan(lum(base));
    expect(lum(shade(base, -0.3))).toBeLessThan(lum(base));
    expect(mix(PETAL_PINK, PETAL_BLUE, 0)).toBe(PETAL_PINK.toUpperCase());
    expect(mix(PETAL_PINK, PETAL_BLUE, 1)).toBe(PETAL_BLUE.toUpperCase());
  });
});
