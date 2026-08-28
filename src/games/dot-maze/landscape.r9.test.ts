/** 三人组 r9 · N-27 四模式方向键矮横屏双栏 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-27 dot-maze 横屏键排", () => {
  it("矮横屏单人 D-pad 在画布右、双人一人一侧", () => {
    expect(src).toContain("@media (max-height:520px) and (orientation:landscape)");
    expect(src).toContain(".dmz-wrap:has(> .dmz-canvas) > .dmz-pad{grid-column:3");
    expect(src).toContain(".dmz-wrap:has(> .dmz-canvas) > .dmz-pads{display:contents;}");
    expect(src).toContain(".dmz-pad-col:first-child{grid-column:1");
    expect(src).toContain(".dmz-pad-col:last-child{grid-column:3");
  });

  it("进门菜单白底修复不回退:.dmz-menu 仍 flex 撑满", () => {
    expect(src).toContain(".dmz-menu{display:flex;flex-direction:column");
    expect(src).toContain("flex:1;justify-content:center;");
  });
});
