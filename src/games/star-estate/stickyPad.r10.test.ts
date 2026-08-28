import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-3 star-estate 操作行配方 E", () => {
  it("矮屏钉住 .se-pad，棋盘按余高收方", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".se-pad{");
    expect(SRC).toContain("position:sticky;bottom:0");
    expect(SRC).toContain(".se-board-wrap{max-width:min(560px, calc(100dvh - 140px));}");
  });
});
