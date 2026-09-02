/**
 * 水果忍者 · 窗口 7 第 3 轮(终验)视觉修复用例(C 档终验修复员,只增不减)。
 *
 * 钉住 R2 C 档遗留清单 b 修后状态:章节卡 blurb 的 `Math.min(12,…)` 低封顶
 * 清零,提为 `Math.max(14,…)` 地板(360px 功能小字 ≥14px);R2 降级理由是
 * 「提字号需配套排版」,本轮配套 fitLine 测宽省略号截断落地——360px 双列卡
 * (cw≈153px)装不下整句 blurb 时截到卡内宽补省略号,不再靠相邻卡片盖住
 * 溢出文字。全窗低封顶清零由 qaW7r3.test.ts 聚合断言(1→0 已收紧)把守,
 * 本文件钉本款修法细节。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R3 修复 · 章节卡 blurb 低封顶清零(R2 遗留 b)", () => {
  it("Math.min(12,…) 低封顶清场,blurb 字号改 Math.max(14,…) 地板", () => {
    expect(SRC.includes("Math.min(12, Math.round(ch * 0.16))")).toBe(false);
    expect(SRC).toContain("ctx.font = `${Math.max(14, Math.round(ch * 0.16))}px sans-serif`;");
  });

  it("blurb 与进度行都走 fitLine 测宽截断,不再裸 fillText 溢出压邻卡", () => {
    expect(SRC).toContain('fitLine(unlocked ? st.blurb : "通关上一个果园解锁", innerW)');
    expect(SRC).toContain(
      "fitLine(`${cleared}/${size} 回合 · ⭐${themeStars(progress, i)}/${size * 3}`, innerW)",
    );
    expect(SRC).toContain("const innerW = cw - 20;");
  });

  it("fitLine 用 measureText 测宽、以省略号收尾,且不动原文短句", () => {
    const def = /function fitLine\(text: string, maxW: number\): string \{[\s\S]*?\n  \}/.exec(SRC);
    expect(def, "fitLine 定义丢失").not.toBeNull();
    const body = def![0];
    expect(body).toContain("if (ctx.measureText(text).width <= maxW) return text;");
    expect(body).toContain("return `${out}…`;");
  });
});
