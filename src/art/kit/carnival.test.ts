import { describe, expect, it } from "vitest";
import {
  CARNIVAL_DARKEN,
  CARNIVAL_HIGHLIGHT,
  CARNIVAL_LIGHTEN,
  CARNIVAL_SHADOW,
  CARNIVAL_STOPS,
  carnivalBallGradient,
  carnivalShadow,
} from "./carnival";
import { shade } from "./palette";

/** 记录式 2d 桩:只记 carnival 用到的那几样 */
function recCtx(): {
  ctx: CanvasRenderingContext2D;
  radials: number[][];
  stops: Array<[number, string]>;
  ellipses: number[][];
  fillStyles: unknown[];
} {
  const radials: number[][] = [];
  const stops: Array<[number, string]> = [];
  const ellipses: number[][] = [];
  const fillStyles: unknown[] = [];
  const ctx = {
    fillStyle: "" as unknown,
    save() {},
    restore() {},
    beginPath() {},
    ellipse(...args: number[]) {
      ellipses.push(args);
    },
    fill() {
      fillStyles.push(this.fillStyle);
    },
    createRadialGradient(...args: number[]) {
      radials.push(args);
      return {
        addColorStop(off: number, color: string) {
          stops.push([off, color]);
        },
      };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, radials, stops, ellipses, fillStyles };
}

describe("art-kit · carnival 靶摊档", () => {
  it("三停停靠点 0/0.55/1,亮部 +25%、边缘 -18%(经 palette.shade)", () => {
    expect([...CARNIVAL_STOPS]).toEqual([0, 0.55, 1]);
    expect(CARNIVAL_LIGHTEN).toBe(25);
    expect(CARNIVAL_DARKEN).toBe(-18);
    const r = recCtx();
    const base = "#FF9FBE";
    carnivalBallGradient(r.ctx, 100, 80, 40, base);
    expect(r.stops.map(([off]) => off)).toEqual([0, 0.55, 1]);
    expect(r.stops[0][1]).toBe(shade(base, CARNIVAL_LIGHTEN));
    expect(r.stops[1][1]).toBe(base);
    expect(r.stops[2][1]).toBe(shade(base, CARNIVAL_DARKEN));
  });

  it("高光圆心偏 (-0.35r, -0.4r)", () => {
    expect(CARNIVAL_HIGHLIGHT).toEqual({ x: -0.35, y: -0.4 });
    const r = recCtx();
    carnivalBallGradient(r.ctx, 100, 80, 40, "#FF9FBE");
    const [hx, hy, inner, cx, cy, outer] = r.radials[0];
    expect(hx).toBeCloseTo(100 - 0.35 * 40, 5);
    expect(hy).toBeCloseTo(80 - 0.4 * 40, 5);
    expect(inner).toBeCloseTo(40 * 0.08, 5);
    expect([cx, cy, outer]).toEqual([100, 80, 40]);
  });

  it("半径非法时退化为原色字符串,不抛", () => {
    const r = recCtx();
    expect(carnivalBallGradient(r.ctx, 0, 0, 0, "#FF9FBE")).toBe("#FF9FBE");
    expect(carnivalBallGradient(r.ctx, 0, 0, NaN, "#FF9FBE")).toBe("#FF9FBE");
    expect(r.radials.length).toBe(0);
  });

  it("落影按给定 rx/ry 画椭圆,填暖棕 18% 透明;非法参数不画", () => {
    expect(CARNIVAL_SHADOW).toBe("rgba(93,64,55,.18)");
    const r = recCtx();
    carnivalShadow(r.ctx, 50, 90, 32, 9.6);
    expect(r.ellipses.length).toBe(1);
    const [x, y, rx, ry] = r.ellipses[0];
    expect([x, y, rx, ry]).toEqual([50, 90, 32, 9.6]);
    expect(r.fillStyles[0]).toBe(CARNIVAL_SHADOW);
    carnivalShadow(r.ctx, 50, 90, 0, 5);
    carnivalShadow(r.ctx, 50, 90, NaN, 5);
    expect(r.ellipses.length).toBe(1);
  });
});
