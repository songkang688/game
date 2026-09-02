/**
 * 接水果 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)问题 12 修后的状态:
 * 双人半屏名牌文字 13px → 14px(功能小字底线)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 修复 · A-12 双人名牌 ≥14px", () => {
  it("13px 名牌清场,改 14px", () => {
    expect(SRC.includes('"bold 13px sans-serif"')).toBe(false);
    expect(SRC).toContain('"bold 14px sans-serif"');
  });

  it("整个画布再无任何 <14px 字号(全量扫描钉死不回退)", () => {
    for (const f of SRC.match(/font = "[^"]*?(\d+)px/g) ?? []) {
      const px = Number(/(\d+)px/.exec(f)?.[1]);
      expect(px, `字号偷小:${f}`).toBeGreaterThanOrEqual(14);
    }
  });
});
