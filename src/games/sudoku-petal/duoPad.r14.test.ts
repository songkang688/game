import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CELL_MIN_LANDSCAPE_PX, CELL_MIN_PX, SP_CSS, boardHeightBudget, cellPxFor } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-70 sudoku-petal 双人同屏数字排", () => {
  it("矮横屏按高度收格，数字排走侧栏 3×3", () => {
    const h = boardHeightBudget(2, 412);
    expect(h).toBeGreaterThanOrEqual(120);
    const cell = cellPxFor(9, 915, 2, h);
    expect(cell).toBeLessThanOrEqual(32);
    expect(cell).toBeGreaterThanOrEqual(CELL_MIN_LANDSCAPE_PX);
    expect(cell * 9).toBeLessThanOrEqual(280);
    expect(SP_CSS).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SP_CSS).toContain("grid-template-columns:repeat(3,1fr)!important");
    expect(SRC).toContain("boardHeightBudget(2)");
  });

  it("只传宽度时 360 竖屏仍守 CELL_MIN_PX（闯关回归）", () => {
    expect(cellPxFor(9, 360)).toBeGreaterThanOrEqual(CELL_MIN_PX);
    expect(boardHeightBudget(1, 412)).toBe(0);
  });
});

describe("N-49 sudoku-petal 对战竞速（与 N-70 分测）", () => {
  it("竞速双盘同样吃高度预算，不和双人同屏合成一条验收", () => {
    expect(SRC).toContain("startVersus");
    expect(SRC).toContain("boardHeightBudget(2)");
    const cell = cellPxFor(9, 915, 2, boardHeightBudget(2, 412));
    expect(cell * 9).toBeLessThan(412);
  });
});
