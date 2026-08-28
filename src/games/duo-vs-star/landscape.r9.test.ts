/** 三人组 r9 · N-26 闯关七键矮横屏侧栏 + C-9 .dvs-back 热区 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-26 duo-vs-star 闯关横屏键排", () => {
  // r9-B(d909) 复测:原来这条钉的是 `.dvs-pad{flex-direction:column}` 与 `.dvs-canvas{grid-column:2}`。
  // 那一版实测没接住 —— 七枚键竖着摞成 365px 一条,五个模式仍全线下(见 shortLandscape.r9b.test.ts)。
  // 断言改成钉「键排在侧栏、画布单独占一栏」这个意图,不再钉具体那两条写法。
  it("矮横屏把 .dvs-pads 与画布排成双栏,键在侧边", () => {
    expect(src).toContain("@media (max-height:520px) and (orientation:landscape)");
    expect(src).toContain(".dvs-arena>.dvs-pads{grid-area:pads;");
    expect(src).toContain(".dvs-arena>.dvs-canvas{grid-area:canvas;");
  });

  it(".dvs-back 触区 min-height:40px", () => {
    const rule = src.slice(src.indexOf(".dvs-back{"), src.indexOf(".dvs-back:active"));
    expect(rule).toContain("min-height:40px");
  });
});
