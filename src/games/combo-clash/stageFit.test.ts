// 竖向裁切审计修复:HUD(双方血条/能量/护盾)两行 + 提示行 + 摇杆按钮排加起来
// ~200px,画布(355~430×250)又按宽度等比长高——横屏 640×360 上 `.game-stage`
// 只给 ~340px 可视高,画布一占,摇杆和「轻/重/必杀」整排掉到裁切线以下;
// 触屏没键盘,按钮看不见 = 这局没法打。
// 修法:`canvasDisplayCapPx(nativeH, roomPx)` 量出真实余量后钳 `max-height`,
// 且因 CSS 是 width:100%,宽也按 backing 比例一起钳(index.ts fitDisplay),
// 画布等比收窄居中;对局逻辑全在世界坐标里,显示缩放一个数不碰。
import { describe, expect, it } from "vitest";
import { MIN_CANVAS_DISPLAY_PX, STAGE_HEIGHT, canvasDisplayCapPx } from "./index";

describe("combo-clash · canvasDisplayCapPx 钳的是显示高度", () => {
  it("装得下(余量 ≥ 显示高)就一个样式不写", () => {
    expect(canvasDisplayCapPx(250, 400)).toBeNull();
    expect(canvasDisplayCapPx(250, 250)).toBeNull();
    // 亚像素抖动不值得为它改样式
    expect(canvasDisplayCapPx(250, 249.5)).toBeNull();
  });

  it("横屏 640×360 实测口径:显示高 250、扣掉 HUD 与按钮后余量 ~150 → 钳到 150", () => {
    const px = canvasDisplayCapPx(STAGE_HEIGHT, 150);
    expect(px).toBe(150);
    expect(px!).toBeLessThan(STAGE_HEIGHT);
    expect(px!).toBeGreaterThanOrEqual(MIN_CANVAS_DISPLAY_PX);
  });

  it("余量再小也不低于 MIN_CANVAS_DISPLAY_PX(剩下的交给舞台滚动)", () => {
    expect(canvasDisplayCapPx(250, 80)).toBe(MIN_CANVAS_DISPLAY_PX);
  });

  it("窄台(355 宽)按 356px 显示宽换算的显示高同样适用", () => {
    // 356px 显示宽 × (250/355) ≈ 251px 显示高;余量 200 → 钳到 200
    expect(canvasDisplayCapPx(251, 200)).toBe(200);
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(canvasDisplayCapPx(250, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(250, 0)).toBeNull();
    expect(canvasDisplayCapPx(250, -30)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 200)).toBeNull();
    expect(canvasDisplayCapPx(0, 200)).toBeNull();
  });
});
