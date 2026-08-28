import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-76 combo-clash 轻/重/必杀 · 915×412", () => {
  it("矮横屏「摇杆左、擂台中、三键右」:双人 440..504 → 219..355,训练 666 → 231..367", () => {
    expect(SRC).toContain(".cc-wrap{display:grid;grid-template-columns:auto minmax(0,1fr) auto;");
    expect(SRC).toContain(".cc-pad{display:contents;}");
    expect(SRC).toContain(".cc-btns{grid-column:3;grid-row:2;max-width:150px;justify-content:center;}");
    expect(SRC).toContain(".cc-info{grid-column:1 / -1;grid-row:4;max-height:44px;overflow-y:auto;padding:4px 8px;font-size:12px;}");
  });

  it("帧数据/胜负零触碰:画布钳高函数原样", () => {
    expect(SRC).toContain("export function canvasDisplayCapPx(nativeH: number, roomPx: number, min = MIN_CANVAS_DISPLAY_PX): number | null");
  });
});
