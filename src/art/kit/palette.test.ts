// 共享美术套件 · 粉彩色板与 shade 换算单测(窗口 6 第 18 步 C 档)。
import { describe, expect, it } from "vitest";
import { PASTEL, hexToRgb, luma, rgbToHex, shade } from "./palette";

describe("palette · 粉彩 token", () => {
  it("基础 token 齐全且都是合法 #rrggbb", () => {
    const keys = ["paper", "ink", "pink", "blue", "mint", "lemon", "lilac"] as const;
    for (const k of keys) expect(PASTEL[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("五色和 sparkle 一家人:粉 / 蓝 / 薄荷 / 柠檬 / 丁香", () => {
    expect(PASTEL.pink).toBe("#ffb6c9");
    expect(PASTEL.blue).toBe("#a9d8ff");
    expect(PASTEL.mint).toBe("#8fe0c4");
    expect(PASTEL.lemon).toBe("#ffd75e");
    expect(PASTEL.lilac).toBe("#d9bcff");
  });
});

describe("palette · 颜色换算", () => {
  it("hexToRgb / rgbToHex 互逆,#rgb 简写也认", () => {
    expect(hexToRgb("#C89B6C")).toEqual([200, 155, 108]);
    expect(rgbToHex(200, 155, 108)).toBe("#c89b6c");
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(rgbToHex(300, -5, 12)).toBe("#ff000c");
  });

  it("shade(x, 0) 不变,+100 全白,-100 全黑", () => {
    expect(shade("#C89B6C", 0)).toBe("#c89b6c");
    expect(shade("#C89B6C", 100)).toBe("#ffffff");
    expect(shade("#C89B6C", -100)).toBe("#000000");
  });

  it("shade(-22) 每个分量都乘 0.78:立柱 / 箱侧面的换算口径", () => {
    // 200*0.78=156, 155*0.78=120.9→121, 108*0.78=84.24→84
    expect(shade("#C89B6C", -22)).toBe("#9c7954");
    // 217*0.78=169.26→169, 160*0.78=124.8→125, 107*0.78=83.46→83
    expect(shade("#D9A06B", -22)).toBe("#a97d53");
  });

  it("shade(+20) 往白提亮 20%:顶光的换算口径", () => {
    // 200+(55*0.2)=211, 155+(100*0.2)=175, 108+(147*0.2)=137.4→137
    expect(shade("#C89B6C", 20)).toBe("#d3af89");
  });

  it("luma 单调:白 1、黑 0、粉彩都在中高段", () => {
    expect(luma("#ffffff")).toBeCloseTo(1, 5);
    expect(luma("#000000")).toBe(0);
    expect(luma(PASTEL.paper)).toBeGreaterThan(luma(PASTEL.ink));
  });
});
