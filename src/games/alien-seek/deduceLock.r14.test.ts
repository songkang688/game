/**
 * C-6(trio-r14 A):推理关 121。撞车取 r13 先合版（舞台余量钳高 + pads sticky）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDeduceLevel, LEVELS } from "./levels";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("C-6 推理关 121 锁舞台自滚", () => {
  it("Array(121).fill(1) 后继续仍是 deduce", () => {
    expect(isDeduceLevel(121)).toBe(true);
    expect(LEVELS[121]?.mode).toBe("deduce");
  });

  it("先合版：.as-wrap overflow hidden + pads sticky + 余量钳高", () => {
    expect(SRC).toContain("height:100%;max-height:100%;min-height:0;overflow:hidden;");
    expect(SRC).toContain(".as-wrap>.as-pads{grid-column:2;position:sticky;bottom:0");
    expect(SRC).toContain("const cap = Math.max(96, room - 8)");
    expect(SRC).toContain('wrap.classList.add("as-deduce")');
  });
});
