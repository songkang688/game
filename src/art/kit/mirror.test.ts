/**
 * 地板倒影模块单测:纯绘制函数,断言「画了 / 没画 / 不抛」三件事。
 * 用一个记账的画笔桩数调用次数,不需要真 canvas。
 */
import { describe, expect, it } from "vitest";
import { MIRROR_ALPHA, STREAK_ALPHA, mirrorEllipse, reflectStreak } from "./mirror";

class CountCtx {
  fillStyle: unknown = "";
  ellipses = 0;
  fills = 0;
  rects = 0;
  gradients = 0;
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  ellipse(): void {
    this.ellipses++;
  }
  fill(): void {
    this.fills++;
  }
  fillRect(): void {
    this.rects++;
  }
  createLinearGradient(): { addColorStop: () => void } {
    this.gradients++;
    return { addColorStop: () => {} };
  }
}

function ctx(): CanvasRenderingContext2D & CountCtx {
  return new CountCtx() as unknown as CanvasRenderingContext2D & CountCtx;
}

describe("art/kit/mirror · 镜面倒影椭圆", () => {
  it("合法入参画一个椭圆并填充,默认透明度 0.22", () => {
    const g = ctx();
    mirrorEllipse(g, 10, 20, 6, 2, "#F4859F");
    expect(g.ellipses).toBe(1);
    expect(g.fills).toBe(1);
    expect(String(g.fillStyle)).toBe(`rgba(244,133,159,${MIRROR_ALPHA})`);
  });

  it("rx/ry ≤ 0、NaN 坐标、alpha 0:一律不画也不抛", () => {
    const g = ctx();
    expect(() => {
      mirrorEllipse(g, 0, 0, 0, 2, "#fff");
      mirrorEllipse(g, 0, 0, 2, -1, "#fff");
      mirrorEllipse(g, Number.NaN, 0, 2, 2, "#fff");
      mirrorEllipse(g, 0, 0, 2, 2, "#fff", 0);
    }).not.toThrow();
    expect(g.ellipses).toBe(0);
    expect(g.fills).toBe(0);
  });

  it("alpha 超界会被夹回 0..1", () => {
    const g = ctx();
    mirrorEllipse(g, 0, 0, 2, 2, "#000000", 9);
    expect(String(g.fillStyle)).toBe("rgba(0,0,0,1)");
  });
});

describe("art/kit/mirror · 倒影拉丝", () => {
  it("合法入参建一条渐变并铺一块矩形,起点透明度 0.3", () => {
    const g = ctx();
    reflectStreak(g, 5, 10, 24, 3, "#9FD0FF");
    expect(g.gradients).toBe(1);
    expect(g.rects).toBe(1);
    expect(STREAK_ALPHA).toBe(0.3);
  });

  it("len 为 0 / 非有限、w ≤ 0:不画不抛;len 为负(朝上)照样画", () => {
    const g = ctx();
    expect(() => {
      reflectStreak(g, 0, 0, 0, 3, "#fff");
      reflectStreak(g, 0, 0, Number.POSITIVE_INFINITY, 3, "#fff");
      reflectStreak(g, 0, 0, 10, 0, "#fff");
    }).not.toThrow();
    expect(g.rects).toBe(0);
    reflectStreak(g, 0, 0, -12, 3, "#fff");
    expect(g.rects).toBe(1);
  });
});
