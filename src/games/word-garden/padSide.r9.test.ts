import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_PAD_PX, SHORT_PAD_MIN_PX, padSidePx } from "./tracing";

const SRC = readFileSync(fileURLToPath(new URL("./tracing.ts", import.meta.url)), "utf8");

describe("N-36 描红米字格高度尺", () => {
  it("915×412 量真实余量后边长短于 300，整格可进屏", () => {
    const { side, allowScroll } = padSidePx(915, 300, 168);
    expect(side).toBeLessThanOrEqual(300);
    expect(side).toBeGreaterThanOrEqual(SHORT_PAD_MIN_PX);
    expect(side).toBe(132);
    expect(allowScroll).toBe(false);
  });

  it("竖屏 390 宽仍守 240 底线，不比修前更小", () => {
    const { side, allowScroll } = padSidePx(390, 700, 180);
    expect(side).toBe(Math.floor(Math.min(390 * 0.72, 300)));
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(false);
  });

  it("没有裁切祖先时不把格子收到 240 以下", () => {
    const { side, allowScroll } = padSidePx(360, Number.POSITIVE_INFINITY, 200);
    expect(side).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(allowScroll).toBe(false);
  });

  it("余量连短边下限都不够才允许滚动兜底", () => {
    const { side, allowScroll } = padSidePx(915, 200, 160);
    expect(side).toBe(MIN_PAD_PX);
    expect(allowScroll).toBe(true);
  });

  it("运行时真的调用 padSidePx，笔顺判定文件零触碰", () => {
    expect(SRC).toContain("padSidePx(vw, room, chrome)");
    expect(SRC).toContain("touch-action:none");
    const strokes = readFileSync(fileURLToPath(new URL("./strokes.ts", import.meta.url)), "utf8");
    expect(strokes).toContain("export function judgeTrace");
  });
});
