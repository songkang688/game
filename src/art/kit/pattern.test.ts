/**
 * 拼图场景画套件用例(窗口 7 R1 修复,C 档首建归 C 档)。
 * 钉住:确定性、三层构图规格、切片视窗数学、干扰块走 alt 场景、零 emoji。
 */
import { describe, expect, it } from "vitest";

import {
  PATTERN_CELL,
  PATTERN_STROKE,
  patternDefsSvg,
  patternSceneId,
  patternSliceNestedSvg,
  patternSliceSvg,
} from "./pattern";

describe("kit pattern · 场景画规格", () => {
  it("同样入参永远同一字符串(确定性,两次进同一关一个样)", () => {
    expect(patternDefsSvg(0, 3, 3)).toBe(patternDefsSvg(0, 3, 3));
    expect(patternSliceSvg(4, 4, 4, 7)).toBe(patternSliceSvg(4, 4, 4, 7));
  });

  it("三层构图:2 停天空渐变 + 光斑圆盘(径向心 .35 左上光源 + 高光)+ 远近两条地形带", () => {
    const svg = patternDefsSvg(0, 3, 3);
    expect(svg).toContain('id="pzp-t0-3x3"');
    expect(svg).toContain('id="pzp-t0-3x3-sky"');
    expect(svg).toContain('cx=".35" cy=".35"');
    expect(svg).toContain('id="pzp-t0-3x3-far"');
    expect(svg).toContain('id="pzp-t0-3x3-near"');
    // 主体统一 1.5px 描边(vector-effect 钉住屏幕像素)
    expect(svg).toContain(`stroke="${PATTERN_STROKE}" stroke-width="1.5" vector-effect="non-scaling-stroke"`);
    // 左上高光小椭圆
    expect(svg).toMatch(/<ellipse[^>]*fill="#FFFFFF" opacity="\.6"/);
  });

  it("每格一枚贴纸 + 一圈边饰:3x3 = 9 枚花瓣贴纸(花园主题),边饰圆点 ≥12 颗", () => {
    const svg = patternDefsSvg(0, 3, 3);
    const main = svg.slice(svg.indexOf('id="pzp-t0-3x3"'), svg.indexOf('id="pzp-t0-3x3-alt"'));
    // 花园主题贴纸 = 五瓣花:每枚 5 花瓣圆 + 1 花心(#FFF6D8)
    expect(main.match(/#FFF6D8/g)?.length).toBe(9);
    expect((main.match(/opacity="\.55"/g)?.length ?? 0)).toBeGreaterThanOrEqual(12);
  });

  it("十套主题两两不同(色板或纹样至少一处不同)", () => {
    const all: string[] = [];
    for (let t = 0; t < 10; t++) all.push(patternDefsSvg(t, 3, 3).replace(/pzp-t\d+/g, "pzp-tX"));
    expect(new Set(all).size).toBe(10);
  });

  it("切片视窗数学:块号 → 行列 × 24;干扰块(≥行×列)引用 alt 场景", () => {
    // 3x3 的 4 号块 = 第 1 行第 1 列
    expect(patternSliceSvg(0, 3, 3, 4)).toContain(`viewBox="${PATTERN_CELL} ${PATTERN_CELL} ${PATTERN_CELL} ${PATTERN_CELL}"`);
    expect(patternSliceSvg(0, 3, 3, 4)).toContain(`href="#${patternSceneId(0, 3, 3)}"`);
    // 10 号是干扰块:alt 场景的 1 号格
    const decoy = patternSliceSvg(0, 3, 3, 10);
    expect(decoy).toContain(`href="#${patternSceneId(0, 3, 3, true)}"`);
    expect(decoy).toContain(`viewBox="${PATTERN_CELL} 0 ${PATTERN_CELL} ${PATTERN_CELL}"`);
  });

  it("嵌入切片:视窗四周各多裁 overhang,凸齿上也有画", () => {
    const nested = patternSliceNestedSvg(2, 4, 4, 5, -11.5, -11.5, 87, 87, 4.3);
    // 5 号块 = 第 1 行第 1 列:24-4.3=19.7 起,24+8.6=32.6 宽
    expect(nested).toContain('viewBox="19.7 19.7 32.6 32.6"');
    expect(nested).toContain('x="-11.5" y="-11.5" width="87" height="87"');
    expect(nested).toContain(`href="#${patternSceneId(2, 4, 4)}"`);
  });

  it("字符串良构:标签配平、无 NaN / undefined 泄漏(十主题 × 常见板型抽查)", () => {
    for (const [t, r, c] of [[0, 3, 3], [3, 4, 4], [6, 5, 5], [9, 6, 6], [4, 3, 4]] as const) {
      const svg = patternDefsSvg(t, r, c);
      expect(svg.match(/<svg/g)?.length).toBe(svg.match(/<\/svg>/g)?.length);
      expect(svg.match(/<g /g)?.length).toBe(svg.match(/<\/g>/g)?.length);
      expect(svg.includes("NaN")).toBe(false);
      expect(svg.includes("undefined")).toBe(false);
    }
  });

  it("场景画零 emoji 码位、主题号超界回落 0(与 THEME_TILES 兜底同口径)", () => {
    for (let t = 0; t < 10; t++) {
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(patternDefsSvg(t, 4, 4))).toBe(false);
    }
    expect(patternDefsSvg(99, 3, 3)).toBe(patternDefsSvg(0, 3, 3));
  });
});
