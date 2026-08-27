// 1.3 第 1 步 C · 天空套件单测:≥3 层、视差递增、seed 可复现、reduced 静止、极端输入不崩。
import { describe, expect, it } from "vitest";
import {
  CANDY_SKY,
  NIGHT_SKY,
  SKY_THEMES,
  drawSky,
  makeSkyLayers,
  type SkyLayer,
} from "./sky";

/** 记录式 ctx 桩:把每次调用连参数一起记成一条日志,方便整帧对比(私有桩,不碰真 DOM) */
function makeStubCtx() {
  const ops: string[] = [];
  const rounded = (args: unknown[]) =>
    args.map((a) => (typeof a === "number" ? a.toFixed(3) : String(a))).join(",");
  let fillStyle: string | CanvasGradient = "";
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string | CanvasGradient) {
      fillStyle = v;
      ops.push(`fillStyle:${typeof v === "string" ? v : "gradient"}`);
    },
    globalAlpha: 1,
    save: () => ops.push("save"),
    restore: () => ops.push("restore"),
    beginPath: () => ops.push("beginPath"),
    closePath: () => ops.push("closePath"),
    moveTo: (...a: number[]) => ops.push(`moveTo:${rounded(a)}`),
    lineTo: (...a: number[]) => ops.push(`lineTo:${rounded(a)}`),
    arc: (...a: number[]) => ops.push(`arc:${rounded(a)}`),
    fill: () => ops.push("fill"),
    fillRect: (...a: number[]) => ops.push(`fillRect:${rounded(a)}`),
    createLinearGradient: (...a: number[]) => {
      ops.push(`gradient:${rounded(a)}`);
      return {
        addColorStop: (offset: number, color: string) => ops.push(`stop:${offset},${color}`),
      } as CanvasGradient;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const W = 360;
const H = 640;

function render(layers: SkyLayer[], scroll: number, reduced: boolean, w = W, h = H) {
  const rec = makeStubCtx();
  drawSky(rec.ctx, layers, scroll, w, h, reduced);
  return rec.ops;
}

describe("runner/sky · makeSkyLayers", () => {
  it("至少 3 层,渐变天幕 / 剪影 / 云层三种都有", () => {
    const layers = makeSkyLayers(CANDY_SKY);
    expect(layers.length).toBeGreaterThanOrEqual(3);
    const kinds = new Set(layers.map((l) => l.kind));
    expect(kinds.has("gradient")).toBe(true);
    expect(kinds.has("silhouette")).toBe(true);
    expect(kinds.has("cloud")).toBe(true);
  });

  it("视差系数按深度递减:排在前面的更远、滚得更慢", () => {
    const layers = makeSkyLayers(NIGHT_SKY);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].parallax).toBeGreaterThanOrEqual(layers[i - 1].parallax);
    }
    expect(layers[0].parallax).toBe(0);
    expect(layers[layers.length - 1].parallax).toBeGreaterThan(0);
  });

  it("同 seed 剪影可复现,两次生成逐字节一致", () => {
    expect(makeSkyLayers(CANDY_SKY, 42)).toEqual(makeSkyLayers(CANDY_SKY, 42));
  });

  it("不同 seed 剪影不同(程序化生成真的在用种子)", () => {
    const a = makeSkyLayers(CANDY_SKY, 1).find((l) => l.kind === "silhouette");
    const b = makeSkyLayers(CANDY_SKY, 2).find((l) => l.kind === "silhouette");
    expect(a?.points).not.toEqual(b?.points);
  });

  it("剪影控制点全部落在 0..1 归一区间,首尾同高(平铺无缝)", () => {
    for (const layer of makeSkyLayers(NIGHT_SKY, 9)) {
      if (layer.kind !== "silhouette") continue;
      for (const p of layer.points) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
      expect(layer.points[0]).toBe(layer.points[layer.points.length - 1]);
    }
  });

  it("主题换色:糖果天与星夜天的每一层颜色都不同", () => {
    expect(SKY_THEMES).toContain(CANDY_SKY);
    expect(SKY_THEMES).toContain(NIGHT_SKY);
    const a = makeSkyLayers(CANDY_SKY, 3);
    const b = makeSkyLayers(NIGHT_SKY, 3);
    for (let i = 0; i < a.length; i++) expect(a[i].color).not.toBe(b[i].color);
  });
});

describe("runner/sky · drawSky", () => {
  it("产生绘制调用:渐变两档色、剪影多边形、云的圆弧都落了笔", () => {
    const ops = render(makeSkyLayers(CANDY_SKY), 12, false);
    expect(ops.some((o) => o.startsWith("stop:0"))).toBe(true);
    expect(ops.some((o) => o.startsWith(`stop:1,${CANDY_SKY.bottom}`))).toBe(true);
    expect(ops.filter((o) => o.startsWith("lineTo")).length).toBeGreaterThan(10);
    expect(ops.filter((o) => o.startsWith("arc")).length).toBeGreaterThan(0);
    expect(ops.filter((o) => o === "fill").length).toBeGreaterThan(1);
  });

  it("reduced 时视差系数置 0:scroll 滚到天边画面也一笔不差", () => {
    const layers = makeSkyLayers(NIGHT_SKY, 5);
    expect(render(layers, 0, true)).toEqual(render(layers, 987.6, true));
  });

  it("非 reduced 时 scroll 会移动剪影与云(两帧日志不同)", () => {
    const layers = makeSkyLayers(NIGHT_SKY, 5);
    expect(render(layers, 0, false)).not.toEqual(render(layers, 10, false));
  });

  it("视口 0 / 空层 / NaN scroll 一律不抛", () => {
    const layers = makeSkyLayers(CANDY_SKY);
    expect(() => render(layers, 0, false, 0, H)).not.toThrow();
    expect(() => render(layers, 0, false, W, 0)).not.toThrow();
    expect(() => render([], 0, false)).not.toThrow();
    expect(() => render(layers, Number.NaN, false)).not.toThrow();
  });
});
