import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-3 star-estate r12 消灭舞台自滚", () => {
  it("矮屏锁 .se-wrap 高并收方盘", () => {
    expect(SRC).toContain("position:sticky;bottom:0");
    expect(SRC).toContain(".se-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(SRC).toContain("max-height:min(200px,42dvh)");
  });
});
