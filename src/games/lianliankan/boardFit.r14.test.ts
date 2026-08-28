import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { boardBoxSize, cellSizePx } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-72 lianliankan 关内盘面", () => {
  it("915×412 余高把盘收进 250px 盒，竖屏 360 格边不回退", () => {
    const box = boardBoxSize(4, 4, 890, 250);
    expect(box.height).toBeLessThanOrEqual(250);
    expect(box.width).toBeLessThanOrEqual(890);
    expect(box.cell).toBeGreaterThanOrEqual(18);
    expect(cellSizePx(4)).toBeGreaterThanOrEqual(32);
  });

  it("矮屏 CSS 收盘不挤洗牌/提示", () => {
    expect(SRC).toContain("boardBoxSize");
    expect(SRC).toContain("@media (max-height: 500px)");
    expect(SRC).toContain(".llk-boardbox");
    expect(SRC).toContain(".llk-tools { position: sticky");
  });
});
