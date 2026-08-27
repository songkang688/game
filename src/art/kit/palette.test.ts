import { describe, expect, it } from "vitest";
import { PASTELS, hexToRgb, shade, withAlpha } from "./palette";

describe("art/kit palette", () => {
  it("token 全部是合法 #RRGGBB", () => {
    for (const hex of Object.values(PASTELS)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(hexToRgb("#F4859F")).toEqual([0xf4, 0x85, 0x9f]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    // 认不出来退回中性灰,不抛错
    expect(hexToRgb("oops")).toEqual([128, 128, 128]);
  });

  it("shade 正数朝白、负数朝黑,而且到头就封顶", () => {
    expect(shade("#808080", 100)).toBe("#ffffff");
    expect(shade("#808080", -100)).toBe("#000000");
    const light = hexToRgb(shade("#F4859F", 25));
    const base = hexToRgb("#F4859F");
    const dark = hexToRgb(shade("#F4859F", -15));
    for (let i = 0; i < 3; i++) {
      expect(light[i]).toBeGreaterThanOrEqual(base[i]);
      expect(dark[i]).toBeLessThanOrEqual(base[i]);
    }
    // ±0 不变
    expect(shade("#7FB2F0", 0).toLowerCase()).toBe("#7fb2f0");
  });

  it("withAlpha 产出合法 rgba,且透明度夹在 0..1", () => {
    expect(withAlpha("#FFFFFF", 0.28)).toBe("rgba(255,255,255,0.28)");
    expect(withAlpha("#000000", 9)).toBe("rgba(0,0,0,1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0,0,0,0)");
  });
});
