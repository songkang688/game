/**
 * N-1 · 三人组第 9 轮：接住小水果画布显示高按可视余量钳，
 * backing 360×460 与 CATCH_Y / isCaught 零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATCH_Y, H, W, isCaught } from "./logic";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-1 fruit-catch · canvasDisplayCapPx 钳的是显示高度", () => {
  it("装得下就返回 null", () => {
    expect(canvasDisplayCapPx(460, 500)).toBeNull();
    expect(canvasDisplayCapPx(460, 460)).toBeNull();
    expect(canvasDisplayCapPx(460, 459.5)).toBeNull();
  });

  it("915×412 口径：宽屏按宽算出的显示高远超余量，钳到余量以内", () => {
    // 915 宽、padding 后约 880 显示宽 × 460/360 ≈ 1124 显示高；stage 扣徽章与 ⬅️➡️ 后余量约 180
    const native = 880 * (H / W);
    const px = canvasDisplayCapPx(native, 180);
    expect(px).toBe(180);
    expect(px!).toBeLessThan(native);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("1024×768 仍可能超：余量 280 时钳 280，宽屏 1280 余量充足不钳", () => {
    expect(canvasDisplayCapPx(900, 280)).toBe(280);
    expect(canvasDisplayCapPx(400, 520)).toBeNull();
  });

  it("余量再小也不低于 MIN_CANVAS_DISPLAY_PX；量不出数不动手", () => {
    expect(canvasDisplayCapPx(460, 40)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(460, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(460, 0)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 200)).toBeNull();
  });
});

describe("N-1 物理分辨率与接果判定不动", () => {
  it("backing 仍是 360×460，CATCH_Y 仍贴底", () => {
    expect(W).toBe(360);
    expect(H).toBe(460);
    expect(CATCH_Y).toBe(H - 20);
  });

  it("isCaught 仍按逻辑坐标，不读 CSS 显示高", () => {
    expect(isCaught(180, CATCH_Y, 180)).toBe(true);
    expect(src).toContain("bindCanvasFit(wrap, canvas, jan");
    expect(src).toContain("jan.on(window, \"resize\", fitDisplay)");
    expect(src).not.toMatch(/CATCH_Y\s*=/);
  });
});
