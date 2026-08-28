/**
 * 宝石表面 · 单测（1.3 第 25 步 B 档）。
 * 钉死绘制规格 4.1 / 4.2：三停渐变、四色两两不同、1.5px 描边 + 2px 底部暗边、
 * 切面 22% / 白 35%、<32px 小格降级。
 */
import { describe, expect, it } from "vitest";
import {
  GEM_BOTTOM_PX,
  GEM_COUNT,
  GEM_EDGE_PX,
  GEM_FACET_ALPHA,
  GEM_FACET_MIN_PX,
  GEM_FACET_RATIO,
  GEM_STOPS,
  gemBody,
  gemCellCss,
  gemEdge,
  gemFacetSize,
  gemFacetVisible,
  gemGradient,
} from "./gem";
import { parseHex } from "./palette";

describe("宝石渐变 · 三停与四色", () => {
  it("四色宝石各有三停，受光→本色→暗部逐停变深（不是平涂）", () => {
    expect(GEM_STOPS).toHaveLength(4);
    for (const [light, mid, dark] of GEM_STOPS) {
      const sum = (hex: string): number => {
        const rgb = parseHex(hex);
        expect(rgb, `${hex} 不是合法色值`).not.toBeNull();
        return rgb![0] + rgb![1] + rgb![2];
      };
      expect(sum(light)).toBeGreaterThan(sum(mid));
      expect(sum(mid)).toBeGreaterThan(sum(dark));
    }
  });

  it("四色渐变 token 两两不同（p0–p3 一眼分得清）", () => {
    const grads = [0, 1, 2, 3].map((i) => gemGradient(i));
    expect(new Set(grads).size).toBe(4);
    for (const g of grads) expect(g).toContain("linear-gradient(135deg,");
  });

  it("规格 4.1 的色值原样落地：gemRed / gemBlue / gemGreen / gemYellow", () => {
    expect(GEM_STOPS[0]).toEqual(["#ff6b6b", "#e14b4b", "#b93a3a"]);
    expect(GEM_STOPS[1]).toEqual(["#5b9bff", "#3d78e0", "#2c5cb8"]);
    expect(GEM_STOPS[2]).toEqual(["#7bc86c", "#569a48", "#3f7a34"]);
    expect(GEM_STOPS[3]).toEqual(["#ffd93d", "#f4a83a", "#d18a2a"]);
  });

  it("描边色 = 最深一停，本色 = 中间一停；下标取模不越界", () => {
    for (let i = 0; i < GEM_COUNT; i++) {
      expect(gemEdge(i)).toBe(GEM_STOPS[i][2]);
      expect(gemBody(i)).toBe(GEM_STOPS[i][1]);
    }
    expect(gemGradient(4)).toBe(gemGradient(0));
    expect(gemGradient(Number.NaN)).toBe(gemGradient(0));
  });
});

describe("宝石切面 · 尺寸与小格降级", () => {
  it("切面三角 = 块宽 22%，白 35% 透明度", () => {
    expect(GEM_FACET_RATIO).toBe(0.22);
    expect(GEM_FACET_ALPHA).toBe(0.35);
    expect(gemFacetSize(100)).toBe(22);
    expect(gemFacetSize(50)).toBe(11);
  });

  it("小格降级门槛是 32px：31 不画切面、32 起画", () => {
    expect(GEM_FACET_MIN_PX).toBe(32);
    expect(gemFacetVisible(31)).toBe(false);
    expect(gemFacetVisible(32)).toBe(true);
    expect(gemFacetVisible(Number.NaN)).toBe(false);
  });
});

describe("宝石格 CSS 生成", () => {
  const css = gemCellCss("shk");

  it("四个 gem 类齐全，各带自己的三停渐变", () => {
    for (let i = 0; i < 4; i++) {
      expect(css).toContain(`.shk-gem-p${i}{background:${gemGradient(i)}`);
    }
  });

  it("1.5px 最深色描边 + 底部 2px 暗边全走 inset box-shadow（盒子几何零改动）", () => {
    expect(GEM_EDGE_PX).toBe(1.5);
    expect(GEM_BOTTOM_PX).toBe(2);
    for (let i = 0; i < 4; i++) {
      expect(css).toContain(`inset 0 0 0 1.5px ${gemEdge(i)}`);
      expect(css).toContain(`inset 0 -2px 0 ${gemEdge(i)}`);
    }
    // 描边不许改 border 的粗细——border-width 一个字都不许出现
    expect(css).not.toContain("border-width");
    expect(css).not.toMatch(/border:\s*\d/);
  });

  it("切面高光是 ::after 三角，白 35%，不接指针", () => {
    expect(css).toContain("clip-path:polygon(0 0,100% 0,0 100%)");
    expect(css).toContain(`rgba(255,255,255,${GEM_FACET_ALPHA})`);
    expect(css).toContain("width:22%");
    const facetRule = css.slice(css.indexOf(".shk-gem-p0::after"));
    expect(facetRule.slice(0, facetRule.indexOf("}"))).toContain("pointer-events:none");
  });

  it("挂上 .shk-gem-small 后切面整块不画（content:none），渐变与描边原样保留", () => {
    expect(css).toContain(".shk-gem-small .shk-gem-p0::after");
    const at = css.indexOf(".shk-gem-small");
    expect(css.slice(at)).toContain("content:none");
    // 降级只砍 ::after，不碰 .shk-gem-pN 本体
    expect(css.slice(at)).not.toContain("background");
  });

  it("前缀会被消毒，塞怪字符也生成不了越权选择器", () => {
    expect(gemCellCss("shk{}")).toContain(".shk-gem-p0");
  });
});
