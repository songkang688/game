import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CELL_MIN_PX, cellPxFor, SP_CSS } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-70 / N-49 sudoku-petal 双人同屏 ≠ 对战竞速", () => {
  it("N-70:矮宽屏把数字排改成盘旁 3 列", () => {
    expect(SP_CSS).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SP_CSS).toContain("grid-template-columns:repeat(3,1fr)");
    expect(SP_CSS).toContain(".sp-seats{flex-wrap:nowrap");
    expect(SRC).toContain("👫 双人同屏");
  });

  it("N-49:两盘从 640 宽起左右分,360 单盘仍 ≥ CELL_MIN", () => {
    expect(SRC).toContain("usable >= 640");
    expect(cellPxFor(9, 700, 2)).toBeLessThan(cellPxFor(9, 700, 1));
    expect(cellPxFor(9, 360)).toBeGreaterThanOrEqual(CELL_MIN_PX);
  });
});
