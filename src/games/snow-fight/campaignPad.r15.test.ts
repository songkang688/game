import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-85 snow-fight 闯关搓雪键", () => {
  it("单人预留垫高并允许矮屏 ys<1,对战 data-duo 并排保留", () => {
    expect(SRC).toContain("opts.humans === 1 ? 118 : 0");
    expect(SRC).toContain("shortY ? 0.7 : 1");
    expect(SRC).toContain(".snf-pads[data-duo]{display:grid;grid-template-columns:1fr 1fr");
    expect(SRC).toContain(".snf-pads{position:sticky;bottom:0");
  });
});
