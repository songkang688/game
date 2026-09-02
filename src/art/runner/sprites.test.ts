// 1.3 第 1 步 C · 深度精灵单测:近大远小、相机后剔除、阴影随缩放、稳定深度排序、雾化单调。
import { describe, expect, it } from "vitest";
import { defaultCamera, type View25dCamera } from "../../engine/view25d";
import {
  SHADOW_BASE_RADIUS,
  SHADOW_FLATTEN,
  drawAtDepth,
  fogTint,
  sortByDepth,
  type DepthSprite,
} from "./sprites";

/** 记录式 ctx 桩:记录椭圆参数与当下的 globalAlpha(私有桩,不碰真 DOM) */
function makeStubCtx() {
  const calls: string[] = [];
  const ellipses: number[][] = [];
  const alphaStack: number[] = [];
  let alpha = 1;
  const ctx = {
    fillStyle: "",
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      alpha = v;
    },
    save: () => {
      calls.push("save");
      alphaStack.push(alpha);
    },
    restore: () => {
      calls.push("restore");
      alpha = alphaStack.pop() ?? 1;
    },
    beginPath: () => calls.push("beginPath"),
    ellipse: (...args: number[]) => {
      calls.push("ellipse");
      ellipses.push(args);
    },
    fill: () => calls.push("fill"),
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    ellipses,
    alphaNow: () => alpha,
  };
}

const cam = defaultCamera("perspective");
const W = 360;
const H = 640;

function sprite(z: number, over: Partial<DepthSprite> = {}): DepthSprite {
  return { x: 0, y: 20, z, draw: () => {}, ...over };
}

describe("runner/sprites · drawAtDepth", () => {
  it("z 越大 scale 越小(近大远小),回调拿到的就是投影结果", () => {
    const rec = makeStubCtx();
    const seen: number[] = [];
    for (const z of [0, 5, 15, 40]) {
      drawAtDepth(rec.ctx, cam, sprite(z, { draw: (_c, _x, _y, s) => seen.push(s) }), W, H);
    }
    expect(seen.length).toBe(4);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
  });

  it("返回值与回调参数一致,方便调用方拿去做命中区", () => {
    const rec = makeStubCtx();
    let got: [number, number, number] | null = null;
    const p = drawAtDepth(
      rec.ctx,
      cam,
      sprite(8, { x: 30, draw: (_c, x, y, s) => (got = [x, y, s]) }),
      W,
      H
    );
    expect(p).not.toBeNull();
    expect(got).not.toBeNull();
    const [gx, gy, gs] = got!;
    expect(gx).toBeCloseTo(p!.x, 9);
    expect(gy).toBeCloseTo(p!.y, 9);
    expect(gs).toBeCloseTo(p!.scale, 9);
  });

  it("相机后面的精灵整个剔除:不调回调、不画阴影、返回 null", () => {
    const rec = makeStubCtx();
    let called = 0;
    const p = drawAtDepth(rec.ctx, cam, sprite(-999, { draw: () => called++ }), W, H);
    expect(p).toBeNull();
    expect(called).toBe(0);
    expect(rec.ellipses.length).toBe(0);
  });

  it("阴影随 scale 缩放:远处影子小,纵横比一直是压扁的椭圆", () => {
    const rec = makeStubCtx();
    const near = drawAtDepth(rec.ctx, cam, sprite(2), W, H);
    const far = drawAtDepth(rec.ctx, cam, sprite(30), W, H);
    expect(rec.ellipses.length).toBe(2);
    const [, , nearRx, nearRy] = rec.ellipses[0];
    const [, , farRx, farRy] = rec.ellipses[1];
    expect(nearRx).toBeCloseTo(SHADOW_BASE_RADIUS * near!.scale, 6);
    expect(farRx).toBeCloseTo(SHADOW_BASE_RADIUS * far!.scale, 6);
    expect(nearRx).toBeGreaterThan(farRx);
    expect(nearRy / nearRx).toBeCloseTo(SHADOW_FLATTEN, 6);
    expect(farRy / farRx).toBeCloseTo(SHADOW_FLATTEN, 6);
  });

  it("阴影贴地:落在精灵锚点(y > 0 悬空)的下方", () => {
    const rec = makeStubCtx();
    const p = drawAtDepth(rec.ctx, cam, sprite(6, { y: 40 }), W, H);
    expect(rec.ellipses.length).toBe(1);
    const [, shadowY] = rec.ellipses[0];
    expect(shadowY).toBeGreaterThan(p!.y);
  });

  it("shadowRadius 为 0 时不画影,但精灵照画", () => {
    const rec = makeStubCtx();
    let called = 0;
    drawAtDepth(rec.ctx, cam, sprite(6, { shadowRadius: 0, draw: () => called++ }), W, H);
    expect(called).toBe(1);
    expect(rec.ellipses.length).toBe(0);
  });

  it("雾化随深度增强:远精灵回调时的 globalAlpha 更低,近处满格", () => {
    const rec = makeStubCtx();
    const alphas: number[] = [];
    for (const z of [0, 30]) {
      drawAtDepth(rec.ctx, cam, sprite(z, { draw: () => alphas.push(rec.alphaNow()) }), W, H);
    }
    expect(alphas[0]).toBeCloseTo(1, 6);
    expect(alphas[1]).toBeLessThan(alphas[0]);
    expect(alphas[1]).toBeGreaterThan(0);
    // save/restore 配对:画完 alpha 回到 1
    expect(rec.alphaNow()).toBe(1);
  });

  it("flat 相机:照样调回调且 scale 恒 1(reduced 全降级不崩)", () => {
    const rec = makeStubCtx();
    const flat: View25dCamera = { ...defaultCamera(), kind: "flat" };
    let got = 0;
    const p = drawAtDepth(rec.ctx, flat, sprite(25, { draw: (_c, _x, _y, s) => (got = s) }), W, H);
    expect(p?.scale).toBe(1);
    expect(got).toBe(1);
  });

  it("视口 0 / NaN 坐标不抛", () => {
    const rec = makeStubCtx();
    expect(() => drawAtDepth(rec.ctx, cam, sprite(5), 0, 0)).not.toThrow();
    expect(() =>
      drawAtDepth(rec.ctx, cam, sprite(Number.NaN, { x: Number.NaN, y: Number.NaN }), W, H)
    ).not.toThrow();
  });
});

describe("runner/sprites · sortByDepth", () => {
  it("远的排前面(先画),近的排后面(后画盖上来)", () => {
    const sorted = sortByDepth([{ z: 3 }, { z: 40 }, { z: 0.5 }, { z: 12 }]);
    expect(sorted.map((s) => s.z)).toEqual([40, 12, 3, 0.5]);
  });

  it("稳定:同深度保持进场顺序", () => {
    const a = { z: 10, tag: "a" };
    const b = { z: 10, tag: "b" };
    const c = { z: 10, tag: "c" };
    expect(sortByDepth([a, b, c]).map((s) => s.tag)).toEqual(["a", "b", "c"]);
    expect(sortByDepth([{ z: 5, tag: "近" }, a, b]).map((s) => s.tag)).toEqual(["a", "b", "近"]);
  });

  it("不改原数组,NaN 的 z 按 0 参与也不抛", () => {
    const items = [{ z: 1 }, { z: Number.NaN }, { z: 9 }];
    const sorted = sortByDepth(items);
    expect(items.map((s) => s.z)).toEqual([1, Number.NaN, 9]);
    expect(sorted[0].z).toBe(9);
    expect(sorted.length).toBe(3);
  });
});

describe("runner/sprites · fogTint", () => {
  it("单调:scale 越小雾越浓;近处(scale ≥ 1)完全无雾", () => {
    expect(fogTint(1)).toBe(0);
    expect(fogTint(2)).toBe(0);
    let prev = -1;
    for (const s of [0.9, 0.6, 0.3, 0.1, 0.02]) {
      const fog = fogTint(s);
      expect(fog).toBeGreaterThan(prev);
      expect(fog).toBeLessThanOrEqual(1);
      prev = fog;
    }
  });
});
