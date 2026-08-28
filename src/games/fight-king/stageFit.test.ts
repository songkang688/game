// 竖向裁切审计修复:对局画布是 width:100%、height:auto 的 replaced 元素,
// 显示高完全由宽决定——横屏 640×360 上显示高 ~267px,而 `.game-stage` 的可视高
// 只剩 ~280px,画布下面整排触屏摇杆(纯触屏唯一的输入)掉在裁切线以下。
// 修法:`stageMaxWidthPx(cssW, ratioHW, roomPx)` 把 .fk-stage 钳窄,
// 画布高度跟着回到裁切线以内;HUD / 横幅 / 暂停面板都是盒内 absolute 层,不会错位。
import { describe, expect, it } from "vitest";
import { FIGHT_MIN_H, stageMaxWidthPx } from "./index";

/** 两档画布比例(和 index.ts 的 CANVAS_H_WIDE / NARROW ÷ STAGE_WIDTH 同一口径) */
const WIDE = 380 / 900;
const NARROW = 470 / 900;

describe("stageMaxWidthPx · 按可视余量钳画面盒子", () => {
  it("装得下就返回 null,一个样式都不写", () => {
    // 竖屏 360×640:显示高 360×0.522≈188,余量 ~300 → 不用钳
    expect(stageMaxWidthPx(360, NARROW, 300)).toBeNull();
    // 恰好贴线(差 1px 以内的亚像素抖动)也不钳
    const wantH = 360 * NARROW;
    expect(stageMaxWidthPx(360, NARROW, wantH + 4)).toBeNull();
  });

  it("横屏 640×360 实测口径:宽 632、余量 ~160 → 盒子钳到 (160−4)/比例", () => {
    const cap = stageMaxWidthPx(632, WIDE, 160);
    expect(cap).toBe(Math.floor((160 - 4) / WIDE));
    // 钳完的显示高回到余量以内
    expect(cap! * WIDE).toBeLessThanOrEqual(160);
    expect(cap!).toBeLessThan(632);
  });

  it("余量再小显示高也兜在 FIGHT_MIN_H,剩下的交给舞台滚动", () => {
    const cap = stageMaxWidthPx(632, WIDE, 60);
    expect(cap).toBe(Math.floor(FIGHT_MIN_H / WIDE));
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(stageMaxWidthPx(632, WIDE, Number.NaN)).toBeNull();
    expect(stageMaxWidthPx(632, WIDE, 0)).toBeNull();
    expect(stageMaxWidthPx(632, WIDE, -50)).toBeNull();
    expect(stageMaxWidthPx(Number.NaN, WIDE, 200)).toBeNull();
    expect(stageMaxWidthPx(632, Number.NaN, 200)).toBeNull();
    expect(stageMaxWidthPx(632, 0, 200)).toBeNull();
  });

  it("窄屏高比例(470/900)同样成立:钳完高度不超余量", () => {
    const cap = stageMaxWidthPx(500, NARROW, 200);
    expect(cap).not.toBeNull();
    expect(cap! * NARROW).toBeLessThanOrEqual(200);
  });

  it("盒子再窄也不低于 120px(比这更窄画面就没意义了)", () => {
    // 用一个大到荒唐的比例逼出下限
    expect(stageMaxWidthPx(632, 2, 160)).toBe(120);
  });
});
