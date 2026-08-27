/**
 * 共享美术套件 · 果冻按钮样式单测（窗口8 B 档）。
 * 盯两件事：输出真是「渐变 + 高光带」而不是纯色；按下态只有 transform、零几何属性。
 */
import { describe, expect, it } from "vitest";
import { shade } from "./palette";
import {
  JELLY_EDGE_SHADE,
  JELLY_FACE_PX,
  JELLY_PRESS_SCALE,
  JELLY_PRESS_SQUASH_Y,
  JELLY_RIPPLE_MS,
  JELLY_RIPPLE_SPREAD,
  JELLY_SQUASH_MS,
  jellyFill,
  jellyPressTransform,
  jellyStyle
} from "./jellyBtn";

describe("art-kit · jellyBtn", () => {
  it("填充是径向渐变主体 + 白色高光带，两层都在，不是纯色", () => {
    const fill = jellyFill("#4A7FD8");
    expect(fill).toContain("radial-gradient(circle");
    expect(fill).toContain("rgba(255,255,255,0.3)");
    expect(fill.split("gradient").length - 1).toBeGreaterThanOrEqual(2);
    expect(fill).not.toBe("#4A7FD8");
  });

  it("渐变里带着「中心亮 → 边缘压 12%」两端的颜色", () => {
    const fill = jellyFill("#E85D75");
    expect(JELLY_EDGE_SHADE).toBe(-12);
    expect(fill).toContain(shade("#E85D75", 10));
    expect(fill).toContain(shade("#E85D75", JELLY_EDGE_SHADE));
  });

  it("三件套配齐：描边与立面都比主色深，立面厚 3px", () => {
    const st = jellyStyle("#4A7FD8");
    expect(st.background).toContain("radial-gradient");
    expect(st.borderColor).toBe(shade("#4A7FD8", -28));
    expect(st.faceColor).toBe(shade("#4A7FD8", -34));
    expect(JELLY_FACE_PX).toBe(3);
  });

  it("按下态只有 transform：scale(0.94) + scaleY(0.97)，一个几何属性都不出现", () => {
    const t = jellyPressTransform();
    expect(t).toContain(`scale(${JELLY_PRESS_SCALE})`);
    expect(t).toContain(`scaleY(${JELLY_PRESS_SQUASH_Y})`);
    for (const banned of ["width", "height", "padding", "margin", "border"]) {
      expect(t).not.toContain(banned);
    }
    expect(JELLY_SQUASH_MS).toBe(60);
  });

  it("波纹参数照工序单：扩散 1.4 倍、240ms", () => {
    expect(JELLY_RIPPLE_SPREAD).toBe(1.4);
    expect(JELLY_RIPPLE_MS).toBe(240);
  });
});
