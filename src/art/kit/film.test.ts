// film.ts 单测:色相偏移 12° 的换算、6px 省略阈值、绘制零副作用。
import { describe, expect, it } from "vitest";
import {
  FILM_HUE_DEG,
  FILM_MIN_RADIUS,
  filmColor,
  filmVisible,
  hueShift,
  paintBottomCrescent,
  paintFilm,
  type FilmCtx,
} from "./film";

/** 记录桩:把每一笔都记下来,顺便盯 save/restore 配平 */
function recorder(): { ctx: FilmCtx; ops: string[] } {
  const ops: string[] = [];
  const ctx = {
    globalAlpha: 1,
    strokeStyle: "" as string,
    fillStyle: "" as string,
    lineWidth: 1,
    save: () => void ops.push("save"),
    restore: () => void ops.push("restore"),
    beginPath: () => void ops.push("beginPath"),
    arc: (...a: number[]) => void ops.push(`arc(${a.map((n) => n.toFixed(2)).join(",")})`),
    stroke: () => void ops.push("stroke"),
    fill: () => void ops.push("fill"),
  };
  return { ctx: ctx as FilmCtx, ops };
}

describe("film · 色相偏移换算", () => {
  it("hueShift 是标准 HSL 旋转:红转 120° 得绿,转 240° 得蓝,转 0° 原样", () => {
    expect(hueShift("#ff0000", 120)).toBe("#00ff00");
    expect(hueShift("#ff0000", 240)).toBe("#0000ff");
    expect(hueShift("#f26d93", 0)).toBe("#f26d93");
  });

  it("灰色没有色相:转多少度都原样;负角度与 +360-角度等价", () => {
    expect(hueShift("#808080", 12)).toBe("#808080");
    expect(hueShift("#a6d9fa", -12)).toBe(hueShift("#a6d9fa", 348));
  });

  it("filmColor 就是主色 +12°(FILM_HUE_DEG 常量),同色系不换家", () => {
    expect(FILM_HUE_DEG).toBe(12);
    expect(filmColor("#f26d93")).toBe(hueShift("#f26d93", 12));
    // 偏移后仍是暖粉一族(红分量仍占大头),不会跳去绿蓝
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(filmColor("#f26d93").slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
});

describe("film · 6px 阈值与绘制副作用", () => {
  it("薄膜描边在半径 ≥ 6px 出现、< 6px 省略(两点断言)", () => {
    expect(FILM_MIN_RADIUS).toBe(6);
    expect(filmVisible(6)).toBe(true);
    expect(filmVisible(5.9)).toBe(false);
    const big = recorder();
    expect(paintFilm(big.ctx, 10, 10, 6, "#f26d93")).toBe(true);
    expect(big.ops.filter((o) => o === "stroke").length).toBeGreaterThan(0);
    const small = recorder();
    expect(paintFilm(small.ctx, 10, 10, 5.9, "#f26d93")).toBe(false);
    expect(small.ops).toEqual([]);
  });

  it("paintFilm / paintBottomCrescent 除 ctx 外零副作用:save/restore 配平,不动 fillStyle", () => {
    const { ctx, ops } = recorder();
    ctx.fillStyle = "sentinel";
    paintFilm(ctx, 10, 10, 19, "#a6d9fa");
    paintBottomCrescent(ctx, 10, 10, 19);
    expect(ops.filter((o) => o === "save").length).toBe(ops.filter((o) => o === "restore").length);
    expect(ctx.fillStyle).toBe("sentinel");
    expect(ops.some((o) => o === "fill")).toBe(false);
  });
});
