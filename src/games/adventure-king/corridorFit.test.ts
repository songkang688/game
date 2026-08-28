import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CORRIDOR_CANVAS_MIN_H, corridorCanvasCssH, corridorWantH } from "./corridorFit";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-16 走廊引擎三态按余量钳画布", () => {
  it("915 宽按旧公式仍想要 430，矮屏余量把它收到键排上方", () => {
    const want = corridorWantH(915);
    expect(want).toBe(430);
    const h = corridorCanvasCssH(want, 300, 108);
    expect(h).toBe(300 - 108 - 4);
    expect(h).toBeGreaterThanOrEqual(CORRIDOR_CANVAS_MIN_H);
    expect(h).toBeLessThan(412);
  });

  it("量不出裁切祖先时原样 want（竖屏/独立挂载零回归）", () => {
    expect(corridorCanvasCssH(371, Number.POSITIVE_INFINITY, 100)).toBe(371);
    expect(corridorCanvasCssH(371, 0, 100)).toBe(371);
    expect(corridorWantH(412)).toBe(371);
  });

  it("createRunner 三态共用钳高，古堡不走这条", () => {
    expect(SRC).toContain("corridorCanvasCssH(want, room, below)");
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".ak-pad{position:sticky;bottom:0");
    expect(SRC).toContain(".ak-tip{display:none;}");
    const runner = SRC.slice(SRC.indexOf("function createRunner"), SRC.indexOf("function playLevel"));
    expect(runner).toContain("corridorWantH");
    expect(runner).not.toContain("advk-shell");
  });
});
