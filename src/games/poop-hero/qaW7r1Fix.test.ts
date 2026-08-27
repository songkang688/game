/**
 * 便便超人 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)严重项修后的状态:
 *  - A-4 香香星:不再贴 ✨ emoji,改 kit `traceStar` 自绘渐变星;
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { drawScentStar } from "./trashArt";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 记账 stub ctx:数渐变停靠 / 描边 / fillText,别的画法照单全收 */
function stubCtx(): { ctx: CanvasRenderingContext2D; stats: { stops: number; strokes: number; fillTexts: number; fills: number } } {
  const stats = { stops: 0, strokes: 0, fillTexts: 0, fills: 0 };
  const gradient = { addColorStop: () => { stats.stops++; } };
  const noop = (): void => {};
  const ctx = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: () => { stats.fills++; },
    stroke: () => { stats.strokes++; },
    fillRect: noop,
    strokeRect: noop,
    fillText: () => { stats.fillTexts++; },
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clip: noop,
    setLineDash: noop,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, stats };
}

describe("窗口7 R1 修复 · A-4 香香星:平涂 ✨ 清场", () => {
  it("index.ts 不再 emoji(✨),改走 drawScentStar", () => {
    expect(/emoji\([^)]*"✨"/u.test(SRC)).toBe(false);
    expect(SRC).toContain("drawScentStar(");
  });

  it("drawScentStar:≥2 停渐变 + 描边 + 零 fillText(体积规格达标)", () => {
    const { ctx, stats } = stubCtx();
    drawScentStar(ctx, 0, 0, 10);
    expect(stats.stops).toBeGreaterThanOrEqual(2);
    expect(stats.strokes).toBeGreaterThanOrEqual(1);
    expect(stats.fills).toBeGreaterThanOrEqual(2);
    expect(stats.fillTexts).toBe(0);
  });
});
