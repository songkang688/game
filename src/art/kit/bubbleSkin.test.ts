import { describe, expect, it } from "vitest";
import {
  BUBBLE_RIM_MIN_R,
  RAINBOW,
  SHEEN_PERIOD_MS,
  bubbleFilm,
  bubbleGloss,
  bubbleSkin,
  rimVisible,
  sheenAngle,
} from "./bubbleSkin";

/** 极简 2d 画笔桩:只记录本模块用到的调用 */
function stubCtx(): {
  ctx: CanvasRenderingContext2D;
  arcs: number[][];
  strokes: string[];
  stops: Array<[number, string]>;
  saves: { n: number; m: number };
} {
  const arcs: number[][] = [];
  const strokes: string[] = [];
  const stops: Array<[number, string]> = [];
  const saves = { n: 0, m: 0 };
  const rec = {
    strokeStyle: "",
    fillStyle: "" as unknown,
    lineWidth: 0,
    lineCap: "",
    save(): void {
      saves.n++;
    },
    restore(): void {
      saves.m++;
    },
    beginPath(): void {},
    fill(): void {},
    stroke(): void {
      strokes.push(String(rec.strokeStyle));
    },
    arc(...args: number[]): void {
      arcs.push(args);
    },
    createRadialGradient(): { addColorStop: (at: number, color: string) => void } {
      return { addColorStop: (at: number, color: string) => void stops.push([at, color]) };
    },
  };
  return { ctx: rec as unknown as CanvasRenderingContext2D, arcs, strokes, stops, saves };
}

describe("art/kit bubbleSkin", () => {
  it("薄膜是径向渐变:中心近透明、边缘吃 tint —— 泡里的东西看得清", () => {
    const s = stubCtx();
    bubbleFilm(s.ctx, 10, 20, 17, "rgba(190,230,255,.55)");
    expect(s.stops.map(([at]) => at)).toEqual([0, 0.7, 1]);
    expect(s.stops[2][1]).toBe("rgba(190,230,255,.55)");
    // 中心那一停必须是低透明度的白,不许实心
    expect(s.stops[0][1]).toContain("255,255,255");
  });

  it("彩虹缘的门槛:半径 < 6 一律省略,≥ 6 才画", () => {
    expect(BUBBLE_RIM_MIN_R).toBe(6);
    expect(rimVisible(5.9)).toBe(false);
    expect(rimVisible(6)).toBe(true);
    expect(rimVisible(17)).toBe(true);
  });

  it("大泡上光 = 月牙 1 段 + 彩虹 5 段;小泡只剩月牙", () => {
    const big = stubCtx();
    bubbleGloss(big.ctx, 0, 0, 17, 0);
    expect(big.arcs).toHaveLength(1 + RAINBOW.length);
    for (const c of RAINBOW) expect(big.strokes).toContain(c);

    const small = stubCtx();
    bubbleGloss(small.ctx, 0, 0, 5, 0);
    expect(small.arcs).toHaveLength(1);
    for (const c of RAINBOW) expect(small.strokes).not.toContain(c);
  });

  it("月牙旋转:2400ms 一圈 linear;reduced 恒 0(静止月牙)", () => {
    expect(SHEEN_PERIOD_MS).toBe(2400);
    expect(sheenAngle(0, false)).toBe(0);
    expect(sheenAngle(600, false)).toBeCloseTo(Math.PI / 2, 6);
    expect(sheenAngle(2400, false)).toBeCloseTo(0, 6);
    expect(sheenAngle(1234, true)).toBe(0);
    expect(sheenAngle(999999, true)).toBe(0);
  });

  it("月牙的起位在左上 45°,angle 只是绕着它巡回", () => {
    const s = stubCtx();
    bubbleGloss(s.ctx, 0, 0, 17, 0);
    const [, , , from, to] = s.arcs[0];
    expect((from + to) / 2).toBeCloseTo(-Math.PI * 0.75, 6);
  });

  it("bubbleSkin 一次画完 = 膜 + 光;半径 ≤ 0 一笔不画", () => {
    const s = stubCtx();
    bubbleSkin(s.ctx, 5, 5, 17, "rgba(190,230,255,.55)", { sheenMs: 0 });
    expect(s.arcs.length).toBeGreaterThan(1);
    expect(s.saves.n).toBe(s.saves.m);

    const zero = stubCtx();
    bubbleSkin(zero.ctx, 5, 5, 0, "rgba(190,230,255,.55)");
    expect(zero.arcs).toHaveLength(0);
  });
});
