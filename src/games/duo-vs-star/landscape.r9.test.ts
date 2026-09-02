/** 三人组 r9 · N-26 闯关七键矮横屏侧栏 + C-9 .dvs-back 热区 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-26 duo-vs-star 闯关横屏键排", () => {
  it("矮横屏键排 fixed 钉视口底、两组横排分居左右(r19 N-101:侧栏双栏在 .l99-host 裁切壳里整排出屏,改钉底)", () => {
    expect(src).toContain("@media (max-height:520px) and (orientation:landscape)");
    expect(src).toContain(".dvs-pads{\n    position:fixed;left:6px;right:6px;bottom:4px;");
    expect(src).toContain(".dvs-pad{pointer-events:auto;flex-direction:row;flex-wrap:nowrap");
    expect(src).toContain(".dvs-canvas{grid-column:2");
  });

  it(".dvs-back 触区 min-height:44px(r19 N-94 从 40 抬到 44)", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:44px");
  });
});
