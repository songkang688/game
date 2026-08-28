/**
 * 星星消消乐 · 棋盘完整可见破线(三人组 r4 playbook C-7)。
 *
 * 实测:360×640 有 24 格、915×412 有 48 格在折叠线下(第 3/6 行起整行看不见)
 * ——三消必须整盘可见才能规划消除。修法(配方 B 之 3):格边长按
 * 「宽高两把尺取小」,量舞台可视余量后用 boardCapWidthPx 反推盘宽上限;
 * 消除判定 / 盘面数据 / 时间线零改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./view.ts", import.meta.url), "utf8");
const FIT = SRC.slice(SRC.indexOf("function fitBoard()"), SRC.indexOf("fitBoard();"));

describe("星星消消乐 · 盘面高预算钳宽(C-7)", () => {
  it("fitBoard 走共享件口径:舞台余量 + rows/cols 反推宽上限", () => {
    expect(SRC).toContain('import { boardCapWidthPx, stageClipBottom } from "../stageFit";');
    expect(FIT).toContain("stageClipBottom(root)");
    expect(FIT).toContain("boardCapWidthPx({ h: rect.height, room: clip - rect.top - 4, cols, rows })");
  });

  it("收窄后盘面居中,量之前先摘上一次的钳位", () => {
    expect(FIT).toContain('root.style.maxWidth = "";');
    expect(FIT).toContain('root.style.marginInline = "auto";');
  });

  it("resize 重量、destroy 摘监听与补量计时", () => {
    expect(SRC).toContain('window.addEventListener("resize", fitBoard);');
    expect(SRC).toContain('window.removeEventListener("resize", fitBoard);');
    expect(SRC).toContain("if (fitTimer !== null) clearTimeout(fitTimer);");
  });

  it("格子几何没被顺手动:aspect-ratio:1 与 repeat(cols,1fr) 原样", () => {
    expect(SRC).toContain(".mst-cell{position:relative;aspect-ratio:1;");
    expect(SRC).toContain("board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;");
  });
});
