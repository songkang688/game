import { describe, expect, it } from "vitest";
import { shade } from "./palette";
import {
  BUBBLE_CRESCENT_MIN_PX,
  BUBBLE_DARKEN,
  BUBBLE_HIGHLIGHT_X,
  BUBBLE_HIGHLIGHT_Y,
  BUBBLE_INNER_ARC,
  BUBBLE_LIGHTEN,
  BUBBLE_RIM_MIN_R,
  RAINBOW,
  SHEEN_PERIOD_MS,
  bubbleBody,
  bubbleCrescentVisible,
  bubbleFilm,
  bubbleGloss,
  bubbleHighlight,
  bubbleSkin,
  rimVisible,
  sheenAngle
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

const BASES = ["#FF9EC8", "#8FCBFF", "#9FE08D", "#FFD26E", "#C9A0F0"];

describe("bubbleSkin CSS:三层叠加,盘面上不许存在平涂泡", () => {
  it("background 含 ≥2 层 gradient(平涂机器化断言)", () => {
    for (const base of BASES) {
      const layers = bubbleSkin(base).background.match(/radial-gradient\(/g) ?? [];
      expect(layers.length, `${base} 层数不足`).toBeGreaterThanOrEqual(2);
    }
  });

  it("输出不是单一纯色(既不是裸 hex 也不是裸 rgb)", () => {
    for (const base of BASES) {
      const bg = bubbleSkin(base).background;
      expect(bg).not.toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(bg).not.toMatch(/^rgba?\([^)]*\)$/);
      expect(bg).toContain("gradient(");
    }
  });

  it("主高光斑:圆心 30%,24%,白 .8 → 40% 处透明", () => {
    expect(BUBBLE_HIGHLIGHT_X).toBe("30%");
    expect(BUBBLE_HIGHLIGHT_Y).toBe("24%");
    expect(bubbleHighlight()).toBe(
      "radial-gradient(circle at 30% 24%, rgba(255,255,255,.8), transparent 40%)"
    );
  });

  it("主体明暗:shade(+10) 起 → shade(-12) 94% 收边", () => {
    expect(BUBBLE_LIGHTEN).toBe(10);
    expect(BUBBLE_DARKEN).toBe(-12);
    for (const base of BASES) {
      const body = bubbleBody(base);
      expect(body).toContain(shade(base, 10));
      expect(body).toContain(`${shade(base, -12)} 94%`);
      expect(body).toContain("circle at 50% 46%");
    }
  });

  it("底部内缘反光弧:inset 白 20%,随皮肤一起返回", () => {
    expect(BUBBLE_INNER_ARC).toBe("inset 0 -2px 4px rgba(255,255,255,.2)");
    expect(bubbleSkin("#FF9EC8").boxShadow).toBe(BUBBLE_INNER_ARC);
  });

  it("副高光小月牙:泡径 < 32px 省略,≥ 32px 保留", () => {
    expect(BUBBLE_CRESCENT_MIN_PX).toBe(32);
    expect(bubbleCrescentVisible(31.9)).toBe(false);
    expect(bubbleCrescentVisible(32)).toBe(true);
    expect(bubbleCrescentVisible(48)).toBe(true);
    expect(bubbleCrescentVisible(0)).toBe(false);
  });
});
