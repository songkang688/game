import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * N-3(r18):915×412 实测棋盘 top 387、骰子 top 419、当前格预览 top 462,全在
 * 剪裁线(~346)以下——掷骰后棋子怎么走完全看不见。宽而矮的屏改双栏:
 * 棋盘(含骰盘/预览/播报)居左、按余高只放大不缩小(下限 156px 守住 r17 红线),
 * 回合/席位/三键走右列。纯 CSS,回合流程与胜负判定零触碰。
 */
describe("N-3 star-estate 矮横屏双栏", () => {
  it("宽矮屏切 grid 双栏,棋盘只放大不缩小(≥156px)", () => {
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".se-wrap{display:grid;grid-template-columns:auto minmax(0,1fr);");
    expect(SRC).toContain(".se-board-wrap{grid-column:1;grid-row:1 / span 8;");
    expect(SRC).toContain("width:max(156px, min(calc(100dvh - 258px), 340px));");
  });

  it("竖屏配方 E(sticky 骰盘 + 156px 钳)原样保留", () => {
    expect(SRC).toContain(".se-board-wrap{max-height:min(156px,38dvh);}");
    expect(SRC).toContain("position:sticky;bottom:0;z-index:6;");
  });
});
