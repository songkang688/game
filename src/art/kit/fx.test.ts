import { describe, expect, it } from "vitest";
import { PLUS_ONE_MIN_PX, drawPlusOne, drawSparkle, makeCollectBurst } from "./fx";
import { makeStubCtx } from "./testing";

describe("makeCollectBurst 收集爆星", () => {
  it("默认模式喷出一圈粒子,各有寿命", () => {
    const burst = makeCollectBurst({ x: 50, y: 60 });
    expect(burst.particles.length).toBeGreaterThan(0);
    for (const p of burst.particles) {
      expect(p.life).toBeGreaterThan(0);
      expect(p.maxLife).toBeGreaterThan(0);
    }
    expect(burst.done()).toBe(false);
  });

  it("step 后粒子位置变化且寿命递减", () => {
    const burst = makeCollectBurst({ x: 50, y: 60 });
    const before = burst.particles.map((p) => ({ x: p.x, y: p.y, life: p.life }));
    burst.step(0.05);
    burst.particles.forEach((p, i) => {
      expect(p.x !== before[i].x || p.y !== before[i].y).toBe(true);
      expect(p.life).toBeLessThan(before[i].life);
    });
  });

  it("draw 有绘制;寿命耗尽后 done 且零绘制", () => {
    const burst = makeCollectBurst({ x: 50, y: 60 });
    const live = makeStubCtx();
    burst.draw(live.ctx);
    expect(live.count("arc")).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) burst.step(0.1);
    expect(burst.done()).toBe(true);
    const dead = makeStubCtx();
    burst.draw(dead.ctx);
    expect(dead.calls.length).toBe(0);
  });

  it("reduced: 粒子数为 0(降级路径)", () => {
    const burst = makeCollectBurst({ x: 50, y: 60, reduced: true });
    expect(burst.particles.length).toBe(0);
  });

  it("reduced: 仍有单次淡出,播完即静", () => {
    const burst = makeCollectBurst({ x: 50, y: 60, reduced: true });
    const first = makeStubCtx();
    burst.draw(first.ctx);
    expect(first.calls.length).toBeGreaterThan(0);
    const a0 = burst.alpha;
    burst.step(0.1);
    expect(burst.alpha).toBeLessThan(a0);
    for (let i = 0; i < 10; i++) burst.step(0.1);
    expect(burst.done()).toBe(true);
    const after = makeStubCtx();
    burst.draw(after.ctx);
    expect(after.calls.length).toBe(0);
  });

  it("reduced 每帧只画一个光圈,不喷粒子", () => {
    const burst = makeCollectBurst({ x: 50, y: 60, reduced: true });
    burst.step(0.05);
    const stub = makeStubCtx();
    burst.draw(stub.ctx);
    expect(stub.count("arc")).toBe(1);
    expect(stub.count("fill")).toBe(0);
  });

  it("count 自定义并 clamp;非法坐标不抛且立即 done", () => {
    const burst = makeCollectBurst({ x: 0, y: 0, count: 5 });
    expect(burst.particles.length).toBe(5);
    const big = makeCollectBurst({ x: 0, y: 0, count: 999 });
    expect(big.particles.length).toBeLessThanOrEqual(64);
    const bad = makeCollectBurst({ x: NaN, y: 0 });
    expect(bad.particles.length).toBe(0);
    expect(bad.done()).toBe(true);
    expect(() => bad.step(0.1)).not.toThrow();
    const stub = makeStubCtx();
    expect(() => bad.draw(stub.ctx)).not.toThrow();
    expect(stub.calls.length).toBe(0);
  });

  it("非法 dt(NaN/负数)不动状态", () => {
    const burst = makeCollectBurst({ x: 10, y: 10 });
    const snapshot = burst.particles.map((p) => p.x).join(",");
    burst.step(NaN);
    burst.step(-1);
    burst.step(0);
    expect(burst.particles.map((p) => p.x).join(",")).toBe(snapshot);
    expect(burst.alpha).toBe(1);
  });
});

describe("drawPlusOne +1 飞字", () => {
  it("t=0 与 t=1 输出不同(上浮 + 淡出)", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawPlusOne(a.ctx, { x: 30, y: 40, t: 0 });
    drawPlusOne(b.ctx, { x: 30, y: 40, t: 1 });
    expect(a.snapshot()).not.toBe(b.snapshot());
    const alphaOf = (s: ReturnType<typeof makeStubCtx>) =>
      s.calls.find((c) => c.method === "set:globalAlpha")?.args[0];
    expect(alphaOf(a)).toBe(1);
    expect(alphaOf(b)).toBe(0);
  });

  it("字号下限 14px: 传 8 也会抬到 14,缺省 ≥ 14", () => {
    expect(PLUS_ONE_MIN_PX).toBe(14);
    const small = makeStubCtx();
    drawPlusOne(small.ctx, { x: 0, y: 0, t: 0.2, size: 8 });
    expect(small.fontLog[0]).toContain("14px");
    const dflt = makeStubCtx();
    drawPlusOne(dflt.ctx, { x: 0, y: 0, t: 0.2 });
    const m = /(\d+)px/.exec(dflt.fontLog[0] ?? "");
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(14);
  });

  it("默认写 +1,可自定义文本,白描边保证可读", () => {
    const stub = makeStubCtx();
    drawPlusOne(stub.ctx, { x: 0, y: 0, t: 0.1 });
    drawPlusOne(stub.ctx, { x: 0, y: 0, t: 0.1, text: "+3" });
    expect(stub.textLog).toContain("+1");
    expect(stub.textLog).toContain("+3");
    expect(stub.count("strokeText")).toBe(2);
    expect(stub.count("fillText")).toBe(2);
  });

  it("非法输入(x/t NaN)不抛零绘制;t 越界自动 clamp", () => {
    const stub = makeStubCtx();
    expect(() => drawPlusOne(stub.ctx, { x: NaN, y: 0, t: 0.5 })).not.toThrow();
    expect(() => drawPlusOne(stub.ctx, { x: 0, y: 0, t: NaN })).not.toThrow();
    expect(stub.calls.length).toBe(0);
    drawPlusOne(stub.ctx, { x: 0, y: 0, t: 9 });
    expect(stub.nonFiniteArgs).toBe(0);
  });
});

describe("drawSparkle 四芒闪光", () => {
  it("有绘制且 t 改变输出;极端参数安全", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawSparkle(a.ctx, { x: 0, y: 0, r: 8, t: 0 });
    drawSparkle(b.ctx, { x: 0, y: 0, r: 8, t: 0.25 });
    expect(a.count("fill")).toBeGreaterThanOrEqual(2);
    expect(a.snapshot()).not.toBe(b.snapshot());
    const bad = makeStubCtx();
    expect(() => drawSparkle(bad.ctx, { x: 0, y: 0, r: NaN })).not.toThrow();
    expect(bad.calls.length).toBe(0);
  });
});
