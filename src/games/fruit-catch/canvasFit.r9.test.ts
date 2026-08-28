/**
 * r9 tester-B · N-1 fruit-catch:钳的是 CSS 显示高,物理 W×H 与 CATCH_Y 不动。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CATCH_Y, H, W } from "./logic";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-1 fruit-catch 画布显示高钳", () => {
  it("物理分辨率与接果线原样", () => {
    expect(W).toBe(360);
    expect(H).toBe(460);
    expect(CATCH_Y).toBe(H - 20);
  });

  it("装得下不写样式;余量不够才钳,且不低于 MIN", () => {
    expect(canvasDisplayCapPx(400, 500)).toBeNull();
    expect(canvasDisplayCapPx(400, 400)).toBeNull();
    const px = canvasDisplayCapPx(400, 220);
    expect(px).toBe(220);
    expect(canvasDisplayCapPx(400, 80)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(400, Number.NaN)).toBeNull();
  });

  it("左右钮 sticky 置底;三态都挂 attachCanvasDisplayFit", () => {
    expect(src).toMatch(/\.frc-ctrl \{[^}]*position: sticky/);
    const hits = src.split("attachCanvasDisplayFit(").length - 1;
    expect(hits).toBeGreaterThanOrEqual(3);
  });
});
