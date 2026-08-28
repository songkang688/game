// 竖向裁切审计修复:画布高以前只按宽算(clamp(cssW×1.06, 280, 460))——
// 横屏 640×360 上给出 460px,而 `.game-stage` 的可视高只剩 ~280px:
// 画布下半截(角色、蓄力条)全在裁切线以下,「按住蓄力、看条松手」变成闭眼玩。
// 修法:`stageHeightPx(want, room, below)` 量出 root 顶到裁切线的余量后钳一刀;
// 量不出余量(测试桩 / 独立挂载)时原样返回 want,老行为一字不差。
import { describe, expect, it } from "vitest";
import { STAGE_MIN_H, stageHeightPx } from "./index";

describe("stageHeightPx · 按可视余量钳画布高", () => {
  it("量不出余量(NaN / 0 / 负数)时原样返回 want", () => {
    for (const bad of [Number.NaN, 0, -100]) {
      expect(stageHeightPx(460, bad, 30)).toBe(460);
    }
  });

  it("余量宽裕时一分不收", () => {
    // 竖屏 360×640:want 381,余量 ~470,说明行 ~60 → 470−60−4 = 406 ≥ 381
    expect(stageHeightPx(381, 470, 60)).toBe(381);
  });

  it("横屏 640×360 实测口径:want 460、余量 ~280、说明行 ~50 → 钳到 226", () => {
    const h = stageHeightPx(460, 280, 50);
    expect(h).toBe(280 - 50 - 4);
    expect(h).toBeGreaterThanOrEqual(STAGE_MIN_H);
    expect(h).toBeLessThan(460);
  });

  it("再挤也不低于 STAGE_MIN_H(低于它蓄力条就看不清了)", () => {
    expect(stageHeightPx(460, 120, 40)).toBe(STAGE_MIN_H);
    expect(stageHeightPx(460, STAGE_MIN_H, 200)).toBe(STAGE_MIN_H);
  });

  it("below 量不出(NaN / 负数)时当 0 用,不把余量算成 NaN", () => {
    expect(stageHeightPx(460, 300, Number.NaN)).toBe(300 - 4);
    expect(stageHeightPx(460, 300, -20)).toBe(300 - 4);
  });

  it("钳出来的数永远不比 want 大(只收不放)", () => {
    for (const room of [200, 300, 400, 500, 800]) {
      expect(stageHeightPx(380, room, 30)).toBeLessThanOrEqual(380);
    }
  });
});
