import { describe, expect, it } from "vitest";
import {
  drawCoin,
  drawCrate,
  drawGem,
  drawHeart,
  drawShadow,
  drawSpike,
  drawStar
} from "./props";
import { makeStubCtx } from "./testing";

describe("drawCoin 金币(宪法: 不许是纯色圆)", () => {
  it("绘制调用 ≥ 3 类: 体积椭圆、内圈星形路径、高光填充", () => {
    const stub = makeStubCtx();
    drawCoin(stub.ctx, { x: 50, y: 50, r: 12 });
    // 边缘厚度 + 币面 + 内圈环 + 高光 → 至少 3 次 ellipse
    expect(stub.count("ellipse")).toBeGreaterThanOrEqual(3);
    // 内圈星形浮雕 → 五角星至少 9 段 lineTo
    expect(stub.count("lineTo")).toBeGreaterThanOrEqual(8);
    // 一个纯色圆只会有 1 次 fill,这里必须 ≥ 4
    expect(stub.count("fill")).toBeGreaterThanOrEqual(4);
    expect(stub.count("stroke")).toBeGreaterThanOrEqual(1);
  });

  it("三阶光影: 至少 3 种不同填充色(暗边/底色/高光)", () => {
    const stub = makeStubCtx();
    drawCoin(stub.ctx, { x: 0, y: 0, r: 10 });
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
  });

  it("r ≤ 0 / NaN 契约: 不抛、零绘制", () => {
    for (const r of [0, -4, NaN, Infinity]) {
      const stub = makeStubCtx();
      expect(() => drawCoin(stub.ctx, { x: 0, y: 0, r })).not.toThrow();
      expect(stub.calls.length).toBe(0);
    }
  });

  it("t 驱动自转: 相位不同输出不同", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawCoin(a.ctx, { x: 0, y: 0, r: 10, t: 0 });
    drawCoin(b.ctx, { x: 0, y: 0, r: 10, t: 0.2 });
    expect(a.snapshot()).not.toBe(b.snapshot());
  });

  it("合法输入不产生 NaN 坐标,save/restore 配平", () => {
    const stub = makeStubCtx();
    drawCoin(stub.ctx, { x: 3, y: 4, r: 8, t: 0.7 });
    expect(stub.nonFiniteArgs).toBe(0);
    expect(stub.count("save")).toBe(stub.count("restore"));
  });
});

describe("drawStar / drawHeart / drawGem 同等三阶", () => {
  it("星星: 底影 + 主体 + 高光,三种填充色", () => {
    const stub = makeStubCtx();
    drawStar(stub.ctx, { x: 0, y: 0, r: 12 });
    expect(stub.count("fill")).toBeGreaterThanOrEqual(3);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
    expect(stub.count("lineTo")).toBeGreaterThanOrEqual(16);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("星星 t 脉动改变输出", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawStar(a.ctx, { x: 0, y: 0, r: 12, t: 0 });
    drawStar(b.ctx, { x: 0, y: 0, r: 12, t: 0.25 });
    expect(a.snapshot()).not.toBe(b.snapshot());
  });

  it("爱心: 贝塞尔曲线成形 + 三阶填充", () => {
    const stub = makeStubCtx();
    drawHeart(stub.ctx, { x: 0, y: 0, r: 10 });
    expect(stub.count("bezierCurveTo")).toBeGreaterThanOrEqual(4);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("宝石: 切面多边形 + 冠面亮阶 + 暗面 + 星光点", () => {
    const stub = makeStubCtx();
    drawGem(stub.ctx, { x: 0, y: 0, r: 10 });
    expect(stub.count("lineTo")).toBeGreaterThanOrEqual(8);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(4);
    expect(stub.count("fill")).toBeGreaterThanOrEqual(4);
    expect(stub.nonFiniteArgs).toBe(0);
  });
});

describe("障碍件与阴影", () => {
  it("尖刺: 有填充体积、明暗两阶、警示色带,不是 1px 线稿", () => {
    const stub = makeStubCtx();
    drawSpike(stub.ctx, { x: 0, y: 100, w: 24 });
    expect(stub.count("fill")).toBeGreaterThanOrEqual(2);
    expect(stub.count("fillRect")).toBeGreaterThanOrEqual(4);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("木箱: 顶面/侧面双色阶 + 板缝描边 + 铆钉", () => {
    const stub = makeStubCtx();
    drawCrate(stub.ctx, { x: 0, y: 100, w: 32 });
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
    expect(stub.count("stroke")).toBeGreaterThanOrEqual(2);
    expect(stub.count("strokeRect")).toBeGreaterThanOrEqual(1);
    expect(stub.count("arc")).toBeGreaterThanOrEqual(4);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("阴影: 半透明椭圆,画完恢复 globalAlpha", () => {
    const stub = makeStubCtx();
    drawShadow(stub.ctx, { x: 10, y: 90, w: 40 });
    expect(stub.count("ellipse")).toBe(1);
    const alphaSets = stub.calls.filter((c) => c.method === "set:globalAlpha");
    expect(alphaSets.length).toBeGreaterThanOrEqual(1);
    expect(alphaSets[0].args[0]).toBeLessThan(1);
    expect(alphaSets[0].args[0]).toBeGreaterThan(0);
    expect(stub.count("save")).toBe(stub.count("restore"));
  });

  it("阴影 alpha 越界自动 clamp", () => {
    const stub = makeStubCtx();
    drawShadow(stub.ctx, { x: 0, y: 0, w: 20, alpha: 7 });
    const alphaSets = stub.calls.filter((c) => c.method === "set:globalAlpha");
    expect(alphaSets[0].args[0]).toBeLessThanOrEqual(1);
  });
});

describe("全家极端参数安全", () => {
  const cases = [
    { name: "coin", run: (ctx: CanvasRenderingContext2D, v: number) => drawCoin(ctx, { x: 0, y: 0, r: v }) },
    { name: "star", run: (ctx: CanvasRenderingContext2D, v: number) => drawStar(ctx, { x: 0, y: 0, r: v }) },
    { name: "heart", run: (ctx: CanvasRenderingContext2D, v: number) => drawHeart(ctx, { x: 0, y: 0, r: v }) },
    { name: "gem", run: (ctx: CanvasRenderingContext2D, v: number) => drawGem(ctx, { x: 0, y: 0, r: v }) },
    { name: "spike", run: (ctx: CanvasRenderingContext2D, v: number) => drawSpike(ctx, { x: 0, y: 0, w: v }) },
    { name: "crate", run: (ctx: CanvasRenderingContext2D, v: number) => drawCrate(ctx, { x: 0, y: 0, w: v }) },
    { name: "shadow", run: (ctx: CanvasRenderingContext2D, v: number) => drawShadow(ctx, { x: 0, y: 0, w: v }) }
  ];

  it.each(cases)("$name: 尺寸 0/负/NaN 不抛零调用, x/y NaN 也不画", ({ run }) => {
    for (const v of [0, -3, NaN, Infinity]) {
      const stub = makeStubCtx();
      expect(() => run(stub.ctx, v)).not.toThrow();
      expect(stub.calls.length).toBe(0);
    }
    const stub = makeStubCtx();
    expect(() => drawCoin(stub.ctx, { x: NaN, y: 0, r: 5 })).not.toThrow();
    expect(stub.calls.length).toBe(0);
  });

  it("收集物在 2px 半径下照画不抛(手机端小尺寸)", () => {
    const stub = makeStubCtx();
    drawCoin(stub.ctx, { x: 1, y: 1, r: 2 });
    drawStar(stub.ctx, { x: 1, y: 1, r: 2 });
    drawHeart(stub.ctx, { x: 1, y: 1, r: 2 });
    drawGem(stub.ctx, { x: 1, y: 1, r: 2 });
    expect(stub.count("fill")).toBeGreaterThanOrEqual(12);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("障碍件自定义高度生效且安全", () => {
    const short = makeStubCtx();
    const tall = makeStubCtx();
    drawSpike(short.ctx, { x: 0, y: 0, w: 20, h: 14 });
    drawSpike(tall.ctx, { x: 0, y: 0, w: 20, h: 40 });
    expect(short.snapshot()).not.toBe(tall.snapshot());
    const crate = makeStubCtx();
    drawCrate(crate.ctx, { x: 0, y: 0, w: 30, h: 18 });
    expect(crate.count("fillRect")).toBeGreaterThanOrEqual(3);
    expect(crate.nonFiniteArgs).toBe(0);
  });
});
