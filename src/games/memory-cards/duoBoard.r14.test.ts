import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { versusGridCols } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-69 memory-cards 双人轮流翻牌阵", () => {
  it("915×412 走 8 列两行，竖屏仍 4 列", () => {
    expect(versusGridCols(915, 412, 8)).toBe(8);
    expect(versusGridCols(390, 844, 8)).toBe(4);
    expect(versusGridCols(1280, 800, 8)).toBe(4);
  });

  it("矮横屏 CSS 钳卡高，JS 用 versusGridCols", () => {
    expect(SRC).toContain("mmc-duo");
    expect(SRC).toContain("versusGridCols");
    expect(SRC).toContain("@media (max-height: 500px)");
    expect(SRC).toContain("aspect-ratio: 1");
  });
});
