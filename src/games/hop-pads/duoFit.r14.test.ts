import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DUO_CANVAS_MIN, DUO_CANVAS_WANT, duoCanvasHeightPx } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-54 hop-pads 双人上半场回归", () => {
  it("矮屏 CSS 钳每块画布,函数半屏逻辑仍在", () => {
    expect(SRC).toContain(".hp-duo .hp-canvas{max-height:min(148px,36dvh)}");
    expect(SRC).toContain("vh - 96");
    const h = duoCanvasHeightPx(DUO_CANVAS_WANT, 280, 8);
    expect(h).toBeLessThanOrEqual(136);
    expect(h).toBeGreaterThanOrEqual(DUO_CANVAS_MIN);
  });
});
