/**
 * 共享美术套件 · 毛笔变宽笔迹单测（窗口8 A 档 · word-garden 独占文件）。
 *
 * 两条命根子：① 慢粗快细的映射钉在 0.6-1.4 倍；② 点集**只读**——
 * 判定轨迹和渲染共用一份数组，这里 freeze 住跑一遍，谁改谁炸。
 */
import { describe, expect, it } from "vitest";
import {
  BRUSH,
  brushSvg,
  brushWidths,
  resamplePoints,
  speedToWidthScale,
  strokeKindOf,
  type BrushPoint,
} from "./brush";

const BASE = 8;

describe("art-kit · 毛笔笔宽映射", () => {
  it("慢 / 中 / 快三速：慢粗快细，全部钳在 0.6-1.4 倍基准宽", () => {
    expect(speedToWidthScale(0, 10)).toBeCloseTo(BRUSH.maxScale);
    expect(speedToWidthScale(10, 10)).toBeCloseTo(1);
    expect(speedToWidthScale(30, 10)).toBeCloseTo(BRUSH.minScale);
    const slow = speedToWidthScale(4, 10);
    const mid = speedToWidthScale(10, 10);
    const fast = speedToWidthScale(18, 10);
    expect(slow).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(fast);
    for (const s of [slow, mid, fast]) {
      expect(s).toBeGreaterThanOrEqual(BRUSH.minScale);
      expect(s).toBeLessThanOrEqual(BRUSH.maxScale);
    }
    // 参考速度给不了时回 1，渲染永远有宽度可用
    expect(speedToWidthScale(5, 0)).toBe(1);
    expect(speedToWidthScale(Number.NaN, 10)).toBe(1);
  });

  it("点间距不同的轨迹：密集段（慢）比稀疏段（快）画得粗", () => {
    // 前半每步 2、后半每步 10：前慢后快
    const pts: BrushPoint[] = [[0, 0], [2, 0], [4, 0], [6, 0], [16, 0], [26, 0], [36, 0]];
    const w = brushWidths(pts, BASE);
    expect(w).toHaveLength(pts.length);
    expect(w[2]).toBeGreaterThan(w[5]);
    for (const v of w) {
      expect(v).toBeGreaterThanOrEqual(BASE * BRUSH.minScale);
      expect(v).toBeLessThanOrEqual(BASE * BRUSH.maxScale * BRUSH.startBoost);
    }
  });

  it("判定轨迹点集一个元素都不动：freeze 住跑全套渲染计算不炸、内容不变", () => {
    const pts: BrushPoint[] = [[14, 50], [40, 50], [86, 50]];
    for (const p of pts) Object.freeze(p);
    Object.freeze(pts);
    const before = JSON.stringify(pts);
    brushWidths(pts, BASE, "taper");
    brushSvg(pts, brushWidths(pts, BASE), "#ff8c42");
    resamplePoints(pts, 4);
    expect(JSON.stringify(pts)).toBe(before);
  });
});

describe("art-kit · 起笔顿点与收笔出锋", () => {
  it("起笔顿点：首点宽 ×1.2（等速轨迹上首点 = 1.2 倍基准宽）", () => {
    const pts: BrushPoint[] = [[0, 0], [10, 0], [20, 0], [30, 0]];
    const w = brushWidths(pts, BASE, "blunt");
    expect(w[0]).toBeCloseTo(BASE * BRUSH.startBoost);
    expect(w[1]).toBeCloseTo(BASE);
  });

  it("撇捺类出锋：末三段线性收窄、末点收到 0.4 倍基准宽", () => {
    const pts: BrushPoint[] = [[54, 14], [45, 32], [36, 50], [27, 68], [18, 86]];
    const w = brushWidths(pts, BASE, "taper");
    expect(w[w.length - 1]).toBeCloseTo(BASE * BRUSH.taperEnd);
    // 末三段单调收窄
    expect(w[w.length - 1]).toBeLessThan(w[w.length - 2]);
    expect(w[w.length - 2]).toBeLessThan(w[w.length - 3]);
  });

  it("横竖类顿收：末点不收窄，靠圆头线帽收笔", () => {
    const pts: BrushPoint[] = [[14, 50], [38, 50], [62, 50], [86, 50]];
    const w = brushWidths(pts, BASE, "blunt");
    expect(w[w.length - 1]).toBeCloseTo(BASE);
  });

  it("笔画类型只按笔画名分：撇 / 捺 / 提出锋，横竖折钩点顿收", () => {
    expect(strokeKindOf("撇")).toBe("taper");
    expect(strokeKindOf("捺")).toBe("taper");
    expect(strokeKindOf("横撇")).toBe("taper");
    expect(strokeKindOf("横")).toBe("blunt");
    expect(strokeKindOf("竖")).toBe("blunt");
    expect(strokeKindOf("横折钩")).toBe("blunt");
    expect(strokeKindOf("点")).toBe("blunt");
    expect(strokeKindOf("")).toBe("blunt");
  });
});

describe("art-kit · 笔迹 SVG 与重采样", () => {
  it("brushSvg：n 个点出 n-1 条圆头线段，首段墨色更深", () => {
    const pts: BrushPoint[] = [[0, 0], [10, 0], [20, 0]];
    const svg = brushSvg(pts, brushWidths(pts, BASE), "#ff8c42");
    expect(svg.match(/<line /g)).toHaveLength(2);
    expect(svg.match(/stroke-linecap="round"/g)).toHaveLength(2);
    const strokes = [...svg.matchAll(/stroke="([^"]+)"/g)].map((m) => m[1]);
    expect(strokes[1]).toBe("#ff8c42");
    expect(strokes[0]).not.toBe(strokes[1]);
  });

  it("重采样只加中间点、首尾原样，步长非法时原样拷贝", () => {
    const pts: BrushPoint[] = [[14, 50], [86, 50]];
    const dense = resamplePoints(pts, 6);
    expect(dense.length).toBeGreaterThan(pts.length);
    expect(dense[0]).toEqual([14, 50]);
    expect(dense[dense.length - 1]).toEqual([86, 50]);
    for (const [, y] of dense) expect(y).toBe(50);
    expect(resamplePoints(pts, 0)).toEqual([[14, 50], [86, 50]]);
    expect(resamplePoints([[1, 1]], 5)).toEqual([[1, 1]]);
  });
});
