/**
 * 三人组 r9 · N-1 fruit-catch 横屏+平板画布出屏。
 * 物理分辨率 W×H 与接果判定不动,只钳显示高。
 */
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";
import { H } from "./logic";

describe("fruit-catch · canvasDisplayCapPx", () => {
  it("装得下就一个样式不写", () => {
    expect(canvasDisplayCapPx(460, 500)).toBeNull();
    expect(canvasDisplayCapPx(460, 460)).toBeNull();
    expect(canvasDisplayCapPx(460, 459.5)).toBeNull();
  });

  it("915×412 口径:显示高随宽拉高,余量 ~220 → 钳到 220", () => {
    const px = canvasDisplayCapPx(H, 220);
    expect(px).toBe(220);
    expect(px!).toBeLessThan(H);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("余量再小也不低于 MIN_CANVAS_DISPLAY_PX", () => {
    expect(canvasDisplayCapPx(H, 80)).toBe(MIN_CANVAS_DISPLAY_PX);
  });

  it("量不出数时不动手", () => {
    expect(canvasDisplayCapPx(H, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(H, 0)).toBeNull();
    expect(canvasDisplayCapPx(H, -20)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 200)).toBeNull();
  });
});
