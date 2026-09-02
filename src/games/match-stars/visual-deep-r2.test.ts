/**
 * 星星消消乐 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / view.test 不重复）：
 *  1. 16px 微缩健壮性：六色棋子全部是 viewBox 矢量 SVG（缩放安全）、零 emoji；
 *  2. 形状第二通道：六色棋子的形状路径两两互异（色弱靠轮廓认星）；
 *  3. 彩虹星神器感：七彩渐变 ≥6 个色停 + 白芯，零 emoji。
 */
import { describe, expect, it } from "vitest";
import { rainbowStarSVG, tokenSVG } from "./art";

const EMOJI_RE = /[\u2600-\u27bf\u2b00-\u2bff]|[\ud83c-\ud83e][\udc00-\udfff]/;

/** 抠出主体轮廓元素（class="mst-body" 的 polygon points 或 path d）作形状指纹 */
function shapeFingerprint(svg: string): string {
  const m = svg.match(/<(?:polygon|path) class="mst-body"[^>]*(?:points|d)="([^"]+)"/);
  return m ? m[1] : "";
}

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：六色棋子全部 viewBox 矢量、零 emoji", () => {
    for (let c = 0; c < 6; c++) {
      const svg = tokenSVG(c, 0);
      expect(svg, `色 ${c} 不是 SVG`).toContain("<svg");
      expect(svg, `色 ${c} 缺 viewBox（定宽位图不可缩）`).toContain("viewBox");
      expect(EMOJI_RE.test(svg), `色 ${c} 混入 emoji`).toBe(false);
    }
  });

  it("形状第二通道：六色棋子形状路径两两互异", () => {
    const prints = Array.from({ length: 6 }, (_, c) => shapeFingerprint(tokenSVG(c, 0)));
    for (let i = 0; i < 6; i++) {
      expect(prints[i].length, `色 ${i} 没有形状路径`).toBeGreaterThan(0);
      for (let j = i + 1; j < 6; j++) {
        expect(prints[i], `色 ${i} 与色 ${j} 形状相同（只剩颜色单通道）`).not.toBe(prints[j]);
      }
    }
  });

  it("彩虹星：七彩渐变 ≥6 色停 + 白芯、零 emoji", () => {
    const svg = rainbowStarSVG();
    expect(svg).toContain("<svg");
    expect(EMOJI_RE.test(svg)).toBe(false);
    const stops = [...svg.matchAll(/stop-color="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(stops).size, `彩虹渐变只有 ${new Set(stops).size} 种色`).toBeGreaterThanOrEqual(6);
    expect(/#fff|#FFF|white|255,\s*255,\s*255/.test(svg), "白芯要在").toBe(true);
  });
});
