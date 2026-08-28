import { describe, expect, it } from "vitest";
import {
  CHAR_COLORS,
  KIT_PALETTE,
  PASTEL,
  PASTELS,
  hexToRgb,
  luma,
  parseHex,
  rgbToHex,
  shade,
  tint,
  tryHexToRgb,
  withAlpha
} from "./palette";

const HEX_RE = /^#[0-9a-f]{6}$/;

/** 简易色相（度）：断言两位角色主色色相拉开 */
function hueOf(hex: string): number {
  const rgb = tryHexToRgb(hex);
  if (!rgb) return NaN;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

/** 明度粗算：断言 shade/tint 单调 */
function lum(hex: string): number {
  const rgb = tryHexToRgb(hex);
  if (!rgb) return NaN;
  return rgb.r + rgb.g + rgb.b;
}

describe("KIT_PALETTE 调色板", () => {
  it("全部色值是合法小写 #rrggbb", () => {
    const entries = Object.entries(KIT_PALETTE);
    expect(entries.length).toBeGreaterThanOrEqual(12);
    for (const [name, hex] of entries) {
      expect(hex, `KIT_PALETTE.${name}`).toMatch(HEX_RE);
    }
  });

  it("CHAR_COLORS 两组四件套全部合法", () => {
    for (const who of ["duoduo", "xingxing"] as const) {
      const set = CHAR_COLORS[who];
      for (const key of ["primary", "secondary", "accent", "outline"] as const) {
        expect(set[key], `${who}.${key}`).toMatch(HEX_RE);
      }
    }
  });

  it("朵朵与星星的 primary 不相等且色相拉开(双人一眼可区分)", () => {
    const a = CHAR_COLORS.duoduo.primary;
    const b = CHAR_COLORS.xingxing.primary;
    expect(a).not.toBe(b);
    const diff = Math.abs(hueOf(a) - hueOf(b));
    const hueDist = Math.min(diff, 360 - diff);
    expect(hueDist).toBeGreaterThanOrEqual(60);
  });
});

describe("shade / tint 明暗推导", () => {
  it("shade 单调变暗且输出合法", () => {
    const base = KIT_PALETTE.candy;
    const s1 = shade(base, 0.15);
    const s2 = shade(base, 0.4);
    const s3 = shade(base, 0.8);
    for (const s of [s1, s2, s3]) expect(s).toMatch(HEX_RE);
    expect(lum(s1)).toBeLessThan(lum(base));
    expect(lum(s2)).toBeLessThan(lum(s1));
    expect(lum(s3)).toBeLessThan(lum(s2));
  });

  it("tint 单调变亮且输出合法", () => {
    const base = KIT_PALETTE.grassDeep;
    const t1 = tint(base, 0.15);
    const t2 = tint(base, 0.4);
    const t3 = tint(base, 0.8);
    for (const t of [t1, t2, t3]) expect(t).toMatch(HEX_RE);
    expect(lum(t1)).toBeGreaterThan(lum(base));
    expect(lum(t2)).toBeGreaterThan(lum(t1));
    expect(lum(t3)).toBeGreaterThan(lum(t2));
  });

  it("amount=0 恒等,amount=1 到黑/白,tint 越界自动 clamp", () => {
    expect(shade("#ffb3d2", 0)).toBe("#ffb3d2");
    expect(tint("#ffb3d2", 0)).toBe("#ffb3d2");
    expect(shade("#ffb3d2", 1)).toBe("#000000");
    expect(tint("#ffb3d2", 1)).toBe("#ffffff");
    expect(tint("#ffb3d2", -3)).toBe("#ffb3d2");
  });

  it("非法 hex 在 0–1 口径下原样返回、不抛", () => {
    for (const bad of ["金币", "", "#12", "#12345g", "rgb(1,2,3)", "#ffb3d"]) {
      expect(() => shade(bad, 0.3)).not.toThrow();
      expect(() => tint(bad, 0.3)).not.toThrow();
      expect(shade(bad, 0.3)).toBe(bad);
      expect(tint(bad, 0.3)).toBe(bad);
    }
    const junk = 123 as unknown as string;
    expect(shade(junk, 0.3)).toBe(junk);
  });

  it("非法 amount(NaN/±Infinity)不抛,返回原色", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => shade("#a5e6c8", bad)).not.toThrow();
      expect(shade("#a5e6c8", bad)).toBe("#a5e6c8");
      expect(tint("#a5e6c8", bad)).toBe("#a5e6c8");
    }
  });
});

describe("tryHexToRgb / rgbToHex", () => {
  it("互为往返,非法输入返回 null", () => {
    expect(tryHexToRgb("#ffd34e")).toEqual({ r: 255, g: 211, b: 78 });
    expect(rgbToHex(255, 211, 78)).toBe("#ffd34e");
    expect(tryHexToRgb("nope")).toBeNull();
    expect(tryHexToRgb("#ffd34")).toBeNull();
    expect(rgbToHex(999, -5, 12.4)).toBe("#ff000c");
  });
});

describe("art/kit palette（窗口 5）", () => {
  it("token 全部是合法 #RRGGBB", () => {
    for (const hex of Object.values(PASTELS)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(hexToRgb("#F4859F")).toEqual([0xf4, 0x85, 0x9f]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
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
    expect(shade("#7FB2F0", 0).toLowerCase()).toBe("#7fb2f0");
  });

  it("withAlpha 产出合法 rgba,且透明度夹在 0..1", () => {
    expect(withAlpha("#FFFFFF", 0.28)).toBe("rgba(255,255,255,0.28)");
    expect(withAlpha("#000000", 9)).toBe("rgba(0,0,0,1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0,0,0,0)");
  });
});

describe("palette · 窗口 6 粉彩 token", () => {
  it("基础 token 齐全且都是合法 #rrggbb", () => {
    const keys = ["paper", "ink", "pink", "blue", "mint", "lemon", "lilac"] as const;
    for (const k of keys) expect(PASTEL[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("五色和 sparklePaper 一家人:粉 / 蓝 / 薄荷 / 柠檬 / 丁香", () => {
    expect(PASTEL.pink).toBe("#ffb6c9");
    expect(PASTEL.blue).toBe("#a9d8ff");
    expect(PASTEL.mint).toBe("#8fe0c4");
    expect(PASTEL.lemon).toBe("#ffd75e");
    expect(PASTEL.lilac).toBe("#d9bcff");
  });
});

describe("palette · 窗口 6 颜色换算", () => {
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
    expect(shade("#C89B6C", -22)).toBe("#9c7954");
    expect(shade("#D9A06B", -22)).toBe("#a97d53");
  });

  it("shade(+20) 往白提亮 20%:顶光的换算口径", () => {
    expect(shade("#C89B6C", 20)).toBe("#d3af89");
  });

  it("luma 单调:白 1、黑 0、粉彩都在中高段", () => {
    expect(luma("#ffffff")).toBeCloseTo(1, 5);
    expect(luma("#000000")).toBe(0);
    expect(luma(PASTEL.paper)).toBeGreaterThan(luma(PASTEL.ink));
  });
});

describe("art-kit · palette（窗口 8）", () => {
  it("parseHex 认 #RGB 与 #RRGGBB，垃圾输入拿到 null 而不是炸", () => {
    expect(parseHex("#E85D75")).toEqual([232, 93, 117]);
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("red")).toBeNull();
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("shade 负数往深压、正数往亮提，且每个通道都动了", () => {
    const dark = parseHex(shade("#E85D75", -12))!;
    const base = parseHex("#E85D75")!;
    for (let i = 0; i < 3; i++) expect(dark[i]).toBeLessThan(base[i]);
    const light = parseHex(shade("#4A7FD8", 10))!;
    const blue = parseHex("#4A7FD8")!;
    for (let i = 0; i < 3; i++) expect(light[i]).toBeGreaterThan(blue[i]);
  });

  it("shade 到头不越界：白提不上去、黑压不下去、解析不了原样退回", () => {
    expect(shade("#FFFFFF", 40).toLowerCase()).toBe("#ffffff");
    expect(shade("#000000", -40).toLowerCase()).toBe("#000000");
    expect(shade("linear-gradient(red)", -12)).toBe("linear-gradient(red)");
  });

  it("withAlpha 给出合法 rgba，透明度夹在 0..1", () => {
    expect(withAlpha("#FFD678", 0.6)).toBe("rgba(255,214,120,0.6)");
    expect(withAlpha("#FFD678", 8)).toBe("rgba(255,214,120,1)");
    expect(withAlpha("#FFD678", -1)).toBe("rgba(255,214,120,0)");
  });

  it("粉彩 token 一个不少，全是能解析的十六进制", () => {
    for (const [name, hex] of Object.entries(PASTEL)) {
      expect(parseHex(hex), `PASTEL.${name} 不是合法颜色`).not.toBeNull();
    }
  });
});
