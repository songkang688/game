/**
 * N-36：描红米字格边长高度尺。
 * `.wgd-pad` 是 touch-action:none，格子出屏就没有滚动逃生门。
 */
import { describe, expect, it } from "vitest";
import {
  MIN_PAD_PX,
  PAD_FIT_FLOOR_PX,
  PAD_MAX_PX,
  padVwRatio,
  tracePadChromePx,
  tracePadSidePx,
  WGD_CSS
} from "./tracing";

describe("N-36 描红 pad 高度尺", () => {
  it("宽屏高余量：边长封顶 300，与竖屏/平板基线一致", () => {
    expect(tracePadSidePx(390, 700)).toBe(PAD_MAX_PX);
    expect(tracePadSidePx(412, 700)).toBe(PAD_MAX_PX);
    expect(tracePadSidePx(1024, 700)).toBe(PAD_MAX_PX);
    expect(tracePadSidePx(1280, 700)).toBe(PAD_MAX_PX);
  });

  it("915×412 矮横屏：按高度余量收下，整格能进屏", () => {
    const chrome = tracePadChromePx({
      topH: 32,
      cardH: 40,
      gardenH: 28,
      msgH: 22,
      deskPadV: 8,
      wrapGap: 4,
      wrapPadV: 12
    });
    const hostH = 280;
    const side = tracePadSidePx(915, hostH - chrome);
    expect(side).toBeLessThanOrEqual(hostH - chrome);
    expect(side).toBeGreaterThanOrEqual(PAD_FIT_FLOOR_PX);
    expect(side).toBeLessThan(PAD_MAX_PX);
  });

  it("余量够 MIN_PAD 时不小于 240；余量是正数但不夠时不低于硬底", () => {
    expect(tracePadSidePx(915, 260)).toBeGreaterThanOrEqual(MIN_PAD_PX);
    expect(tracePadSidePx(915, 180)).toBe(Math.max(PAD_FIT_FLOOR_PX, 180));
    expect(padVwRatio(390)).toBe(0.86);
    expect(padVwRatio(915)).toBe(0.72);
  });

  it("CSS 接上高度尺变量，矮屏松开 min-width 才钳得动", () => {
    expect(WGD_CSS).toContain("var(--wgd-pad-side");
    expect(WGD_CSS).toContain("@media (max-height:500px)");
    expect(WGD_CSS).toMatch(/max-height:500px\)\{[\s\S]*\.wgd-pad\{min-width:0/);
  });
});
