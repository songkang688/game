import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-3 star-estate r14 视口钳 dvh", () => {
  it("保留 r12 wrap 锁,再垫 100dvh-76", () => {
    expect(SRC).toContain(".se-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(SRC).toContain(".se-wrap{max-height:calc(100dvh - 76px)}");
  });
});
