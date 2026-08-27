/**
 * 共享美术套件 · 色板工具单测（窗口8 B 档）。
 * 纯函数，node 环境直接算。
 */
import { describe, expect, it } from "vitest";
import { PASTEL, parseHex, shade, withAlpha } from "./palette";

describe("art-kit · palette", () => {
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
    expect(shade("#FFFFFF", 40)).toBe("#FFFFFF");
    expect(shade("#000000", -40)).toBe("#000000");
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
