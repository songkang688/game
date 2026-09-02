// 竖向裁切审计修复:画布分辨率按屏宽定、显示层 `width:100%;height:auto`——
// 横屏 640×360 上 15 行 × 26px 的图显示高 ~390px,而 `.game-stage` 的可视高
// 只剩 ~280px,画布下半截连同虚拟方向键(触屏的主输入)掉在裁切线以下。
// 修法:`layout.canvasDisplayCapPx(nativeH, roomPx)` 量出余量后给显示层钳
// `max-height`;canvas 是带内在比例的 replaced 元素,宽跟着等比收,不变形;
// 触屏输入是相对滑动(dx/dy),显示缩放不碰任何判定。
import { describe, expect, it } from "vitest";
import { MAX_CELL_PX, MIN_CANVAS_DISPLAY_PX, canvasDisplayCapPx } from "./layout";

describe("canvasDisplayCapPx · 钳的是显示高度", () => {
  it("装得下(余量 ≥ 原生高)就一个样式不写", () => {
    expect(canvasDisplayCapPx(338, 400)).toBeNull();
    expect(canvasDisplayCapPx(338, 338)).toBeNull();
    // 差一个像素以内的亚像素抖动不算超
    expect(canvasDisplayCapPx(338, 337.5)).toBeNull();
  });

  it("装不下就贴着余量钳,向下取整", () => {
    expect(canvasDisplayCapPx(390, 280.9)).toBe(280);
    expect(canvasDisplayCapPx(390, 200)).toBe(200);
  });

  it("余量再小也不低于 MIN_CANVAS_DISPLAY_PX(剩下的交给舞台滚动)", () => {
    expect(canvasDisplayCapPx(390, 100)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(390, MIN_CANVAS_DISPLAY_PX - 1)).toBe(MIN_CANVAS_DISPLAY_PX);
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(canvasDisplayCapPx(390, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(390, 0)).toBeNull();
    expect(canvasDisplayCapPx(390, -60)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 300)).toBeNull();
    expect(canvasDisplayCapPx(0, 300)).toBeNull();
  });

  it("横屏 640×360 实测口径:15 行 × MAX_CELL_PX 的图余量 ~230px → 钳到 230", () => {
    const nativeH = 15 * MAX_CELL_PX; // 390
    const px = canvasDisplayCapPx(nativeH, 230);
    expect(px).toBe(230);
    expect(px!).toBeLessThan(nativeH);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });
});
