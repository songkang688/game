/**
 * 星星钓鱼湾 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)问题 10 修后的状态:
 * 水下测深(鱼群带标签 / 深度刻度)与瞄准提示 / 风向标四处功能小字统一 ≥14px。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 修复 · A-10 功能小字 ≥14px", () => {
  it("四处点名小字(11/10/12/13px)全部清场", () => {
    expect(SRC.includes('font = "600 11px')).toBe(false);
    expect(SRC.includes('font = "700 10px')).toBe(false);
    expect(SRC.includes('font = "700 12px')).toBe(false);
    expect(SRC.includes('font = "700 13px')).toBe(false);
  });

  it("整个画布再无任何 <14px 字号(全量扫描钉死不回退)", () => {
    const fonts = SRC.match(/font = "[^"]*?(\d+)px/g) ?? [];
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) {
      const px = Number(/(\d+)px/.exec(f)?.[1]);
      expect(px, `字号偷小:${f}`).toBeGreaterThanOrEqual(14);
    }
  });

  it("鱼群带标签的小牌随 14px 字加宽加高(每字 14px 估宽、牌高 18px)", () => {
    expect(SRC).toContain("label.length * 14 + 16");
    expect(SRC).toContain("y0 + 21");
    expect(SRC.includes("label.length * 11")).toBe(false);
  });
});
