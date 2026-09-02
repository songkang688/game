import { describe, expect, it } from "vitest";
import {
  JIGSAW_NECK_RATIO,
  JIGSAW_RADIUS_PCT,
  JIGSAW_RADIUS_SMALL_PCT,
  JIGSAW_SMALL_PX,
  jigsawClipPath,
  jigsawD,
  jigsawRadiusPct,
  jigsawTabs,
} from "./jigsaw";

describe("art-kit · jigsaw 齿形生成器", () => {
  it("横向相邻两块对同一条边凸凹互补", () => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c + 1 < 4; c++) {
        const a = jigsawTabs(4, 4, r, c, 7);
        const b = jigsawTabs(4, 4, r, c + 1, 7);
        expect(a.right).not.toBe(0);
        expect(a.right).toBe(-b.left);
      }
    }
  });

  it("纵向相邻两块对同一条边凸凹互补", () => {
    for (let r = 0; r + 1 < 5; r++) {
      for (let c = 0; c < 3; c++) {
        const a = jigsawTabs(5, 3, r, c, 3);
        const b = jigsawTabs(5, 3, r + 1, c, 3);
        expect(a.bottom).not.toBe(0);
        expect(a.bottom).toBe(-b.top);
      }
    }
  });

  it("边缘块对外边是平边:四个角块各有两条平边", () => {
    const tl = jigsawTabs(3, 3, 0, 0);
    expect(tl.top).toBe(0);
    expect(tl.left).toBe(0);
    const tr = jigsawTabs(3, 3, 0, 2);
    expect(tr.top).toBe(0);
    expect(tr.right).toBe(0);
    const bl = jigsawTabs(3, 3, 2, 0);
    expect(bl.bottom).toBe(0);
    expect(bl.left).toBe(0);
    const br = jigsawTabs(3, 3, 2, 2);
    expect(br.bottom).toBe(0);
    expect(br.right).toBe(0);
    // 平边在路径里就是一条直线:左上角块的上边从 (0,0) 直达 (size,0)
    expect(jigsawD(3, 3, 0, 0, 100)).toMatch(/^M 0 0 L 100 0 /);
  });

  it("同一关卡(同 seed)两次生成 clip-path 一字不差,换 seed 才换齿", () => {
    const a = jigsawClipPath(4, 4, 1, 2, 100, 42);
    const b = jigsawClipPath(4, 4, 1, 2, 100, 42);
    expect(a).toBe(b);
    expect(a.startsWith('path("M ')).toBe(true);
    const seeds = [1, 2, 3, 4, 5, 6];
    const shapes = new Set(seeds.map((s) => jigsawClipPath(4, 4, 1, 2, 100, s)));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it("齿形半径两档:≥40px 用 18%,小于 40px 降到 14%", () => {
    expect(jigsawRadiusPct(60)).toBe(JIGSAW_RADIUS_PCT);
    expect(jigsawRadiusPct(JIGSAW_SMALL_PX)).toBe(JIGSAW_RADIUS_PCT);
    expect(jigsawRadiusPct(39)).toBe(JIGSAW_RADIUS_SMALL_PCT);
    expect(JIGSAW_RADIUS_PCT).toBe(18);
    expect(JIGSAW_RADIUS_SMALL_PCT).toBe(14);
  });

  it("齿颈宽是齿半径的 55%,齿伸出去不超过一个齿形半径", () => {
    expect(JIGSAW_NECK_RATIO).toBeCloseTo(0.55, 5);
    // 100px 块:齿半径 18,所有坐标都应落在 [-18, 118] 里
    const d = jigsawD(4, 4, 1, 1, 100, 9);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(-18);
    expect(Math.max(...nums)).toBeLessThanOrEqual(118);
    // 蘑菇头 = 每条带齿的边三段三次贝塞尔
    const inner = jigsawTabs(4, 4, 1, 1, 9);
    const edges = [inner.top, inner.right, inner.bottom, inner.left].filter((t) => t !== 0).length;
    expect(edges).toBe(4);
    expect((d.match(/C /g) ?? []).length).toBe(edges * 3);
  });

  it("origin 只平移不变形:平移后的坐标整体加 pad", () => {
    const base = jigsawD(3, 3, 0, 0, 100, 1, 0);
    const moved = jigsawD(3, 3, 0, 0, 100, 1, 18);
    expect(moved).not.toBe(base);
    expect(moved.startsWith("M 18 18 L 118 18 ")).toBe(true);
  });
});
