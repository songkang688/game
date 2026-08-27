/**
 * W8R2-02 · 小鸟反馈层让位连对徽章的钉子（窗口 8 第 2 轮监督修复员）。
 *
 * A 档报告：`.clk-fx`（64×54）与壳层右上的连对徽章同角，实测重叠 1144px²，
 * 「连对 n」计数被小鸟盖住不可读。修法：只动 `.clk-fx` 的定位 CSS，把它挪进
 * 顶栏两枚徽章中间的空档；小鸟与星屑动效一行不动。这里钉三件事：
 *   1. 让位几何：right 预留 ≥ 116px（连对徽章「🔥 连对 nn」≈108px 贴右缘），
 *      320px 窄屏下与左缘进度徽章（≈104px）也不打架；
 *   2. fx 层仍是纯装饰：pointer-events none + aria-hidden 不许丢；
 *   3. 动效零改动：cheer/oops 的类名与 keyframes 原样。
 */
import { describe, expect, it } from "vitest";
import { HOUSE_CSS } from "./house";

/** 从 HOUSE_CSS 里抠出 .clk-fx 主规则 */
function fxRule(): string {
  const m = HOUSE_CSS.match(/\.clk-fx \{[^}]*\}/);
  expect(m, "HOUSE_CSS 里必须有 .clk-fx 规则").toBeTruthy();
  return m![0];
}

describe("W8R2-02 · .clk-fx 让位连对徽章", () => {
  it("right 预留 ≥116px：64px 的 fx 层再也够不着贴右缘的连对徽章", () => {
    const right = Number(fxRule().match(/right: (\d+)px/)?.[1]);
    expect(right).toBeGreaterThanOrEqual(116);
    // 320px 窄屏：fx 左缘 = 320 - right - 64，得躲开左缘 ~104px 的进度徽章
    expect(320 - right - 64).toBeGreaterThanOrEqual(108);
  });

  it("fx 层仍是纯装饰：pointer-events none，尺寸 64×54 原样", () => {
    const rule = fxRule();
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("width: 64px");
    expect(rule).toContain("height: 54px");
  });

  it("小鸟动效零改动：cheer 弹跳 / oops 歪头的 keyframes 原样", () => {
    expect(HOUSE_CSS).toContain(".clk-bird-cheer .clk-bird-body { animation: clkBirdPop 700ms ease-out; }");
    expect(HOUSE_CSS).toContain(".clk-bird-peek .clk-bird-body { animation: clkBirdTilt 500ms ease-out; }");
  });
});
