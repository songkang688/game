import { describe, expect, it } from "vitest";
import { BALL_STOPS, ballGradient, softShadow } from "./volume";
import { shade } from "./palette";

/** 极简 2d 画笔桩:只记录本模块用到的调用 */
function stubCtx(): {
  ctx: CanvasRenderingContext2D;
  stops: Array<[number, string]>;
  grads: number[][];
  ellipses: number[][];
  alphas: number[];
  saves: number;
  restores: number;
} {
  const stops: Array<[number, string]> = [];
  const grads: number[][] = [];
  const ellipses: number[][] = [];
  const alphas: number[] = [];
  const rec = {
    saves: 0,
    restores: 0,
    globalAlpha: 1,
    fillStyle: "",
    save(): void {
      rec.saves++;
    },
    restore(): void {
      rec.restores++;
    },
    beginPath(): void {},
    fill(): void {
      alphas.push(rec.globalAlpha);
    },
    ellipse(...args: number[]): void {
      ellipses.push(args);
    },
    createRadialGradient(...args: number[]): { addColorStop: (at: number, color: string) => void } {
      grads.push(args);
      return { addColorStop: (at: number, color: string) => void stops.push([at, color]) };
    },
  };
  return { ctx: rec as unknown as CanvasRenderingContext2D, stops, grads, ellipses, alphas, saves: 0, restores: 0 };
}

describe("art/kit volume", () => {
  it("ballGradient 是三停:+25% 顶光 → 主体 → -15% 背光,高光偏左上 45°", () => {
    const s = stubCtx();
    ballGradient(s.ctx, 10, 20, 40, "#F4859F");
    expect(BALL_STOPS).toEqual({ light: 25, dark: -15 });
    expect(s.stops.map(([at]) => at)).toEqual([0, 0.55, 1]);
    expect(s.stops[0][1]).toBe(shade("#F4859F", 25));
    expect(s.stops[1][1]).toBe("#F4859F");
    expect(s.stops[2][1]).toBe(shade("#F4859F", -15));
    // 内圆(高光中心)在球心左上:x、y 都要更小
    const [ix, iy, , ox, oy] = s.grads[0];
    expect(ix).toBeLessThan(ox);
    expect(iy).toBeLessThan(oy);
  });

  it("softShadow 画的是半透明椭圆,透明度与缩放都生效,画完恢复画笔", () => {
    const s = stubCtx();
    softShadow(s.ctx, 100, 200, 30, 10, 0.12, 1.15);
    expect(s.alphas[0]).toBeCloseTo(0.12, 6);
    const [x, y, rx, ry] = s.ellipses[0];
    expect([x, y]).toEqual([100, 200]);
    expect(rx).toBeCloseTo(30 * 1.15, 6);
    expect(ry).toBeCloseTo(10 * 1.15, 6);
    const rec = s.ctx as unknown as { saves: number; restores: number };
    expect(rec.saves).toBe(1);
    expect(rec.restores).toBe(1);
  });
});
