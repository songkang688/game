// 竖向裁切审计修复:棋盘边长以前只按「还剩多宽」算,10 行高的仓库在 360×640
// 竖屏上棋盘长到 400px 开外,把下面的触屏方向盘(唯一的手指走法)顶出
// `.game-stage` 的裁切线;横屏 640×360 上更是整块方向盘都没了。
// 修法:`assist.fitCellRect(cols, rows, availW, availH)` 宽高两把尺一起量,取小的那把;
// 竖向量不出来时退回「只按宽算」的老行为,一个字不变。
import { describe, expect, it } from "vitest";
import { CELL_GAP, CELL_MAX, CELL_MIN, boardWidth, fitCell, fitCellRect } from "./assist";
import { TOTAL, getLevel } from "./levels";

/** 棋盘横向预算:视口 − 8(.game-stage 白边) − 12(.bh-stagebox 6px 内边距 ×2) */
const budgetW = (viewport: number): number => viewport - 8 - (viewport <= 420 ? 12 : 20);

describe("fitCellRect · 宽高两把尺", () => {
  it("高度充裕时和 fitCell(只按宽)一个数", () => {
    for (const availW of [200, 332, 480, 900]) {
      for (let cols = 1; cols <= 14; cols++) {
        expect(fitCellRect(cols, 8, availW, 10_000)).toBe(fitCell(cols, availW));
      }
    }
  });

  it("竖向量不出来(NaN / 0 / 负数 / Infinity)时退回只按宽算", () => {
    for (const bad of [Number.NaN, 0, -50, Number.POSITIVE_INFINITY]) {
      expect(fitCellRect(9, 9, 332, bad)).toBe(fitCell(9, 332));
    }
  });

  it("高度紧张时听竖向那把尺:行数越多格子越小,棋盘高度永远不超预算", () => {
    for (const availH of [120, 180, 240, 300]) {
      for (let rows = 2; rows <= 14; rows++) {
        const cell = fitCellRect(8, rows, 1_000, availH);
        expect(cell).toBeGreaterThanOrEqual(CELL_MIN);
        expect(cell).toBeLessThanOrEqual(CELL_MAX);
        // boardWidth 的公式对行同样成立:n 格 + (n−1) 条缝
        const boardH = boardWidth(rows, cell);
        // CELL_MIN 兜底时可以超(那是「再小就看不清」的下限,超出部分交给舞台滚动)
        if (cell > CELL_MIN) expect(boardH, `${rows} 行 × ${cell}px 超出 ${availH}px`).toBeLessThanOrEqual(availH);
      }
    }
  });

  it("两把尺各自失效互不拖累:宽失效听高,高失效听宽", () => {
    expect(fitCellRect(9, 9, Number.NaN, 200)).toBe(fitCell(9, 200));
    expect(fitCellRect(9, 9, 200, Number.NaN)).toBe(fitCell(9, 200));
  });
});

describe("fitCellRect · 188 关逐关体检", () => {
  it("360×640 竖屏:棋盘 + 方向盘一屏装下(棋盘竖向预算 ≈ 340px)", () => {
    // 640 视口 − 顶栏(~48) − 舞台白边(8) − HUD 行(~40) − 方向盘两行(~116) − 提示(~30) − 标签行(~26) ≈ 340
    const availW = budgetW(360);
    const availH = 340;
    for (let i = 0; i < TOTAL; i++) {
      const def = getLevel(i);
      const cell = fitCellRect(def.w, def.h, availW, availH);
      const h = boardWidth(def.h, cell);
      if (cell > CELL_MIN) {
        expect(h, `第 ${i + 1} 关(${def.h} 行)棋盘高 ${h}px,预算 ${availH}px`).toBeLessThanOrEqual(availH);
      }
      expect(boardWidth(def.w, cell)).toBeLessThanOrEqual(availW);
    }
  });

  it("640×360 横屏:竖向预算只剩 ~150px 时格子跟着缩,绝不比 CELL_MIN 再小", () => {
    const availW = budgetW(640);
    for (let i = 0; i < TOTAL; i++) {
      const def = getLevel(i);
      const cell = fitCellRect(def.w, def.h, availW, 150);
      expect(cell).toBeGreaterThanOrEqual(CELL_MIN);
      expect(cell).toBeLessThanOrEqual(fitCell(def.w, availW));
    }
  });

  it("CELL_GAP 与 CSS 的 gap 还是同一个数(fitCellRect 沿用同一条缝)", () => {
    expect(CELL_GAP).toBe(2);
  });
});
