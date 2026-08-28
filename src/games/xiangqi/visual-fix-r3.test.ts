/**
 * 中国象棋 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:.xq-step 棋谱步签 13px→14px(横滚行,nowrap 有
 * overflow-x:auto 兜底)、.xq-capline 被吃子行 12px→14px(flex-wrap 可换行)、
 * .xq-tierblurb 难度简介 13px→14px(min-height 随行高 20→21px)、380px 媒体查询
 * 窄屏按钮 13px 覆写撤掉回落基准 14px(两字按钮 28px 字宽 vs 74px 基准宽,余量充足)。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

describe("fix(visual-r3) N-R3-01:局内小字与窄屏按钮字号 ≥14px", () => {
  it(".xq-step / .xq-capline / .xq-tierblurb 全部声明 ≥14px", () => {
    for (const sel of ["\\.xq-step", "\\.xq-capline", "\\.xq-tierblurb"]) {
      const re = new RegExp(`${sel}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "gs");
      const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
      expect(sizes.length, `${sel} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
      for (const px of sizes) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("380px 媒体查询不再把 .xq-btns button 压回 14 以下(热区 44px 与收窄内边距保留)", () => {
    const mq = src.slice(src.indexOf("@media (max-width:380px)"));
    const block = mq.slice(0, mq.indexOf("\n}") + 2);
    expect(/\.xq-btns button\{[^}]*font-size/.test(block)).toBe(false);
    expect(block).toContain("flex:1 1 74px");
  });

  it("view.ts 的 CSS 里不再有任何 <14px 的 font-size 声明", () => {
    for (const m of src.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1]), "DOM 文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });

  it("棋谱步签横滚兜底还在:.xq-record overflow-x:auto + .xq-step nowrap", () => {
    expect(/\.xq-record\{[^}]*overflow-x:auto/.test(src)).toBe(true);
    expect(/\.xq-step\{[^}]*white-space:nowrap/s.test(src)).toBe(true);
  });
});
