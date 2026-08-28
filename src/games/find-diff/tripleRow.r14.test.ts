/**
 * N-68(trio-r14 A):find-diff 三图关下图 play 格整排线下。
 * 第 100 关族单独横排;L-1 双图并排与 seed/答案零触碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { panelCellForRoomRow, tripleCellPxByWidth, triplePanelsRow } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("N-68 三图关矮横屏单独横排", () => {
  it("第 100 关是 triple,第 1 关不是", () => {
    expect(LEVELS[99].mode).toBe("triple");
    expect(LEVELS[0].mode).toBe("classic");
  });

  it("真横屏才三栏,竖屏不走", () => {
    expect(triplePanelsRow(915, 412)).toBe(true);
    expect(triplePanelsRow(390, 844)).toBe(false);
  });

  it("915 宽 4 列格边 ≥26,3 行按余高也进 412", () => {
    expect(tripleCellPxByWidth(4, 915)).toBeGreaterThanOrEqual(26);
    const h = panelCellForRoomRow(3, 240);
    expect(h * 3).toBeLessThan(412);
  });

  it("挂载接 tripleRow,L-1 的 rowLayout 仍排除 triple", () => {
    expect(SRC).toContain("const rowLayout = !triple && sideBySide");
    expect(SRC).toContain("const tripleRow = triple && triplePanelsRow");
    expect(SRC).toContain('panelsEl.classList.add("fdf-panels-triple")');
    expect(SRC).not.toMatch(/rowLayout\s*=\s*panelsSideBySide/);
  });
});
