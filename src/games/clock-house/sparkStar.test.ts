/**
 * W8R2-03 · 答对星屑换矢量星的钉子（窗口 8 第 2 轮监督修复员）。
 *
 * A 档报告：星屑粒子是裸 ✨ emoji（12 款中唯一的 emoji FX 粒子）。
 * 修法：粒子本体换 sparkStarSVG 四芒星，sparkleSpecs 的轨迹 / 颗数 / 时序不变。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sparkStarSVG } from "./house";

const SRC = readFileSync(new URL("./house.ts", import.meta.url), "utf8");

describe("W8R2-03 · 星屑矢量星", () => {
  it("四芒星本体：金星 + 深描边 + 白星心，尺寸走字号档、下限 6px", () => {
    const svg = sparkStarSVG(14);
    expect(svg).toContain('width="14" height="14"');
    expect(svg).toContain("<polygon");
    expect(svg).toContain("stroke=");
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('aria-hidden="true"');
    expect(/\p{Extended_Pictographic}/u.test(svg)).toBe(false);
    expect(sparkStarSVG(0)).toContain('width="6"');
  });

  it("cheer 的粒子不再是裸 ✨：换 sparkStarSVG，轨迹与时序一行不动", () => {
    expect(SRC).not.toContain('s.textContent = "✨"');
    expect(SRC).toContain("s.innerHTML = sparkStarSVG(spec.sizePx);");
    expect(SRC).toContain("sparkleSpecs(rand, CHEER_SPARKS)");
    expect(SRC).toContain("later(() => s.remove(), SPARK_MS + spec.delayMs + 60);");
  });
});
