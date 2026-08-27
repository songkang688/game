// 窗口 4 · QA 档C · 第 1 轮监督修复员:C1-01(严重)的回归网。
//
// 问题:格子边长是媒体查询写死的(42 / 34 / 28),和列数没关系。
// 13 列的双鼠宽仓要 466px,而 360px 手机留给棋盘的只有 332px,
// 偏偏 `.game-stage` 是 `overflow:hidden` —— 右边 4 列不是能滑出来,是直接没了。
// 修法:`assist.fitCell(cols, avail)` 按「还剩多宽」倒着算边长,`index.ts` 建棋盘和转屏时各量一次。
import { describe, expect, it } from "vitest";
import { TOTAL, buildEndless, getLevel } from "./levels";
import { CELL_GAP, CELL_MAX, CELL_MIN, boardWidth, fitCell } from "./assist";

/** 各档窄屏上棋盘还剩多少像素:视口 − 8(.game-stage 白边) − 12(.bh-stagebox 6px 内边距 ×2) */
const budget = (viewport: number): number => viewport - 8 - (viewport <= 420 ? 12 : 20);

/** 本档要保的几档屏宽:360 是硬指标,其余是顺带的下限体检 */
const VIEWPORTS = [320, 340, 360, 375, 390, 414, 420, 768, 1024];

describe("档C R1 修复 · C1-01 · fitCell 本身", () => {
  it("地方够就给最大边长,地方不够就按列数缩,永远不超预算", () => {
    for (const vw of VIEWPORTS) {
      const avail = budget(vw);
      for (let cols = 1; cols <= 20; cols++) {
        const cell = fitCell(cols, avail);
        expect(cell, `${vw}px × ${cols} 列的边长`).toBeGreaterThanOrEqual(CELL_MIN);
        expect(cell).toBeLessThanOrEqual(CELL_MAX);
        expect(Number.isInteger(cell), `${vw}px × ${cols} 列算出了小数边长`).toBe(true);
        if (cols * CELL_MAX + (cols - 1) * CELL_GAP <= avail) expect(cell).toBe(CELL_MAX);
      }
    }
  });

  it("列数越多格子越小,不会越加越大", () => {
    const avail = budget(360);
    for (let cols = 2; cols <= 20; cols++) {
      expect(fitCell(cols, avail), `${cols} 列`).toBeLessThanOrEqual(fitCell(cols - 1, avail));
    }
  });

  it("地方越大格子越大,不会越宽越小", () => {
    for (let cols = 4; cols <= 13; cols++) {
      for (let i = 1; i < VIEWPORTS.length; i++) {
        const a = fitCell(cols, budget(VIEWPORTS[i - 1]));
        const b = fitCell(cols, budget(VIEWPORTS[i]));
        expect(b, `${cols} 列从 ${VIEWPORTS[i - 1]}px 到 ${VIEWPORTS[i]}px 反而变小了`).toBeGreaterThanOrEqual(a);
      }
    }
  });

  it("量不到宽度(0 / 负数 / NaN)时退回最大边长,不会算出 0 或负数", () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fitCell(9, bad)).toBe(CELL_MAX);
    }
    expect(fitCell(0, 300)).toBe(fitCell(1, 300));
    expect(fitCell(-3, 300)).toBe(fitCell(1, 300));
  });

  it("boardWidth 和 CSS 的算法对得上:n 格 + (n−1) 条缝", () => {
    expect(boardWidth(1, 30)).toBe(30);
    expect(boardWidth(7, 34)).toBe(7 * 34 + 6 * 2);
    expect(boardWidth(13, 23)).toBe(13 * 23 + 12 * 2);
    expect(CELL_GAP).toBe(2);
  });
});

describe("档C R1 修复 · C1-01 · 188 关 + 无尽仓逐关体检", () => {
  it("360px 上 188 关一关都不溢出", () => {
    const avail = budget(360);
    for (let i = 0; i < TOTAL; i++) {
      const def = getLevel(i);
      const px = boardWidth(def.w, fitCell(def.w, avail));
      expect(px, `第 ${i + 1} 关(${def.w} 列)要 ${px}px,只有 ${avail}px`).toBeLessThanOrEqual(avail);
    }
  });

  it("从 320px 到 1024px 每一档屏宽、每一关都不溢出", () => {
    for (const vw of VIEWPORTS) {
      const avail = budget(vw);
      for (let i = 0; i < TOTAL; i++) {
        const def = getLevel(i);
        const px = boardWidth(def.w, fitCell(def.w, avail));
        expect(px, `${vw}px 上第 ${i + 1} 关(${def.w} 列)溢出 ${px - avail}px`).toBeLessThanOrEqual(avail);
      }
      for (let r = 0; r < 24; r++) {
        const def = buildEndless(r);
        const px = boardWidth(def.w, fitCell(def.w, avail));
        expect(px, `${vw}px 上无尽第 ${r + 1} 仓溢出`).toBeLessThanOrEqual(avail);
      }
    }
  });

  it("宽仓在 360px 上缩得下但还看得清:最宽的 13 列也有 23px 一格", () => {
    const cell = fitCell(13, budget(360));
    expect(cell).toBeGreaterThanOrEqual(20);
    expect(boardWidth(13, cell)).toBeLessThanOrEqual(budget(360));
  });

  it("宽屏上没有被这次修改缩水:7~9 列在 768px 上仍是最大边长", () => {
    for (const cols of [7, 8, 9]) expect(fitCell(cols, budget(768))).toBe(CELL_MAX);
  });

  it("棋盘高度也放得下:360px 上最高的那一关不超过一屏", () => {
    const avail = budget(360);
    let worst = 0;
    for (let i = 0; i < TOTAL; i++) {
      const def = getLevel(i);
      worst = Math.max(worst, boardWidth(def.h, fitCell(def.w, avail)));
    }
    // 360×640 的老机器上，棋盘之外还要留 HUD + 方向盘（约 260px）
    expect(worst).toBeLessThanOrEqual(640 - 260);
  });
});
