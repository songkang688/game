import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-79 prince-princess 两人一起 D-pad · 915×412", () => {
  it("矮横屏「朵朵键左、画布中、星星键右」,两套键 540/578 收进舞台(实测 280/318,底 362)", () => {
    expect(SRC).toContain(".pcp-wrap{display:grid;grid-template-columns:auto minmax(0,1fr) auto;");
    expect(SRC).toContain(".pcp-pads{display:contents;}");
    expect(SRC).toContain(".pcp-pad:first-child{grid-column:1;grid-row:2;}");
    expect(SRC).toContain(".pcp-pad:last-child{grid-column:3;grid-row:2;}");
  });

  it("键仍 ≥44、画布 CSS 高不低于 JS 渲染下限附近,判定代码零触碰", () => {
    expect(SRC).toContain("min-width:44px;min-height:44px;");
    expect(SRC).toContain("const cssH = Math.max(150, canvas.clientHeight || 260);");
  });
});
