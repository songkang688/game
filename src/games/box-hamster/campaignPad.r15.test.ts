import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CELL_MIN } from "./assist";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-80 box-hamster 闯关方向键", () => {
  it("矮屏锁壳钉方向盘,CELL_MIN 不降以免回退无尽", () => {
    expect(CELL_MIN).toBe(18);
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".bh-pad{position:sticky;bottom:0");
    expect(SRC).toContain(".bh-wrap{height:100%;max-height:calc(100dvh - 108px)");
  });
});
