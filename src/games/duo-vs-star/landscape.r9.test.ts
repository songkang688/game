/** 三人组 r9 · N-26 闯关七键矮横屏侧栏 + C-9 .dvs-back 热区 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-26 duo-vs-star 闯关横屏键排", () => {
  it("矮横屏把 .dvs-pads 与画布排成双栏,键在侧边(N-94 起 display:contents 直接入格)", () => {
    expect(src).toContain("@media (max-height:520px) and (orientation:landscape)");
    expect(src).toContain(".dvs-pads{display:contents;}");
    expect(src).toContain(".dvs-pad:first-of-type{grid-column:1;grid-row:2;}");
    expect(src).toContain(".dvs-pad:last-of-type{grid-column:3;grid-row:2;}");
    expect(src).toContain(".dvs-canvas{grid-column:2");
  });

  it(".dvs-back 触区 min-height:44px(N-101 由 40 抬到红线)", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:44px");
  });

  it(".dvs-pick 触区 min-height:44px + 矮横屏「开打 ▶」sticky 钉底(N-94/N-101)", () => {
    const rule = src.slice(src.indexOf(".dvs-pick{"), src.indexOf(".dvs-pick.on"));
    expect(rule).toContain("min-height:44px");
    expect(src).toContain(".dvs-menu .dvs-go{position:sticky;bottom:6px");
  });
});
