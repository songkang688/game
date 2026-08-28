/**
 * 便便超人 · 窗口 7 第 2 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档 R2 报告(docs/qa/1.3-window7-round2-tester.md)N-2 修后状态:
 * 开场横幅的关卡提示(原 13px)与卫生小知识(原 12px)两处 canvas 功能文字
 * 提到 ≥14px,写法照抄同款门帘计数的 `Math.max(14,…)` 地板;并全量扫描
 * 画布字体,任何写法在 360px(scale≈1)档都不得低于 14px。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R2 修复 · N-2 开场横幅功能文字 ≥14px", () => {
  it("两处点名小字(13px 提示 / 12px 卫生小知识)都装上 14px 地板", () => {
    expect(SRC).toContain("Math.max(14, Math.round(13 * Math.max(0.85, scale)))");
    expect(SRC).toContain("Math.max(14, Math.round(12 * Math.max(0.85, scale)))");
    expect(SRC.includes("`800 ${Math.round(13")).toBe(false);
    expect(SRC.includes("`700 ${Math.round(12")).toBe(false);
  });

  it("整个画布字体全量扫描:字面量 / max(14,…) 地板 / 0.85 缩放下限,一律 ≥14px", () => {
    const fonts = [...SRC.matchAll(/\.font = (["`])(.*?)\1/g)].map((m) => m[2]);
    expect(fonts.length).toBeGreaterThanOrEqual(5);
    for (const f of fonts) {
      if (f.includes("Math.max(14,")) continue; // 显式 14px 地板
      const lit = /(?:^|\s)(\d+(?:\.\d+)?)px/.exec(f);
      if (lit) {
        expect(Number(lit[1]), `字面量字号偷小:${f}`).toBeGreaterThanOrEqual(14);
        continue;
      }
      // 剩下的必须是「基准字号 × max(0.85, scale)」缩放写法,且 0.85 档不破 14px
      const m = /Math\.round\((\d+(?:\.\d+)?) \* Math\.max\(0\.85/.exec(f);
      expect(m, `未知的字体写法:${f}`).toBeTruthy();
      expect(Number(m![1]) * 0.85, `缩放下限破 14px:${f}`).toBeGreaterThanOrEqual(14);
    }
  });
});
