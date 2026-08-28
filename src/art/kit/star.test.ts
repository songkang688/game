/**
 * star.ts 的单测:五角星是不是真的「5 齿、相邻外顶点 72°、内外径可参数化」。
 */
import { describe, expect, it } from "vitest";

import { STAR_INNER_RATIO, STAR_POINTS, starPoints, tracePath, traceStar } from "./star";

/** 归一化到 [0, 2π) 的角度差 */
function angleOf(cx: number, cy: number, p: [number, number]): number {
  const a = Math.atan2(p[1] - cy, p[0] - cx);
  return (a + Math.PI * 2) % (Math.PI * 2);
}

class PathSpy {
  moves: Array<[number, number]> = [];
  lines: Array<[number, number]> = [];
  begun = 0;
  closed = 0;
  beginPath(): void {
    this.begun++;
  }
  closePath(): void {
    this.closed++;
  }
  moveTo(x: number, y: number): void {
    this.moves.push([x, y]);
  }
  lineTo(x: number, y: number): void {
    this.lines.push([x, y]);
  }
}

describe("art-kit · star 参数化五角星", () => {
  it("缺省就是五角星:10 个顶点,外顶点 5 颗,相邻外顶点夹角恰 72°", () => {
    const pts = starPoints(0, 0, 10);
    expect(pts.length).toBe(STAR_POINTS * 2);
    const outer = pts.filter((_, i) => i % 2 === 0);
    expect(outer.length).toBe(5);
    for (let i = 0; i < outer.length; i++) {
      const a = angleOf(0, 0, outer[i]);
      const b = angleOf(0, 0, outer[(i + 1) % outer.length]);
      const diff = ((b - a + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI);
      expect(diff).toBeCloseTo(72, 6);
    }
    // 第一颗齿朝正上
    expect(outer[0][0]).toBeCloseTo(0, 6);
    expect(outer[0][1]).toBeCloseTo(-10, 6);
  });

  it("内外径按参数走:外顶点在 R 上,内凹点在 R×inner 上", () => {
    const R = 8;
    const pts = starPoints(3, -2, R, { inner: 0.5 });
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - 3, pts[i][1] + 2);
      expect(d).toBeCloseTo(i % 2 === 0 ? R : R * 0.5, 6);
    }
    // 缺省内径比 0.42
    const dflt = starPoints(0, 0, 10);
    expect(Math.hypot(dflt[1][0], dflt[1][1])).toBeCloseTo(10 * STAR_INNER_RATIO, 6);
  });

  it("齿数可参数化,非法参数退回空数组不抛", () => {
    expect(starPoints(0, 0, 6, { points: 4 }).length).toBe(8);
    expect(starPoints(0, 0, -1)).toEqual([]);
    expect(starPoints(0, 0, 5, { points: 2 })).toEqual([]);
    expect(starPoints(Number.NaN, 0, 5)).toEqual([]);
  });

  it("tracePath / traceStar 铺路一次成型:beginPath → moveTo → lineTo×(n-1) → closePath", () => {
    const spy = new PathSpy();
    traceStar(spy as unknown as CanvasRenderingContext2D, 0, 0, 10);
    expect(spy.begun).toBe(1);
    expect(spy.closed).toBe(1);
    expect(spy.moves.length).toBe(1);
    expect(spy.lines.length).toBe(9);
    // 空顶点不落笔
    const empty = new PathSpy();
    tracePath(empty as unknown as CanvasRenderingContext2D, []);
    expect(empty.begun).toBe(0);
  });
});
