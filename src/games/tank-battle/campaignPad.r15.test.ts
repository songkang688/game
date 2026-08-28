import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-84 tank-battle 闯关键排", () => {
  it("单人多留 chrome,矮屏钉全部垫,双人 sticky 字符串仍在", () => {
    expect(SRC).toContain("const extra = opts.players === 1 ? 72 : 0");
    expect(SRC).toContain(".tkb-pads{position:sticky;bottom:0");
    expect(SRC).toContain(".tkb-pads-two{flex-wrap:nowrap;position:sticky;bottom:0");
  });
});
