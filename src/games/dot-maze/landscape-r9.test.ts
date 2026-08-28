/**
 * r9 tester-B · N-27 四模式共用 mountStage:矮横屏双栏,键排 sticky。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MIN_CANVAS_DISPLAY_PX } from "./layout";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-27 dot-maze 四模式键排", () => {
  it("MIN_CANVAS_DISPLAY_PX 下限不改", () => {
    expect(MIN_CANVAS_DISPLAY_PX).toBe(160);
  });

  it("playfield 包画布+键排,矮横屏双栏", () => {
    expect(src).toContain("dmz-playfield");
    expect(src).toContain("dmz-side");
    expect(src).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)/);
    expect(src).toMatch(/\.dmz-playfield\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  });
});
