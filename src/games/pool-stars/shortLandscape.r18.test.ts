/**
 * r18 · N-12:915×412 实测台面 172–512、力度条 519、击球 570、暂停 627 全在线下,
 * 源码原本没有任何高度媒体。修法:
 * 1) `tableLayout` 横版分支也吃 `availHeight`(纯显示缩放,指针映射按 rect 换算,碰撞零触碰);
 * 2) 矮横屏 CSS 网格把力度/击球/旋转列挪到台面右侧。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_BALL_PX, tableLayout } from "./view";

const SRC = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

describe("r18 pool-stars 矮横屏台面钳高", () => {
  it("横版给了剩余高就缩进去,915×412 一屏能装下台面", () => {
    const lay = tableLayout(915, 220);
    expect(lay.vertical).toBe(false);
    expect(lay.cssH).toBeLessThanOrEqual(220);
    expect(lay.cssW).toBe(lay.cssH * 2);
  });

  it("高度充裕时横版行为不变(340 高、球径守 14)", () => {
    const lay = tableLayout(1024);
    expect(lay.vertical).toBe(false);
    expect(lay.cssH).toBe(340);
    expect(lay.ballPx).toBeGreaterThanOrEqual(MIN_BALL_PX);
  });

  it("竖版路径原样(360 宽照旧竖桌,280 余高照旧收进)", () => {
    const lay = tableLayout(360, 280);
    expect(lay.vertical).toBe(true);
    expect(lay.cssH).toBeLessThanOrEqual(280);
  });

  it("矮横屏媒体块把控制排挪到台面右侧列", () => {
    expect(SRC).toContain("@media (min-width:560px) and (max-height:500px)");
    expect(SRC).toMatch(/\.ps-wrap\{display:grid;grid-template-columns:minmax\(0,auto\) minmax\(250px,340px\)/);
    expect(SRC).toContain(".ps-table{grid-column:1;grid-row:2 / span 5;");
    expect(SRC).toContain(".ps-bars,.ps-row,.ps-pockets,.ps-tip{grid-column:2;");
  });
});
