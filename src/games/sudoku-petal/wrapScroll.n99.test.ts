/**
 * N-99：915×412 盘身(9×9 连键排 570+)比舞台可视段(178/134)高,
 * `.sp-wrap` overflow:hidden 让盘底两排既看不见也滚不到(用户手指滚不动)。
 * 修法:矮横屏把 .sp-wrap 的竖向滚动交还给用户;数字排/工具排沿用 sticky 钉底。
 * 题库 / seed / 判定零触碰;390×844(高>500px)走不进这档,fold 0 不回退。
 */
import { describe, expect, it } from "vitest";
import { SP_CSS, CELL_MIN_PX, KEY_MIN_PX } from "./index";

function shortBlock(): string {
  const at = SP_CSS.indexOf("@media (max-height:500px)");
  expect(at, "SP_CSS 应有 max-height:500px 档").toBeGreaterThanOrEqual(0);
  const next = SP_CSS.indexOf("@media", at + 1);
  return SP_CSS.slice(at, next > 0 ? next : undefined);
}

describe("N-99 sudoku-petal 矮横屏盘可滚", () => {
  it("矮横屏 .sp-wrap 竖向 overflow 改 auto,盘底两排滚得到", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.sp-wrap\{overflow-y:auto/);
  });

  it("数字排/工具排 sticky 钉底不回退(N-70 配方原样)", () => {
    const block = shortBlock();
    expect(block).toMatch(/\.sp-pad,\.sp-tools\{position:sticky;bottom:0/);
  });

  it("竖屏基线不动:.sp-wrap 基础态仍 overflow:hidden,热区红线仍在", () => {
    // 基础规则(媒体查询外)保持 hidden,390×844 的既有绿灯不动
    const base = SP_CSS.slice(0, SP_CSS.indexOf("@media"));
    expect(base).toMatch(/\.sp-wrap\{[^}]*overflow:hidden/);
    expect(CELL_MIN_PX).toBe(34);
    expect(KEY_MIN_PX).toBe(46);
  });
});
