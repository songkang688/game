/** 三人组 r9 · N-26 闯关七键矮横屏侧栏 + C-9 .dvs-back 热区 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-26 duo-vs-star 闯关横屏键排", () => {
  it("矮横屏把 .dvs-pads 与画布排成双栏,键在侧边", () => {
    expect(src).toContain("@media (max-height:520px) and (orientation:landscape)");
    expect(src).toContain(".dvs-pad{pointer-events:auto;flex-direction:column");
    expect(src).toContain(".dvs-canvas{grid-column:2");
  });

  it(".dvs-back 触区 min-height:40px", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:40px");
  });
});
