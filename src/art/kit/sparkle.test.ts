/**
 * 共享美术套件 · 星屑单测（窗口8 B 档）。
 */
import { describe, expect, it } from "vitest";
import { SPARK_COUNT, SPARK_MS, sparkleCss, sparkleSpecs } from "./sparkle";

describe("art-kit · sparkle", () => {
  it("默认一撮正好 5 颗、320ms，喂定数就能复现", () => {
    expect(SPARK_COUNT).toBe(5);
    expect(SPARK_MS).toBe(320);
    const a = sparkleSpecs(() => 0.5);
    const b = sparkleSpecs(() => 0.5);
    expect(a).toHaveLength(5);
    expect(a).toEqual(b);
  });

  it("星屑呈扇形散开：不会五颗全叠在一个点上，而且都往上飘", () => {
    const specs = sparkleSpecs(() => 0.5);
    const spots = new Set(specs.map((s) => `${s.dx},${s.dy}`));
    expect(spots.size).toBeGreaterThan(1);
    for (const s of specs) expect(s.dy).toBeLessThan(0);
  });

  it("生成的 CSS 带前缀、粒子层 pointer-events: none、reduced 下不露面", () => {
    const css = sparkleCss("rbt");
    expect(css).toContain(".rbt-spark");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("@keyframes rbtSparkFly");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("display: none");
  });

  it("前缀会被清洗：塞选择器进来也拼不出越权样式", () => {
    const css = sparkleCss("rbt .evil");
    expect(css).not.toContain(".evil");
  });
});
