// 竖向裁切审计修复:16:9 画布按宽长高——横屏 640×360 上显示高 ~356px,而
// `.game-stage` 的可视高只剩 ~280px,画布下半截连同触屏按钮排(纯触屏唯一的
// 输入)掉在裁切线以下。修法:`canvasDisplayCapPx(nativeH, roomPx)` 量出余量后
// 钳 `max-height`;canvas 是带内在比例的 replaced 元素,宽跟着等比收,不变形;
// 判定全在世界坐标里,显示缩放一个数不碰。
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./index";

describe("canvasDisplayCapPx · 钳的是显示高度", () => {
  it("装得下(余量 ≥ 原生高)就一个样式不写", () => {
    expect(canvasDisplayCapPx(356, 400)).toBeNull();
    expect(canvasDisplayCapPx(356, 356)).toBeNull();
    expect(canvasDisplayCapPx(356, 355.5)).toBeNull();
  });

  it("横屏 640×360 实测口径:显示高 356、余量 ~230 → 钳到 230", () => {
    const px = canvasDisplayCapPx(356, 230);
    expect(px).toBe(230);
    expect(px!).toBeLessThan(356);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("余量再小也不低于 MIN_CANVAS_DISPLAY_PX(剩下的交给舞台滚动)", () => {
    expect(canvasDisplayCapPx(356, 100)).toBe(MIN_CANVAS_DISPLAY_PX);
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(canvasDisplayCapPx(356, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(356, 0)).toBeNull();
    expect(canvasDisplayCapPx(356, -30)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 200)).toBeNull();
  });
});
