/**
 * 雪场三件套的单测:上限 24、脚印 2 秒渐隐、溅雪 6 瓣 320ms、一步清空。
 * 随机源全部注入定序的,断言才立得住。
 */
import { describe, expect, it } from "vitest";
import {
  FOOTPRINT_LIFE_S,
  POWDER_COUNT,
  POWDER_MS,
  SNOW_CAP,
  SPLASH_MS,
  SPLASH_PETALS,
  burstAlpha,
  burstPowder,
  burstSplash,
  clearSnowfield,
  drawBursts,
  drawSnowfield,
  footprintAlpha,
  makeSnowfield,
  resizeSnowfield,
  stampFootprint,
  stepBursts,
  stepFootprints,
  stepSnowfield,
  type Footprint,
} from "./snow";

/** 定序随机:0.1, 0.2, ... 循环 */
function seq(): () => number {
  let i = 0;
  return () => {
    i = (i + 1) % 10;
    return i / 10;
  };
}

/** 只记 arc 的极简画笔桩 */
function stubCtx(): { arcs: number[][]; ctx: CanvasRenderingContext2D } {
  const arcs: number[][] = [];
  const ctx = {
    fillStyle: "",
    globalAlpha: 1,
    beginPath: () => {},
    fill: () => {},
    arc: (x: number, y: number, r: number) => void arcs.push([x, y, r]),
  } as unknown as CanvasRenderingContext2D;
  return { arcs, ctx };
}

describe("art/kit/snow · 飘雪场", () => {
  it("上限就是 24:要 99 颗也只给 SNOW_CAP 颗,要 0 颗就真的是 0", () => {
    expect(SNOW_CAP).toBe(24);
    expect(makeSnowfield(99, 320, 180, seq()).flakes.length).toBe(SNOW_CAP);
    expect(makeSnowfield(0, 320, 180, seq()).flakes.length).toBe(0);
    expect(makeSnowfield(12, 320, 180, seq()).flakes.length).toBe(12);
  });

  it("同一个随机源造出同一片雪;步进后雪往下走,落底回顶", () => {
    const a = makeSnowfield(8, 320, 180, seq());
    const b = makeSnowfield(8, 320, 180, seq());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const y0 = a.flakes.map((k) => k.y);
    stepSnowfield(a, 0.5);
    for (const [i, k] of a.flakes.entries()) {
      const before = y0[i] as number;
      // 要么往下落了,要么已经回卷到顶上
      expect(k.y > before || k.y <= 0).toBe(true);
      expect(k.y).toBeLessThanOrEqual(184);
    }
  });

  it("画多少颗听 visible 的;clearSnowfield 一步归零", () => {
    const f = makeSnowfield(24, 320, 180, seq());
    const { arcs, ctx } = stubCtx();
    drawSnowfield(ctx, f, 10);
    expect(arcs.length).toBe(10);
    clearSnowfield(f);
    expect(f.flakes.length).toBe(0);
    const again = stubCtx();
    drawSnowfield(again.ctx, f);
    expect(again.arcs.length).toBe(0);
  });

  it("resize 按比例挪雪,不重新洗牌(颗数不变)", () => {
    const f = makeSnowfield(6, 100, 100, seq());
    const first = f.flakes[0]!;
    const fx = first.x;
    resizeSnowfield(f, 200, 100);
    expect(f.flakes.length).toBe(6);
    expect(first.x).toBeCloseTo(fx * 2, 6);
  });
});

describe("art/kit/snow · 脚印淡痕", () => {
  it("寿命常量就是 2 秒;线性渐隐,活满即删", () => {
    expect(FOOTPRINT_LIFE_S).toBe(2);
    const list: Footprint[] = [];
    stampFootprint(list, 10, 1, "rgba(120,150,200,.3)");
    expect(footprintAlpha(list[0]!)).toBe(1);
    stepFootprints(list, 1);
    expect(footprintAlpha(list[0]!)).toBeCloseTo(0.5, 6);
    stepFootprints(list, 1);
    expect(list.length).toBe(0);
  });

  it("超过上限挤掉最老的一枚", () => {
    const list: Footprint[] = [];
    for (let i = 0; i < 10; i++) stampFootprint(list, i, i % 2 === 0 ? 1 : -1, "x", 4);
    expect(list.length).toBe(4);
    expect(list[0]!.x).toBe(6);
  });
});

describe("art/kit/snow · 雪爆", () => {
  it("落点溅雪就是 6 瓣、320ms;出手雪粉就是 4 颗、240ms", () => {
    expect(SPLASH_PETALS).toBe(6);
    expect(SPLASH_MS).toBe(320);
    expect(POWDER_COUNT).toBe(4);
    expect(POWDER_MS).toBe(240);
    expect(burstSplash(0, 0, SPLASH_PETALS, seq()).length).toBe(6);
    expect(burstPowder(0, 0, 1, seq()).length).toBe(4);
  });

  it("溅雪往上飞(vy < 0),雪粉朝出手方向喷", () => {
    for (const p of burstSplash(0, 0, 6, seq())) expect(p.vy).toBeLessThan(0);
    for (const p of burstPowder(0, 0, 1, seq())) expect(p.vx).toBeGreaterThan(0);
    for (const p of burstPowder(0, 0, -1, seq())) expect(p.vx).toBeLessThan(0);
  });

  it("寿命到了就删干净;淡出走 easeOutCubic(先快后慢地隐去)", () => {
    const list = burstSplash(0, 0, 6, seq());
    const p = list[0]!;
    expect(burstAlpha(p)).toBe(1);
    stepBursts(list, 0.16);
    const mid = burstAlpha(list[0]!);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0);
    stepBursts(list, 1);
    expect(list.length).toBe(0);
  });

  it("drawBursts 一瓣一个 arc,画完把 globalAlpha 还回 1", () => {
    const list = burstSplash(5, 7, 6, seq());
    const { arcs, ctx } = stubCtx();
    drawBursts(ctx, list);
    expect(arcs.length).toBe(6);
    expect((ctx as unknown as { globalAlpha: number }).globalAlpha).toBe(1);
  });
});
