/**
 * 水果切切乐 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)问题 6 修后的状态:
 * 果王头顶不再贴 emoji 身份牌,改自绘小皇冠(渐变 + 描边 + 束带 + 高光),
 * 珠色 = 三位果王的身份通道(金 / 粉 / 蓝)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { KING_INFO } from "./logic";
import { drawKingCrown, kingBeadColor } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function stubCtx(): { ctx: CanvasRenderingContext2D; stats: { stops: number; strokes: number; fills: number; fillTexts: number } } {
  const stats = { stops: 0, strokes: 0, fills: 0, fillTexts: 0 };
  const gradient = { addColorStop: () => { stats.stops++; } };
  const noop = (): void => {};
  const ctx = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: () => { stats.fills++; },
    stroke: () => { stats.strokes++; },
    fillText: () => { stats.fillTexts++; },
    save: noop,
    restore: noop,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, stats };
}

describe("窗口7 R1 修复 · A-6 果王头顶身份牌:emoji 清场", () => {
  it("drawKing 不再 fillText(k.spec.emoji),改走 drawKingCrown", () => {
    expect(SRC.includes("fillText(k.spec.emoji")).toBe(false);
    expect(SRC).toContain("drawKingCrown(ctx, r, kingBeadColor(k.spec))");
  });

  it("自绘皇冠:2 停渐变 + 描边 + 多层填充 + 零 fillText", () => {
    const { ctx, stats } = stubCtx();
    drawKingCrown(ctx, 62, "#7FC8E8");
    expect(stats.stops).toBe(2);
    expect(stats.strokes).toBeGreaterThanOrEqual(4);
    // 冠身 + 珠 ×3 + 束带 + 高光 = 至少 6 次填充
    expect(stats.fills).toBeGreaterThanOrEqual(6);
    expect(stats.fillTexts).toBe(0);
  });

  it("珠色身份通道:三位果王三色互不相同(金/粉/蓝)", () => {
    const colors = [
      kingBeadColor(KING_INFO.swirlKing),
      kingBeadColor(KING_INFO.decreeKing),
      kingBeadColor(KING_INFO.grandKing),
    ];
    expect(new Set(colors).size).toBe(3);
    expect(kingBeadColor(KING_INFO.grandKing)).toBe("#FFE9A8");
    expect(kingBeadColor(KING_INFO.decreeKing)).toBe("#F4859F");
    expect(kingBeadColor(KING_INFO.swirlKing)).toBe("#7FC8E8");
  });
});
