// 竖向裁切审计修复:井画布只有 `max-width:100%` 按宽缩,20 行的井(24px 一格连墙
// 488px)在 360×640 竖屏上把触屏按钮排(手机上唯一的操作入口)整排顶到
// `.game-stage` 的裁切线以下;横屏 640×360 更是井本身只剩上半截。
// 修法:`wellDisplayPx(nativeH, roomPx)` 量出可视余量后钳 CSS 显示高度;
// backing store 与判定一个数不动,手势按相对位移换算不受缩放影响。
import { describe, expect, it } from "vitest";
import { WELL_DISPLAY_MIN, wellDisplayPx } from "./index";

describe("wellDisplayPx · 钳的是显示高度", () => {
  it("装得下(余量 ≥ 原生高)就一个字不写", () => {
    expect(wellDisplayPx(488, 600)).toBeNull();
    expect(wellDisplayPx(488, 488)).toBeNull();
    // 差一个像素以内不算超:亚像素抖动不值得为它改样式
    expect(wellDisplayPx(488, 487.5)).toBeNull();
  });

  it("装不下就贴着余量钳,向下取整", () => {
    expect(wellDisplayPx(488, 420.7)).toBe(420);
    expect(wellDisplayPx(488, 300)).toBe(300);
  });

  it("余量再小也不低于 WELL_DISPLAY_MIN(剩下的交给舞台滚动)", () => {
    expect(wellDisplayPx(488, 120)).toBe(WELL_DISPLAY_MIN);
    expect(wellDisplayPx(488, WELL_DISPLAY_MIN - 1)).toBe(WELL_DISPLAY_MIN);
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(wellDisplayPx(488, Number.NaN)).toBeNull();
    expect(wellDisplayPx(488, 0)).toBeNull();
    expect(wellDisplayPx(488, -50)).toBeNull();
    expect(wellDisplayPx(Number.NaN, 400)).toBeNull();
    expect(wellDisplayPx(0, 400)).toBeNull();
  });

  it("360×640 竖屏实测口径:井 488px、可视余量 ~430px → 钳到 430,按钮排回到屏内", () => {
    // 640 视口 − 顶栏(~48) − 舞台白边(8) − 目标行(~34) − 名牌(~24) − 按钮排(~52) − 提示行(~26) ≈ 430
    const px = wellDisplayPx(488, 430);
    expect(px).toBe(430);
    expect(px!).toBeLessThan(488);
    expect(px!).toBeGreaterThanOrEqual(WELL_DISPLAY_MIN);
  });

  it("640×360 横屏实测口径:余量 ~150px → 兜在下限,井大半可见,其余靠滚动", () => {
    expect(wellDisplayPx(488, 150)).toBe(WELL_DISPLAY_MIN);
  });
});
