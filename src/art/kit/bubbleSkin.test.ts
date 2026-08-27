// 泡泡皮肤(bubbleSkin)单测:平涂机器化断言 + 规格常量一测。
import { describe, expect, it } from "vitest";
import {
  BUBBLE_CRESCENT_MIN_PX,
  BUBBLE_DARKEN,
  BUBBLE_HIGHLIGHT_X,
  BUBBLE_HIGHLIGHT_Y,
  BUBBLE_INNER_ARC,
  BUBBLE_LIGHTEN,
  bubbleBody,
  bubbleCrescentVisible,
  bubbleHighlight,
  bubbleSkin,
} from "./bubbleSkin";
import { shade } from "./palette";

const BASES = ["#FF9EC8", "#8FCBFF", "#9FE08D", "#FFD26E", "#C9A0F0"];

describe("bubbleSkin:三层叠加,盘面上不许存在平涂泡", () => {
  it("background 含 ≥2 层 gradient(平涂机器化断言)", () => {
    for (const base of BASES) {
      const layers = bubbleSkin(base).background.match(/radial-gradient\(/g) ?? [];
      expect(layers.length, `${base} 层数不足`).toBeGreaterThanOrEqual(2);
    }
  });

  it("输出不是单一纯色(既不是裸 hex 也不是裸 rgb)", () => {
    for (const base of BASES) {
      const bg = bubbleSkin(base).background;
      expect(bg).not.toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(bg).not.toMatch(/^rgba?\([^)]*\)$/);
      expect(bg).toContain("gradient(");
    }
  });

  it("主高光斑:圆心 30%,24%,白 .8 → 40% 处透明", () => {
    expect(BUBBLE_HIGHLIGHT_X).toBe("30%");
    expect(BUBBLE_HIGHLIGHT_Y).toBe("24%");
    expect(bubbleHighlight()).toBe(
      "radial-gradient(circle at 30% 24%, rgba(255,255,255,.8), transparent 40%)"
    );
  });

  it("主体明暗:shade(+10) 起 → shade(-12) 94% 收边", () => {
    expect(BUBBLE_LIGHTEN).toBe(10);
    expect(BUBBLE_DARKEN).toBe(-12);
    for (const base of BASES) {
      const body = bubbleBody(base);
      expect(body).toContain(shade(base, 10));
      expect(body).toContain(`${shade(base, -12)} 94%`);
      expect(body).toContain("circle at 50% 46%");
    }
  });

  it("底部内缘反光弧:inset 白 20%,随皮肤一起返回", () => {
    expect(BUBBLE_INNER_ARC).toBe("inset 0 -2px 4px rgba(255,255,255,.2)");
    expect(bubbleSkin("#FF9EC8").boxShadow).toBe(BUBBLE_INNER_ARC);
  });

  it("副高光小月牙:泡径 < 32px 省略,≥ 32px 保留", () => {
    expect(BUBBLE_CRESCENT_MIN_PX).toBe(32);
    expect(bubbleCrescentVisible(31.9)).toBe(false);
    expect(bubbleCrescentVisible(32)).toBe(true);
    expect(bubbleCrescentVisible(48)).toBe(true);
    expect(bubbleCrescentVisible(0)).toBe(false);
  });
});
