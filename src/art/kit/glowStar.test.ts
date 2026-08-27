/**
 * 发光五角星（glowStar）几何与光晕的守门用例（1.3 第 26 步 B 档）。
 * 钉死绘制规格 4.2 的三条硬数：十点多边形、内外半径比 0.42、光晕 2.2× / 45% → 0。
 */
import { describe, expect, it } from "vitest";
import {
  HALO_CENTER_ALPHA,
  HALO_RATIO,
  STAR_CORE_FILL,
  STAR_INNER_RATIO,
  STAR_POINT_COUNT,
  haloBackground,
  starClipPolygon,
  starPointsAttr,
  starSvg,
  starVertices,
} from "./glowStar";

const dist = (x: number, y: number, c: number): number => Math.hypot(x - c, y - c);

describe("art-kit · glowStar 五角星几何", () => {
  it("输出十点多边形：5 外点 + 5 内点交替，第一枚外点朝正上", () => {
    const pts = starVertices(100);
    expect(STAR_POINT_COUNT).toBe(10);
    expect(pts).toHaveLength(10);
    expect(pts[0][0]).toBeCloseTo(50, 6);
    expect(pts[0][1]).toBeCloseTo(0, 6);
  });

  it("内外半径比钉死 0.42：偶数下标在外圈、奇数下标在内圈", () => {
    expect(STAR_INNER_RATIO).toBe(0.42);
    const pts = starVertices(100);
    for (let i = 0; i < pts.length; i++) {
      const r = dist(pts[i][0], pts[i][1], 50);
      expect(r, `第 ${i} 个顶点的半径不对`).toBeCloseTo(i % 2 === 0 ? 50 : 50 * 0.42, 6);
    }
  });

  it("clip-path 版是 polygon(...) 且坐标全部落在 0–100% 里", () => {
    const poly = starClipPolygon();
    expect(poly.startsWith("polygon(")).toBe(true);
    const pairs = poly.slice("polygon(".length, -1).split(",");
    expect(pairs).toHaveLength(10);
    for (const pair of pairs) {
      const nums = pair.trim().split(/\s+/).map((v) => Number.parseFloat(v));
      expect(nums).toHaveLength(2);
      for (const n of nums) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }
    }
  });

  it("SVG 标记：圆角尖、音色填充、同色系深描边、星心高光小圆", () => {
    const svg = starSvg(44, "#ff6b6b");
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('fill="#ff6b6b"');
    expect(svg).toContain(`fill="${STAR_CORE_FILL}"`);
    expect(svg).toContain('viewBox="0 0 44 44"');
    // 描边是往黑压过的同色系（shade -30），不该原样等于填充色
    expect(svg).not.toContain('stroke="#ff6b6b"');
    // cssSize 传 1em 时随字号缩放（果冻键短屏收字号星星跟着缩）
    expect(starSvg(44, "#ffd93d", { cssSize: "1em" })).toContain('width="1em"');
  });

  it("光晕：直径 2.2×、中心色 = 音色 45% 透明度、70% 处渐隐为 0", () => {
    expect(HALO_RATIO).toBe(2.2);
    expect(HALO_CENTER_ALPHA).toBe(0.45);
    const halo = haloBackground("#ff6b6b");
    expect(halo).toBe("radial-gradient(circle,rgba(255,107,107,0.45) 0%,rgba(255,107,107,0) 70%)");
  });

  it("坏输入不炸：尺寸 / 比例 / 颜色都给得出能用的输出", () => {
    expect(starVertices(Number.NaN)).toHaveLength(10);
    expect(starVertices(-5, 9).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(starPointsAttr(0)).not.toContain("NaN");
    expect(starClipPolygon(Number.POSITIVE_INFINITY)).toContain("polygon(");
    expect(starSvg(24, "不是颜色")).toContain("<svg");
    expect(haloBackground("#ff6b6b", Number.NaN)).toContain("0.45");
  });
});
