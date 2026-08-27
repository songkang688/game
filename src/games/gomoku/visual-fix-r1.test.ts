// 窗口3 · 第 1 轮监督修复:B 档 TOP10 之 10(下)——盘外极淡径向暗角,聚焦盘面。
// 钉住:圆心=盘心、内圈全透明、外圈 rgba(74,50,32,0.06),一次填充,画在精装框之前。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./view.ts", import.meta.url), "utf8");

describe("gomoku 盘外暗角(B-10)", () => {
  const seg = src.match(/盘外一圈极淡径向暗角[\s\S]{0,500}?fillRect\(0, 0, VIEW_W, VIEW_W\);/)?.[0] ?? "";

  it("暗角存在:createRadialGradient 圆心在盘心(VIEW_W/2, VIEW_W/2)", () => {
    expect(seg).toContain("createRadialGradient(VIEW_W / 2, VIEW_W / 2,");
  });

  it("内圈全透明、外圈木棕 alpha 0.06(宪法建议 ≤0.06)", () => {
    expect(seg).toContain('addColorStop(0, "rgba(74,50,32,0)")');
    expect(seg).toContain('addColorStop(1, "rgba(74,50,32,0.06)")');
  });

  it("一次填充,不进动画循环:暗角画在 drawGrid 内、精装框之前", () => {
    const gridStart = src.indexOf("function drawGrid()");
    const gridEnd = src.indexOf("function ", gridStart + 10);
    const grid = src.slice(gridStart, gridEnd);
    expect(grid).toContain("盘外一圈极淡径向暗角");
    expect(grid.indexOf("盘外一圈极淡径向暗角")).toBeLessThan(grid.indexOf("paintBoardFrame"));
    // drawGrid 里只这一处 fillRect 用了暗角渐变(vg),不额外引入 requestAnimationFrame
    expect(grid.includes("requestAnimationFrame")).toBe(false);
  });
});
