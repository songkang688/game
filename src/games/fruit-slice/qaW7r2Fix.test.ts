/**
 * 水果忍者 · 窗口 7 第 2 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 R1 遗留 A-13(A 档 R2 报告 N-5 补录)修后状态:菜单回合卡的条件
 * 说明行由 13px 提到 14px;并全量扫描画布字面量字号,一律 ≥14px。
 * (半径比例字号是果面上的随果缩放贴字、章节卡 blurb 的 Math.min(12,…)
 * 封顶是 1.2 遗留且提字号需配套排版,均登记在 C 档遗留清单,不在本条断言面。)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R2 修复 · A-13/N-5 菜单条件说明行 ≥14px", () => {
  it("13px 条件说明行清场,换成 14px", () => {
    expect(SRC.includes('ctx.font = "13px')).toBe(false);
    expect(SRC).toContain('ctx.font = "14px sans-serif";\n        wrapText(tags.join(" · ")');
  });

  it("画布字面量字号全量扫描:再无任何 <14px(钉死不回退)", () => {
    const fonts = SRC.match(/\.font = "[^"]*?(\d+)px/g) ?? [];
    expect(fonts.length).toBeGreaterThan(10);
    for (const f of fonts) {
      const px = Number(/(\d+)px/.exec(f)?.[1]);
      expect(px, `字面量字号偷小:${f}`).toBeGreaterThanOrEqual(14);
    }
  });
});
