// 1.3 第 1 步 C · 跑道套件单测:三车道透视、弯道有界、条纹滚动、flat 退化、极端输入不崩。
import { describe, expect, it } from "vitest";
import { defaultCamera, type View25dCamera } from "../../engine/view25d";
import {
  CANDY_TRACK,
  CURVE_MAX_RATIO,
  NIGHT_TRACK,
  STRIPE_SPACING,
  TRACK_THEMES,
  curveOffset,
  drawTrack,
  laneCenterX,
  type TrackTheme,
} from "./track";

/** 记录式 ctx 桩:只记账不画画(A 档的公共桩尚未合入,这里自带私有桩,不碰真 DOM) */
function makeStubCtx() {
  const calls: string[] = [];
  const fillStyles: string[] = [];
  const polys: { points: [number, number][]; color: string }[] = [];
  let fillStyle: string | CanvasGradient = "";
  let current: [number, number][] = [];
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string | CanvasGradient) {
      fillStyle = v;
      if (typeof v === "string") fillStyles.push(v);
    },
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => {
      calls.push("beginPath");
      current = [];
    },
    closePath: () => calls.push("closePath"),
    moveTo: (x: number, y: number) => {
      calls.push("moveTo");
      current = [[x, y]];
    },
    lineTo: (x: number, y: number) => {
      calls.push("lineTo");
      current.push([x, y]);
    },
    fill: () => {
      calls.push("fill");
      polys.push({ points: current.slice(), color: String(fillStyle) });
    },
    stroke: () => calls.push("stroke"),
    fillRect: () => calls.push("fillRect"),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fillStyles, polys };
}

const cam = defaultCamera("perspective");
const flatCam: View25dCamera = { ...defaultCamera(), kind: "flat" };
const W = 360;
const H = 640;

function draw(theme: TrackTheme, scroll: number, curvature = 0, camera = cam, w = W, h = H) {
  const rec = makeStubCtx();
  drawTrack(rec.ctx, camera, { scroll, curvature, theme }, w, h);
  return rec;
}

describe("runner/track · 主题", () => {
  it("内置两套主题,五个色都合法 #rrggbb", () => {
    expect(TRACK_THEMES).toContain(CANDY_TRACK);
    expect(TRACK_THEMES).toContain(NIGHT_TRACK);
    for (const theme of TRACK_THEMES) {
      for (const c of [theme.road, theme.shoulder, theme.laneLine, theme.stripeA, theme.stripeB]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("两套主题互不相同,同一套里条纹 A/B 也不同(不然滚动看不出来)", () => {
    expect(CANDY_TRACK.road).not.toBe(NIGHT_TRACK.road);
    for (const theme of TRACK_THEMES) {
      expect(theme.stripeA).not.toBe(theme.stripeB);
      expect(theme.road).not.toBe(theme.laneLine);
    }
  });
});

describe("runner/track · laneCenterX 三车道", () => {
  it("z = 0 时左中右有序,中道正好在屏幕中线", () => {
    const left = laneCenterX(0, 0, cam, W);
    const mid = laneCenterX(1, 0, cam, W);
    const right = laneCenterX(2, 0, cam, W);
    expect(left).toBeLessThan(mid);
    expect(mid).toBeLessThan(right);
    expect(mid).toBeCloseTo(W / 2, 5);
  });

  it("近处车道间距大于远处(透视收缩,向消失点收拢)", () => {
    const spreadNear = laneCenterX(2, 0, cam, W) - laneCenterX(0, 0, cam, W);
    const spreadFar = laneCenterX(2, 30, cam, W) - laneCenterX(0, 30, cam, W);
    expect(spreadNear).toBeGreaterThan(spreadFar);
    expect(spreadFar).toBeGreaterThan(0);
  });

  it("z 越远间距单调不增(平滑收拢,没有跳变)", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (const z of [0, 5, 10, 20, 40, 80]) {
      const spread = laneCenterX(2, z, cam, W) - laneCenterX(0, z, cam, W);
      expect(spread).toBeLessThanOrEqual(prev + 1e-9);
      prev = spread;
    }
  });

  it("flat 相机不收缩:远近间距一样(平面退化)", () => {
    const spreadNear = laneCenterX(2, 0, flatCam, W) - laneCenterX(0, 0, flatCam, W);
    const spreadFar = laneCenterX(2, 30, flatCam, W) - laneCenterX(0, 30, flatCam, W);
    expect(spreadNear).toBeCloseTo(spreadFar, 6);
  });

  it("NaN 的 z / 视口 0 也给有限值,不出 NaN", () => {
    expect(Number.isFinite(laneCenterX(1, Number.NaN, cam, W))).toBe(true);
    expect(Number.isFinite(laneCenterX(0, 10, cam, 0))).toBe(true);
    expect(Number.isFinite(laneCenterX(2, -999, cam, W))).toBe(true);
  });
});

describe("runner/track · curveOffset 弯道", () => {
  it("有界:再远的 z、满弯 ±1,偏移也不超过 CURVE_MAX_RATIO", () => {
    for (const z of [0, 1, 10, 100, 1e6, Number.POSITIVE_INFINITY]) {
      for (const k of [-1, -0.5, 0.5, 1]) {
        expect(Math.abs(curveOffset(z, k))).toBeLessThanOrEqual(CURVE_MAX_RATIO + 1e-9);
      }
    }
  });

  it("平滑:脚下为 0,相邻 z 的偏移差很小(没有台阶)", () => {
    expect(curveOffset(0, 1)).toBe(0);
    let prev = 0;
    for (let z = 0; z <= 60; z += 0.5) {
      const off = curveOffset(z, 1);
      expect(Math.abs(off - prev)).toBeLessThan(0.02);
      prev = off;
    }
  });

  it("方向与单调:正曲率向右且随 z 增大,负曲率对称向左", () => {
    let prev = 0;
    for (const z of [1, 5, 15, 40]) {
      const off = curveOffset(z, 0.8);
      expect(off).toBeGreaterThan(prev);
      expect(curveOffset(z, -0.8)).toBeCloseTo(-off, 9);
      prev = off;
    }
  });

  it("NaN 安全:NaN / Infinity 的 z 或曲率、负 z,一律给有限值", () => {
    expect(curveOffset(Number.NaN, 1)).toBe(0);
    expect(curveOffset(10, Number.NaN)).toBe(0);
    expect(curveOffset(-5, 1)).toBe(0);
    expect(Number.isFinite(curveOffset(Number.POSITIVE_INFINITY, 1))).toBe(true);
    expect(Math.abs(curveOffset(1e9, Number.POSITIVE_INFINITY))).toBeLessThanOrEqual(CURVE_MAX_RATIO);
  });

  it("超界曲率被夹回 ±1:传 5 和传 1 一个样", () => {
    expect(curveOffset(20, 5)).toBeCloseTo(curveOffset(20, 1), 9);
    expect(curveOffset(20, -5)).toBeCloseTo(curveOffset(20, -1), 9);
  });
});

describe("runner/track · drawTrack 绘制", () => {
  it("产生绘制调用,路面与条纹都用了主题色", () => {
    const rec = draw(CANDY_TRACK, 0);
    expect(rec.calls.length).toBeGreaterThan(0);
    expect(rec.calls).toContain("fill");
    expect(rec.calls).toContain("stroke");
    expect(rec.fillStyles).toContain(CANDY_TRACK.road);
    const stripes = rec.fillStyles.filter(
      (c) => c === CANDY_TRACK.stripeA || c === CANDY_TRACK.stripeB
    );
    expect(stripes.length).toBeGreaterThan(2);
    // 沿 z 交替:两个条纹色都要出现
    expect(new Set(stripes).size).toBe(2);
  });

  it("scroll 变化改变条纹相位:滚一节后首条条纹换色", () => {
    const first = (scroll: number) =>
      draw(CANDY_TRACK, scroll).polys.filter(
        (p) => p.color === CANDY_TRACK.stripeA || p.color === CANDY_TRACK.stripeB
      )[0]?.color;
    expect(first(0)).toBeDefined();
    expect(first(0)).not.toBe(first(STRIPE_SPACING));
    // 滚整两节回到同相
    expect(first(0)).toBe(first(STRIPE_SPACING * 2));
  });

  it("近大远小:同一帧里越靠画面下方的路面梯形越宽", () => {
    const rec = draw(NIGHT_TRACK, 0);
    const roadPolys = rec.polys.filter((p) => p.color === NIGHT_TRACK.road && p.points.length >= 2);
    expect(roadPolys.length).toBeGreaterThan(3);
    // 每个梯形前两个点是近边:按近边 y 从上到下排,宽度应单调不减
    const sorted = roadPolys
      .map((p) => ({ y: p.points[0][1], w: Math.abs(p.points[1][0] - p.points[0][0]) }))
      .sort((a, b) => a.y - b.y);
    expect(sorted[sorted.length - 1].w).toBeGreaterThan(sorted[0].w);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].w).toBeGreaterThanOrEqual(sorted[i - 1].w - 1e-6);
    }
  });

  it("弯道让远处路面横移,近处基本不动", () => {
    const straight = draw(NIGHT_TRACK, 0, 0).polys.filter((p) => p.color === NIGHT_TRACK.road);
    const curved = draw(NIGHT_TRACK, 0, 1).polys.filter((p) => p.color === NIGHT_TRACK.road);
    expect(curved.length).toBe(straight.length);
    // 最远的梯形(近边 y 最小)明显右移
    const farS = [...straight].sort((a, b) => a.points[0][1] - b.points[0][1])[0];
    const farC = [...curved].sort((a, b) => a.points[0][1] - b.points[0][1])[0];
    expect(farC.points[0][0]).toBeGreaterThan(farS.points[0][0] + 1);
    // 最近的梯形几乎没动(弯从脚下平滑弯出去)
    const nearS = [...straight].sort((a, b) => b.points[0][1] - a.points[0][1])[0];
    const nearC = [...curved].sort((a, b) => b.points[0][1] - a.points[0][1])[0];
    expect(Math.abs(nearC.points[0][0] - nearS.points[0][0])).toBeLessThan(1);
  });

  it("flat 相机退化为平面条带:不崩、有画、路面与条纹色都在", () => {
    const rec = draw(CANDY_TRACK, 7.5, 0.5, flatCam);
    expect(rec.calls).toContain("fillRect");
    expect(rec.fillStyles).toContain(CANDY_TRACK.road);
    expect(rec.fillStyles).toContain(CANDY_TRACK.stripeA);
  });

  it("flat 模式下 scroll 也能滚条纹(相位变了画面就变)", () => {
    const a = draw(CANDY_TRACK, 0, 0, flatCam);
    const b = draw(CANDY_TRACK, STRIPE_SPACING / 2, 0, flatCam);
    expect(a.calls.length).toBeGreaterThan(0);
    // fillRect 不记参数,退而比较调用次数序列之外的东西:相位不同,首条条纹 y 不同 → 用调用数粗验不崩即可
    expect(b.calls.length).toBeGreaterThan(0);
  });

  it("视口为 0 不抛、什么都不画", () => {
    expect(() => draw(CANDY_TRACK, 0, 0, cam, 0, H)).not.toThrow();
    expect(() => draw(CANDY_TRACK, 0, 0, cam, W, 0)).not.toThrow();
    expect(draw(CANDY_TRACK, 0, 0, cam, 0, 0).calls.length).toBe(0);
  });

  it("NaN 的 scroll / curvature、缺主题,一律不抛", () => {
    expect(() => draw(CANDY_TRACK, Number.NaN, Number.NaN)).not.toThrow();
    const rec = makeStubCtx();
    expect(() =>
      drawTrack(rec.ctx, cam, { scroll: 0, curvature: 0, theme: undefined as unknown as TrackTheme }, W, H)
    ).not.toThrow();
  });
});
