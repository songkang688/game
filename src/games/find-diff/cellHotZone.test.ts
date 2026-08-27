/**
 * 找不同 · 小图格的热区（窗口5 第2轮 档C · W5R2-C-09 一般）。
 *
 * 测试员：图格 26×26，是这一款唯一的点击目标，低于手指按得准的 44px。
 *
 * 这一条不能靠「把每格撑到 44px」了事，两头都堵死：
 *   · 格子是**紧挨着铺满**的，谁也没法让相邻两格的热区各自 44px 还互不重叠；
 *   · 矮屏上 26px 已经是 `panelCellForRoom()` 的下限，再大两张图就同时看不见了，
 *     而「两张图不用来回滚就能比」正是这一款的玩法本身。
 *
 * 单纯放大命中半径也是空的：`pickNearest` 照样判给几何上最近的那一格，
 * 26px 格 + 4px 缝 = 30px 步距，孩子明明看见了、手指偏 6px 就算点错，
 * 白吃 0.6 秒冷却还掉星。
 *
 * 所以按测试员说的「扩大 hit 区、视觉不变」来：把这 44px 直径的热区
 * **整个让给还没找到的答案格**，剩下的地盘留给普通格子照旧就近判。
 * 屏幕上一个像素没动，容错却真到了 44px。格子撑得到 44px 的大屏上不启用。
 */
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { MIN_HIT_RADIUS, hitRadius, pickForgiving, pickNearest, type CellCenter } from "./runtime";
import { PLAY_CELL_PX } from "./index";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

/** 一排 26px 格子 + 4px 缝隙：步距 30px，正是 360×640 上实测的那一档 */
function rowOfCells(n: number, pitch = 30): CellCenter[] {
  return Array.from({ length: n }, (_, i) => ({ index: i, cx: i * pitch, cy: 0 }));
}

describe("找不同 · 小图格把热区让给答案（W5R2-C-09）", () => {
  const cells = rowOfCells(6);
  const radius = hitRadius(26);

  it("26px 的格子上，命中半径本来就已经是 22px（热区直径 44px）", () => {
    expect(radius).toBe(MIN_HIT_RADIUS);
    expect(radius * 2).toBeGreaterThanOrEqual(44);
  });

  it("偏 6px 点到隔壁格：如实判会判成隔壁，让给答案就算找到", () => {
    // 答案在 3 号格（cx=90），手指落在 96——离 3 号 6px、离 4 号 24px
    expect(pickNearest(cells, 96, 0, radius)).toBe(3);
    // 手指落在 106：离 4 号 14px、离 3 号 16px，如实判归 4 号（点错）
    expect(pickNearest(cells, 106, 0, radius)).toBe(4);
    // 让给答案之后，3 号仍在 22px 以内，算找到
    expect(pickForgiving(cells, 106, 0, radius, (i) => i === 3)).toBe(3);
  });

  it("热区就到 44px 为止，再远还是不算——不是随便点点就能过关", () => {
    // 离 3 号 23px，超出半径：偏心也够不着，退回就近那一格
    expect(pickForgiving(cells, 113, 0, radius, (i) => i === 3)).toBe(4);
    // 一整格开外（离 3 号 45px）更不可能算到 3 号头上
    expect(pickForgiving(cells, 135, 0, radius, (i) => i === 3)).not.toBe(3);
  });

  it("附近没有答案时，跟原来一模一样地就近判", () => {
    for (const x of [0, 14, 16, 45, 96, 106, 150]) {
      expect(pickForgiving(cells, x, 0, radius, () => false)).toBe(pickNearest(cells, x, 0, radius));
    }
  });

  it("半径内一个格子都没有时仍旧当没点到", () => {
    expect(pickForgiving(cells, 400, 400, radius, () => true)).toBeNull();
    expect(pickForgiving([], 0, 0, radius, () => true)).toBeNull();
  });

  it("两个答案都够得着就取更近的那一个，不是取下标小的", () => {
    const isAnswer = (i: number): boolean => i === 2 || i === 4;
    // 落在 84：两个答案都在 22px 以外（离 2 号 24px、离 4 号 36px），退回就近的 3 号
    expect(pickForgiving(cells, 84, 0, radius, isAnswer)).toBe(3);
    // 落在 105：离 4 号 15px、离 2 号 45px —— 取 4 号
    expect(pickForgiving(cells, 105, 0, radius, isAnswer)).toBe(4);
    // 落在 75：离 2 号 15px、离 4 号 45px —— 取 2 号
    expect(pickForgiving(cells, 75, 0, radius, isAnswer)).toBe(2);
  });

  it("已经找到的那些格子不再吃热区，不然重复点老答案会把新答案挡住", () => {
    const found = new Set([3]);
    // 3 号已找到、5 号是新答案；手指落在 106（离 4 号 14、离 3 号 16、离 5 号 44）
    expect(pickForgiving(cells, 106, 0, radius, (i) => i === 5 && !found.has(i))).toBe(4);
    expect(pickForgiving(cells, 106, 0, radius, (i) => i === 3 && !found.has(i))).toBe(4);
  });

  it("只在格子撑不到 44px 时偏心，大屏上仍旧一格一格如实判", () => {
    const hit = SRC.slice(SRC.indexOf("function hitAt("), SRC.indexOf("const missTimes"));
    expect(hit).toContain("width >= PLAY_CELL_PX");
    expect(hit).toContain("pickNearest(centers, clientX, clientY, radius)");
    expect(hit).toContain("pickForgiving(centers, clientX, clientY, radius");
    // 偏心只认「还没找到的答案」
    expect(hit).toContain("answers.has(i) && !foundSet.has(i)");
    expect(PLAY_CELL_PX).toBeGreaterThanOrEqual(44);
  });

  it("视觉一个像素没动：格子尺寸、缝隙、圆角都没跟着改", () => {
    expect(SRC).toContain("const GAP_PX = 4;");
    expect(SRC).toContain("grid.style.gridAutoRows = `${px}px`");
    // 没有偷偷加 padding / margin / transform 把格子撑大
    const cellRule = SRC.slice(SRC.indexOf(".fdf-cell{"), SRC.indexOf("}", SRC.indexOf(".fdf-cell{")));
    expect(cellRule).toContain("padding:0");
    expect(cellRule).not.toMatch(/margin:-/);
  });
});
