// balloonSkin · 三层渐变皮肤单测:平涂机器化断言 + 常量规格一测。
import { describe, expect, it } from "vitest";
import {
  SKIN_BODY_AT,
  SKIN_DARKEN,
  SKIN_HIGHLIGHT_AT,
  SKIN_LIGHTEN,
  SKIN_REFLECT_AT,
  balloonSkin,
  balloonSkinLayers,
  splitLayers,
} from "./balloonSkin";
import { shade } from "./palette";

describe("balloonSkin · 三层渐变皮肤(平涂机器化断言)", () => {
  it("输出恰好三层背景,且含两处以上 radial-gradient", () => {
    const bg = balloonSkin("#F0605F");
    const layers = splitLayers(bg);
    expect(layers.length).toBe(3);
    const radials = bg.match(/radial-gradient\(/g) ?? [];
    expect(radials.length).toBeGreaterThanOrEqual(2);
  });

  it("任何主色都不会退化成纯色平涂:每一层都是 gradient", () => {
    for (const base of ["#F0605F", "#F5C142", "#4F94E8", "#6BBB4E", "#9E6BD9", "#9A9AAE", "#E8A33D"]) {
      const layers = balloonSkinLayers(base);
      expect(layers.length).toBe(3);
      for (const layer of layers) expect(layer).toContain("gradient(");
      expect(balloonSkin(base)).not.toBe(base);
    }
  });

  it("明暗换算走 shade(+8 / -12),主体层里两档色都在", () => {
    expect(SKIN_LIGHTEN).toBe(8);
    expect(SKIN_DARKEN).toBe(-12);
    const base = "#4F94E8";
    const body = balloonSkinLayers(base)[2];
    expect(body).toContain(shade(base, SKIN_LIGHTEN));
    expect(body).toContain(shade(base, SKIN_DARKEN));
    expect(shade(base, SKIN_LIGHTEN)).not.toBe(shade(base, SKIN_DARKEN));
  });

  it("高光位置在左上 28%,22%;弱反光在右下 72%,78%", () => {
    expect(SKIN_HIGHLIGHT_AT).toEqual({ x: 28, y: 22 });
    expect(SKIN_REFLECT_AT).toEqual({ x: 72, y: 78 });
    expect(SKIN_BODY_AT).toEqual({ x: 45, y: 40 });
    const [hi, lo] = balloonSkinLayers("#F0605F");
    expect(hi).toContain("circle at 28% 22%");
    expect(lo).toContain("circle at 72% 78%");
  });

  it("层序从上到下:主高光 → 弱反光 → 主体明暗", () => {
    const [hi, lo, body] = balloonSkinLayers("#6BBB4E");
    expect(hi).toContain("rgba(255,255,255,.85)");
    expect(lo).toContain("rgba(255,255,255,.18)");
    expect(body).not.toContain("rgba(255,255,255");
  });

  it("splitLayers 按括号外逗号拆层,能把 join 还原回去", () => {
    const layers = balloonSkinLayers("#9E6BD9");
    expect(splitLayers(layers.join(", "))).toEqual([...layers]);
    // 括号里的逗号(渐变色标)不许被误拆
    expect(splitLayers("radial-gradient(circle at 1% 2%, #fff, #000)")).toHaveLength(1);
  });
});
