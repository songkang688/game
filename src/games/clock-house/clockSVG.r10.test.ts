/**
 * L-2：前 99 关 clockSVG 换 arrowHandD / hubSVG / 11px 刻度。
 * data-h / data-q 与角度公式零触碰。
 */
import { describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { CLK_TOKENS, HOUR_HAND_SHAPE, MINUTE_HAND_SHAPE, arrowHandD, hubSVG } from "./house";
import { hourHandAngle, minuteHandAngle } from "./logic";
import { clockSVG } from "./levels";

describe("L-2 clockSVG 换装", () => {
  const face = clockSVG(4, 1, 120);

  it("开标签 data-h / data-q / 尺寸一字不动", () => {
    expect(face.startsWith('<svg data-h="4" data-q="1" width="120" height="120" viewBox="0 0 100 100"')).toBe(true);
    expect(face).toContain('role="img"');
  });

  it("指针是 arrowHandD 路径，针尖仍按原角度 × 原长度", () => {
    const hA = ((hourHandAngle(4, 1) - 90) * Math.PI) / 180;
    const mA = ((minuteHandAngle(1) - 90) * Math.PI) / 180;
    const hx = Number((50 + Math.cos(hA) * 20).toFixed(1));
    const hy = Number((50 + Math.sin(hA) * 20).toFixed(1));
    const mx = Number((50 + Math.cos(mA) * 30).toFixed(1));
    const my = Number((50 + Math.sin(mA) * 30).toFixed(1));
    expect(face).toContain(`d="${arrowHandD(50, 50, hx, hy, HOUR_HAND_SHAPE)}"`);
    expect(face).toContain(`d="${arrowHandD(50, 50, mx, my, MINUTE_HAND_SHAPE)}"`);
    expect(face).toContain(`fill="${CLK_TOKENS.hourOrange}"`);
    expect(face).toContain(`fill="${CLK_TOKENS.minuteTeal}"`);
    expect(face).toContain(`stroke="${shade(CLK_TOKENS.hourOrange, -30)}"`);
    expect(face).not.toContain("<line");
    expect(face).not.toContain("#e8590c");
    expect(face).not.toContain("#1971c2");
  });

  it("轴心是 hubSVG，刻度 11px 共 12 个", () => {
    expect(face).toContain(hubSVG());
    expect(face).not.toContain('font-size="9"');
    expect((face.match(/font-size="11"/g) ?? []).length).toBe(12);
  });
});
