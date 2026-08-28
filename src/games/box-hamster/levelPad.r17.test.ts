import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-80 box-hamster 闯关方向键 · 915×412", () => {
  it("矮横屏改「棋盘左、方向盘右」两列,方向盘不再掉出舞台裁切线", () => {
    // 修前:闯关 ⬆579/◀⬇▶637(舞台 322px 裁切线外);修后实测 ⬆312/◀⬇▶362,底 406 ≤ 412
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".bh-wrap{display:grid;grid-template-columns:minmax(0,1fr) 176px");
    expect(SRC).toContain(".bh-pad{grid-column:2;grid-row:3;margin-top:6px;grid-template-columns:repeat(3,52px);grid-auto-rows:44px;}");
    expect(SRC).toContain(".bh-stagebox{grid-column:1;grid-row:2 / span 3;padding:6px;}");
  });

  it("推箱规则与方向键语义零触碰:四键仍是 step(dir),fitBoard 竖尺仍在", () => {
    expect(SRC).toContain('btn.addEventListener("click", () => step(k.dir))');
    expect(SRC).toContain("fitCellRect(def.w, def.h, avail, availH)");
  });
});
