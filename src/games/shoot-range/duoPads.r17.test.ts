import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-78 shoot-range 双人开火 · 915×412", () => {
  it("矮横屏「键左、靶场中、键右」,开火键 539..679 收进舞台(实测 233..373),靶场等比 310×192", () => {
    expect(SRC).toContain(".shr-wrap{display:grid;grid-template-columns:auto minmax(0,1fr) auto;");
    expect(SRC).toContain(".shr-box{grid-column:2;grid-row:2;width:100%;max-width:310px;justify-self:center;}");
    expect(SRC).toContain(".shr-pads{display:contents;}");
  });

  it("弹道判定零触碰:resize 等比公式与 FIELD 常量引用原样", () => {
    expect(SRC).toContain("const cssH = Math.min(320, Math.round((cssW / FIELD_W) * FIELD_H));");
    expect(SRC).toContain("scale = canvas.width / FIELD_W;");
  });
});
