/**
 * 星星合成 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 * 只锁已达标的性质，不改绘制：
 *  ① 块面渐变必须 ≥ 3 停（左上提亮 → 主色 → 右下压暗），三停色两两不同；
 *  ② 星级角标 1–5 档两两不同，且每档都有描边与高光点（体积三件套之二）；
 *  ③ 障碍花 / 奖杯 SVG 里没有 emoji 码点（专项①：核心道具不许 emoji 直出）。
 */
import { describe, expect, it } from "vitest";
import { darkenHex, flowerSVG, lightenHex, starBadgeSVG, tileFaceCSS, trophySVG } from "./art";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

describe("专项②:块面渐变三停", () => {
  it("tileFaceCSS 是 135deg 线性渐变,0%/55%/100% 三停,三停色互不相同", () => {
    const css = tileFaceCSS("#F7C8D4");
    expect(css.startsWith("linear-gradient(135deg,")).toBe(true);
    const stops = css.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(stops.length, "至少三停").toBeGreaterThanOrEqual(3);
    expect(new Set(stops.map((s) => s.toLowerCase())).size, "三停颜色不许重合").toBe(stops.length);
    expect(css).toContain(" 0%");
    expect(css).toContain(" 55%");
    expect(css).toContain(" 100%");
  });

  it("提亮/压暗真的分了阶:lighten 比原色亮、darken 比原色暗", () => {
    const lum = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const base = "#E8B04A";
    expect(lum(lightenHex(base, 0.14))).toBeGreaterThan(lum(base));
    expect(lum(darkenHex(base, 0.06))).toBeLessThan(lum(base));
  });
});

describe("专项②:星级角标体积三件套", () => {
  it("1–5 档角标两两不同,0 档为空", () => {
    expect(starBadgeSVG(0)).toBe("");
    const seen = new Set<string>();
    for (const tier of [1, 2, 3, 4, 5]) seen.add(starBadgeSVG(tier));
    expect(seen.size, "五档角标必须五张不同").toBe(5);
  });

  it("每一档都有描边(stroke=)与白高光点(circle fill #FFFFFF)", () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      const svg = starBadgeSVG(tier);
      expect(svg, `tier ${tier} 缺描边`).toContain("stroke=");
      expect(svg, `tier ${tier} 缺高光点`).toContain(`fill="#FFFFFF"`);
    }
  });

  it("彩虹档(5)是 ≥ 4 停渐变,其余档不共用它的渐变 id", () => {
    const rainbow = starBadgeSVG(5);
    expect((rainbow.match(/<stop /g) ?? []).length).toBeGreaterThanOrEqual(4);
    for (const tier of [1, 2, 3, 4]) expect(starBadgeSVG(tier)).not.toContain("url(#mgrb)");
  });
});

describe("专项①:核心道具零 emoji", () => {
  it("障碍花与奖杯 SVG 不含 emoji 码点,且花有 5 片带描边的花瓣", () => {
    const flower = flowerSVG(20);
    const trophy = trophySVG(48);
    expect(EMOJI_RE.test(flower)).toBe(false);
    expect(EMOJI_RE.test(trophy)).toBe(false);
    expect((flower.match(/rotate\(/g) ?? []).length, "花瓣 5 片(rotate 0/72/144/216/288)+2 叶").toBeGreaterThanOrEqual(5);
    expect(flower).toContain('stroke="#DB6E96"');
  });
});
