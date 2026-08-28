import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-81 snake-snack 无尽花园 · 915×412", () => {
  it("矮横屏「画布左、徽章+方向键右」:画布 656(底 881)→222(底 407),方向键 913..1015→271..369", () => {
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".sn-wrap{display:grid;grid-template-columns:minmax(0,auto) 200px;");
    expect(SRC).toContain(".sn-canvas{grid-column:1;grid-row:1 / span 4;width:auto;max-width:100%;height:min(320px,calc(100dvh - 190px));}");
    expect(SRC).toContain(".sn-pad{grid-column:2;grid-row:3;margin-top:6px;grid-template-columns:repeat(3,60px);grid-template-rows:46px 46px;justify-content:start;}");
  });

  it("走格判定与划动转弯零触碰:CELL 常量、swipeDir、touch-action 原样", () => {
    expect(SRC).toContain("const CELL = 26;");
    expect(SRC).toContain("const SIZE = GRID * CELL;");
    expect(SRC).toContain("const d = swipeDir(e.clientX - swipeFrom.x, e.clientY - swipeFrom.y);");
    expect(SRC).toContain("touch-action: none;");
  });
});
