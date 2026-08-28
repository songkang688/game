/**
 * r9 tester-B 增量：N-15 bomb-buddies 对战态 915×412 六键，矮横屏双栏。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-15 bomb-buddies 对战键排矮横屏", () => {
  it("触屏键排 sticky，915 矮横屏分列棋盘两侧", () => {
    expect(src).toMatch(/\.bmb-pads\{[^}]*position:sticky/);
    expect(src).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)/);
    expect(src).toContain("grid-area:padl");
    expect(src).toContain("grid-area:padr");
  });
});
