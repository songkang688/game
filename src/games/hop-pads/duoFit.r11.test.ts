import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DUO_CANVAS_MIN, DUO_CANVAS_WANT, duoCanvasHeightPx, stageHeightPx } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-54 hop-pads 双人同屏按半屏钳高", () => {
  it("余量够时仍用 236,不够则对半切且不低于下限", () => {
    expect(duoCanvasHeightPx(DUO_CANVAS_WANT, Number.NaN, 8)).toBe(DUO_CANVAS_WANT);
    expect(duoCanvasHeightPx(DUO_CANVAS_WANT, 500, 8)).toBe(DUO_CANVAS_WANT);
    const h = duoCanvasHeightPx(DUO_CANVAS_WANT, 280, 8);
    expect(h).toBeLessThanOrEqual(136);
    expect(h).toBeGreaterThanOrEqual(DUO_CANVAS_MIN);
    expect(duoCanvasHeightPx(DUO_CANVAS_WANT, 80, 8)).toBe(DUO_CANVAS_MIN);
  });

  it("双人走 duoH 回调,单人仍走 stageHeightPx,不写死 236", () => {
    expect(SRC).toContain("height: duoH");
    expect(SRC).not.toContain("height: 236");
    expect(SRC).toContain("wantH ?? stageHeightPx");
    expect(stageHeightPx(381, 470, 60)).toBe(381);
  });
});
