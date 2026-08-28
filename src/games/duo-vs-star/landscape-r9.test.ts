/**
 * r9 tester-B · N-26 闯关七键矮横屏双栏 + .dvs-back min-height 40。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MIN_CANVAS_DISPLAY_PX } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-26 duo-vs-star 闯关键排", () => {
  it("画布显示高下限不改", () => {
    expect(MIN_CANVAS_DISPLAY_PX).toBe(150);
  });

  it(".dvs-back min-height 40;矮横屏 pads 分列画布两侧", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:40px");
    expect(src).toMatch(/\.dvs-pads\{[^}]*position:sticky/);
    expect(src).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)/);
    expect(src).toContain('grid-area:padr');
  });
});
