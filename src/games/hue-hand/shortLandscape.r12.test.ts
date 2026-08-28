import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 hue-hand r12 矮屏抽牌排", () => {
  it("500px 高档把 .hh-btns 钉底", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".hh-btns{position:sticky;bottom:0");
  });
});
