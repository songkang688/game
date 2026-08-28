import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-84 tank-battle 闯关键排 · 915×412", () => {
  it("矮横屏单人档「战场左、摇杆右」,▲💥464/方向513 收进舞台(实测 255/304,底 350)", () => {
    expect(SRC).toContain(".tkb-wrap:not(.tkb-wrap-two){display:grid;grid-template-columns:minmax(0,1fr) auto;");
    expect(SRC).toContain(".tkb-wrap:not(.tkb-wrap-two) .tkb-pads{grid-column:2;grid-row:3;width:auto;}");
    expect(SRC).toContain('wrap.className = `tkb-wrap${opts.players === 2 ? " tkb-wrap-two" : ""}`');
  });

  it("N-53 双人档零触碰:双垫仍并排钉底,媒体查询原句还在", () => {
    expect(SRC).toContain(".tkb-pads-two{flex-wrap:nowrap;position:sticky;bottom:0");
    expect(SRC).toContain("opts.players === 2 ? TOUCH_MIN_TWO : TOUCH_MIN");
    expect(SRC).toContain("measured - chrome");
  });
});
