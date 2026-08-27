// 档C · 第 3 轮学习优化员 · L3-03:无尽墙的颜色也做成一条曲线。
//
// 前两轮盯的都是「后段会不会冻住」,这一条反过来:`bubble-aim` 的无尽**一进门就是满配 5 色**,
// 比战役第 1 主题还密——第 1 关只有 3 种颜色,是有意的热身,而无尽第一颗泡泡就是 5 选 1。
// 密度那条曲线(`endlessRowFill`)只让墙越来越挤,颜色数从头到尾一个样,
// 于是这一款的无尽「最难的地方在开头」。
//
// 改法只加一个纯函数 `endlessPalette(rowsPushed, colors)`:开局 3 色,
// 压到第 4 行加第 4 色,第 10 行加第 5 色。**第 10 行之后和原来一模一样**,
// 改的只是前十行的坡度。关卡数据一个字没动(1.0 前 99 关那把哈希锁照旧锁着)。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  ENDLESS_COLOR_STEPS,
  ENDLESS_START_ROWS,
  endlessPalette,
  endlessRow,
  endlessRowFill,
  endlessStartRows,
} from "./aim12";
import { LEGACY_LEVELS, LEVELS } from "./levels";
import { RAINBOW, STONE, descend, parseLayout, rowLen } from "./logic";

const COLORS = ["R", "Y", "G", "B", "P"];

/** 一关的布局里用了几种普通颜色 */
function colorsUsed(layout: readonly string[]): number {
  const set = new Set<string>();
  for (const row of layout) for (const ch of row) {
    if (ch !== "." && ch !== RAINBOW && ch !== STONE) set.add(ch);
  }
  return set.size;
}

describe("档C R3 学习优化 · L3-03 无尽墙的颜色曲线", () => {
  it("问题成立:战役第 1 关只有三种颜色,原来的无尽开局却是满配五色", () => {
    expect(colorsUsed(LEVELS[0].layout), "第 1 关的颜色数").toBeLessThanOrEqual(3);
    expect(COLORS).toHaveLength(5);
    // 改之后开局跟着战役第 1 关走
    expect(endlessPalette(0, COLORS)).toHaveLength(3);
  });

  it("颜色一档一档加:0 行 3 色 → 第 4 行 4 色 → 第 10 行 5 色", () => {
    expect(ENDLESS_COLOR_STEPS).toEqual([4, 10]);
    expect(endlessPalette(0, COLORS)).toEqual(["R", "Y", "G"]);
    expect(endlessPalette(3, COLORS)).toHaveLength(3);
    expect(endlessPalette(4, COLORS)).toEqual(["R", "Y", "G", "B"]);
    expect(endlessPalette(9, COLORS)).toHaveLength(4);
    expect(endlessPalette(10, COLORS)).toEqual(COLORS);
  });

  it("第 10 行之后和原来一模一样 —— 后段一点没动", () => {
    for (let rows = 10; rows <= 200; rows++) {
      expect(endlessPalette(rows, COLORS), `压了 ${rows} 行`).toEqual(COLORS);
    }
  });

  it("颜色数只增不减,而且永远是原表的前几种,不会凭空造颜色", () => {
    let prev = 0;
    for (let rows = 0; rows <= 60; rows++) {
      const p = endlessPalette(rows, COLORS);
      expect(p.length, `压了 ${rows} 行反而少了一种颜色`).toBeGreaterThanOrEqual(prev);
      prev = p.length;
      expect(p).toEqual(COLORS.slice(0, p.length));
      for (const c of p) expect(COLORS).toContain(c);
    }
  });

  it("给的颜色表本来就短也不会崩:一种、两种、空表都有得打", () => {
    expect(endlessPalette(0, [])).toEqual([]);
    expect(endlessPalette(0, ["R"])).toEqual(["R"]);
    expect(endlessPalette(99, ["R", "Y"])).toEqual(["R", "Y"]);
    for (const rows of [-99, -1, 0.4, NaN]) {
      const p = endlessPalette(rows, COLORS);
      expect(p.length, `压了 ${rows} 行`).toBe(3);
    }
  });

  it("压下来的每一行长度照旧对得上,字符全在调色板里", () => {
    const rand = mulberry32(4242);
    let grid = parseLayout(endlessStartRows(endlessPalette(0, COLORS), rand, ENDLESS_START_ROWS));
    for (let pushed = 0; pushed < 30; pushed++) {
      const palette = endlessPalette(pushed, COLORS);
      const line = endlessRow(grid, palette, rand, pushed);
      expect(line.length, `第 ${pushed} 行长度不对`).toBe(rowLen(grid.flip ^ 1, 0));
      for (const ch of line) {
        if (ch === ".") continue;
        expect(palette, `第 ${pushed} 行冒出了调色板外的「${ch}」`).toContain(ch);
      }
      descend(grid, line);
    }
  });

  it("开局那几行也跟着调色板走,而且不会铺出空屏", () => {
    const rand = mulberry32(77);
    const rows = endlessStartRows(endlessPalette(0, COLORS), rand, ENDLESS_START_ROWS);
    expect(rows).toHaveLength(ENDLESS_START_ROWS);
    const flat = rows.join("");
    expect([...flat].some((c) => c !== "."), "开局铺成了空屏").toBe(true);
    for (const ch of flat) {
      if (ch === ".") continue;
      expect(["R", "Y", "G"], `开局冒出了第 4/5 色「${ch}」`).toContain(ch);
    }
  });

  it("密度那条曲线一个数都没动(这次只动颜色)", () => {
    expect(endlessRowFill(0)).toBeCloseTo(0.6, 6);
    expect(endlessRowFill(5)).toBeCloseTo(0.75, 6);
    expect(endlessRowFill(100)).toBeCloseTo(0.95, 6);
  });

  it("1.0 前 99 关的关卡数据照旧一个字没改", () => {
    // 关卡表这一轮完全没碰:抽几关比一比形状,细的由 logic.test.ts 那把 FNV 哈希锁盯着
    expect(LEGACY_LEVELS).toBe(99);
    expect(LEVELS[0].layout).toEqual(LEVELS[0].layout);
    expect(LEVELS[0].shots).toBeGreaterThan(0);
    expect(colorsUsed(LEVELS[0].layout)).toBeLessThanOrEqual(3);
  });
});
