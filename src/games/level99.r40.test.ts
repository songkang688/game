/**
 * trio-r40 A：平板 wrap 760、N-182 *-softbtn 闸。
 * 不改 mapColumns 断点、.l99-tabs overflow-x、玩法。N-105 无新版本。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapColumns } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-117 收纳与 tabs 闸不回退", () => {
  it("非当前章仍 36px 徽章，页签条 flex-wrap 且无 overflow-x:auto", () => {
    expect(SRC).toContain("l99-tab-lockmark");
    expect(SRC).toMatch(/\.l99-tab:not\(\.l99-tab-on\)\{width:36px/);
    expect(SRC).toMatch(/\.l99-tabs\{[^}]*flex-wrap:wrap/);
    expect(SRC).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:\s*auto/);
  });
});

describe("平板档 wrap 不超过 760（仍 7 列）", () => {
  it("mapColumns 断点数值不回退", () => {
    expect(mapColumns(320)).toBe(4);
    expect(mapColumns(390)).toBe(5);
    expect(mapColumns(560)).toBe(6);
    expect(mapColumns(760)).toBe(7);
    expect(mapColumns(761)).toBe(8);
  });

  it("矮屏默认 680；平板 min-height 600 才到 760，不越过 7 列阈值", () => {
    expect(SRC).toMatch(/\.l99-wrap\{max-width:680px/);
    expect(SRC).toMatch(
      /@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/,
    );
    expect(SRC).not.toMatch(/\.l99-wrap\{max-width:76[1-9]px/);
    expect(SRC).not.toMatch(/\.l99-wrap\{max-width:[8-9]\d{2}px/);
  });
});
