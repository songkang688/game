/**
 * 星光琴键 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 B 档 TOP10 之 8（密度 -1）：上半屏（音符未到区）只有渐变 + 光束，
 * 缺音游基准的主题饰层。修后 draw() 里加 drawDriftSymbols：
 * 5 枚列首同款符号（复用 traceLaneSymbol）极淡上飘，
 * alpha 0.07、周期 14–20.4s、只在判定线上方 60% 区间、reduced 静止定格。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

const fn = indexSrc.match(/function drawDriftSymbols[\s\S]*?\n  \}/)?.[0] ?? "";

describe("fix(visual-r1) B-8：tap-tiles 上半屏主题饰层", () => {
  it("drawDriftSymbols 存在且在 draw() 里被调用(光束之后、音符之前)", () => {
    expect(fn.length).toBeGreaterThan(0);
    expect(indexSrc).toContain("drawDriftSymbols(c, t);");
    const beams = indexSrc.indexOf("drawBeams(c, t);\n    drawDriftSymbols(c, t);");
    expect(beams).toBeGreaterThan(-1);
  });

  it("饰层复用列首符号 traceLaneSymbol,透明度在 0.06–0.08 规格内", () => {
    expect(fn).toContain("traceLaneSymbol(");
    const alpha = fn.match(/globalAlpha = (0\.\d+)/);
    expect(alpha).toBeTruthy();
    expect(Number(alpha![1])).toBeGreaterThanOrEqual(0.06);
    expect(Number(alpha![1])).toBeLessThanOrEqual(0.08);
  });

  it("只在判定线上方活动(span 以 line*0.6 封顶),不遮判定线", () => {
    expect(fn).toContain("line * 0.6");
  });

  it("reduced-motion 时静止定格(相位不吃时间)", () => {
    expect(fn).toContain("reduced ? k / 5 :");
  });
});
