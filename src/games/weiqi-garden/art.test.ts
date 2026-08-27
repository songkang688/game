/**
 * 围子花园 · 独立视觉资产契约(`art.test.ts`;1.3 r1 · learner P10 / tester G-7)。
 *
 * 其余八款都有独立 art.test.ts,唯独本款的视觉契约内嵌在 index.test.ts 里。
 * 本文件**只新写补充用例**:花藤笔数预算、木纹确定性、sprite 出血边、
 * washAlpha 边界、涟漪 / 花瓣爆放的进度边界。index.test.ts 里既有的
 * 5 个视觉 describe 原地保留、一字不迁 —— 用例只增不减。
 */
import { describe, expect, it } from "vitest";
import { KIT_PALETTE } from "../../art/kit";
import {
  PETAL_COLORS,
  TERRITORY_COLORS,
  WASH_MS,
  WQ_WOOD,
  drawPetalBurst,
  drawPlaceRipple,
  paintCornerVine,
  paintWoodBoard,
  stoneSpriteSize,
  washAlpha
} from "./art";
import { FakeCtx2D } from "./testkit";

function ctx(): FakeCtx2D {
  return new FakeCtx2D();
}

describe("weiqi-garden · art:四角花藤预算", () => {
  it("一枝花藤:落笔 ≤ 12(茎 1 + 叶 2 + 瓣 5 + 芯 1),曲线茎真的在", () => {
    const g = ctx();
    paintCornerVine(g as never, 12);
    expect(g.painted).toBeGreaterThanOrEqual(8);
    expect(g.painted).toBeLessThanOrEqual(12);
    // 茎是一条二次曲线,不是直线段
    expect(g.count("quadraticCurveTo")).toBeGreaterThanOrEqual(1);
    // 五瓣 + 花芯 + 两叶都是圆几何
    expect(g.count("arc")).toBeGreaterThanOrEqual(8);
  });

  it("花藤配色只走 kit 色板(糖果瓣 + 柠檬芯),且完全确定", () => {
    const a = ctx();
    paintCornerVine(a as never, 12);
    const fills = a.ops.filter((o) => o.op === "fillStyle").map((o) => o.args[0]);
    expect(fills).toContain(KIT_PALETTE.candy);
    expect(fills).toContain(KIT_PALETTE.lemon);
    const b = ctx();
    paintCornerVine(b as never, 12);
    expect(JSON.stringify(b.ops)).toBe(JSON.stringify(a.ops));
  });

  it("整盘恰四枝花藤:糖果瓣色出现 4 次,木纹淡度 5–8% 共 7 条", () => {
    const g = ctx();
    paintWoodBoard(g as never, { extent: 340, pad: 20 });
    const candy = g.ops.filter((o) => o.op === "fillStyle" && o.args[0] === KIT_PALETTE.candy);
    expect(candy).toHaveLength(4);
    // 木纹的 globalAlpha 全部收在 5–8%(边框的 0.92 / 0.75 除外)
    const grainAlphas = g.ops
      .filter((o) => o.op === "globalAlpha" && (o.args[0] as number) < 0.5)
      .map((o) => o.args[0] as number);
    expect(grainAlphas).toHaveLength(7);
    for (const a of grainAlphas) {
      expect(a).toBeGreaterThanOrEqual(0.05);
      expect(a).toBeLessThanOrEqual(0.08);
    }
  });

  it("木纹以尺寸为种子:同尺寸永远同一组曲线,变尺寸换纹", () => {
    const a = ctx();
    paintWoodBoard(a as never, { extent: 340, pad: 20 });
    const b = ctx();
    paintWoodBoard(b as never, { extent: 340, pad: 20 });
    expect(JSON.stringify(b.ops)).toBe(JSON.stringify(a.ops));
    const c = ctx();
    paintWoodBoard(c as never, { extent: 420, pad: 20 });
    expect(JSON.stringify(c.ops)).not.toBe(JSON.stringify(a.ops));
    // 非法尺寸安静返回
    const d = ctx();
    paintWoodBoard(d as never, { extent: Number.NaN, pad: 20 });
    expect(d.ops).toHaveLength(0);
  });
});

describe("weiqi-garden · art:sprite 出血边", () => {
  it("stoneSpriteSize = 子径 + 出血:小子至少 +4px,大子按 0.4r 放大", () => {
    expect(stoneSpriteSize(10)).toBe(Math.ceil(20 + 4));
    expect(stoneSpriteSize(20)).toBe(Math.ceil(40 + 8));
    // 单调不减
    let prev = 0;
    for (let r = 4; r <= 40; r += 2) {
      const s = stoneSpriteSize(r);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("出血边装得下投影:任意子径下 y+0.75 偏置的 1.02r 影圆不出画布", () => {
    for (let r = 4; r <= 40; r += 3) {
      // stoneSprite 把子心画在 s/2 - 0.75,投影圆(y+1.5, r*1.02)的下缘必须 ≤ s
      expect(stoneSpriteSize(r) / 2).toBeGreaterThanOrEqual(r * 1.02 + 0.75);
    }
  });
});

describe("weiqi-garden · art:washAlpha 边界", () => {
  it("铺色时长契约 600ms,任意输入输出都收在 [0,1]", () => {
    expect(WASH_MS).toBe(600);
    for (const dist of [-5, 0, 3, 10, 25]) {
      for (const t of [-1, 0, 0.2, 0.5, 0.77, 0.999, 1, 2]) {
        const a = washAlpha(dist, 10, t);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it("盘心零距离:进度一起步立即开始淡入;maxDist 为 0 也不除零", () => {
    expect(washAlpha(0, 10, 0.05)).toBeGreaterThan(0);
    expect(() => washAlpha(0, 0, 0.5)).not.toThrow();
    expect(washAlpha(0, 0, 0.5)).toBeGreaterThanOrEqual(0);
    expect(washAlpha(0, 0, 0.5)).toBeLessThanOrEqual(1);
    // reduced / 无动画环境直接传 1:全盘瞬间铺满
    expect(washAlpha(999, 10, 1)).toBe(1);
  });
});

describe("weiqi-garden · art:进度边界与配色合法性", () => {
  it("落子振纹:进行中恰 4 根短线,k ≥ 1 或非法输入一笔不画", () => {
    const mid = ctx();
    drawPlaceRipple(mid as never, 50, 50, 12, 0.4);
    expect(mid.count("stroke")).toBe(4);
    const done = ctx();
    drawPlaceRipple(done as never, 50, 50, 12, 1);
    expect(done.ops).toHaveLength(0);
    const bad = ctx();
    drawPlaceRipple(bad as never, 50, 50, Number.NaN, 0.4);
    expect(bad.ops).toHaveLength(0);
  });

  it("花瓣爆放:t ∈ [0,1) 有落笔且随 t 淡出,t ≥ 1 收场不画", () => {
    const early = ctx();
    drawPetalBurst(early as never, 30, 30, 0.2, "black");
    expect(early.painted).toBeGreaterThan(0);
    const late = ctx();
    drawPetalBurst(late as never, 30, 30, 0.9, "black");
    const alphaOf = (s: FakeCtx2D): number => s.ops.find((o) => o.op === "globalAlpha")?.args[0] as number;
    expect(alphaOf(late)).toBeLessThan(alphaOf(early));
    const end = ctx();
    drawPetalBurst(end as never, 30, 30, 1, "black");
    expect(end.ops).toHaveLength(0);
  });

  it("花瓣与领地铺色配色合法且黑白互异", () => {
    for (const c of [PETAL_COLORS.black, PETAL_COLORS.white, TERRITORY_COLORS.black, TERRITORY_COLORS.white, WQ_WOOD.grain]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(PETAL_COLORS.black).not.toBe(PETAL_COLORS.white);
    expect(TERRITORY_COLORS.black).not.toBe(TERRITORY_COLORS.white);
  });
});
