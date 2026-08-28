/** N-103:ice-fire-forest L1 画布切 59 / root×188 切 103——预算铺完量实测缺口二次收 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-103 ice-fire-forest 画布实测缺口回收", () => {
  it("layout() 铺完后量画布底对舞台可视底的缺口,超了按缺口重排一次", () => {
    expect(SRC).toContain("function stageVisibleBottom()");
    expect(SRC).toContain("const over = Math.ceil(rect.bottom + 6 - clip);");
    expect(SRC).toContain("if (over > 0 && viewH - over >= 96) applyLayout(viewH - over);");
  });

  it("boardHeightBudget 预算模型原样保留(守门在 logic.test.ts,禁改常量)", () => {
    expect(SRC).toContain("applyLayout(boardHeightBudget(window.innerWidth || 375, window.innerHeight || 667));");
  });

  it("矮横屏双垫 fixed 钉视口右下(.l99-stage 裁切链内 sticky/流内排布必被裁,禁回退)", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:640px)")[1] ?? "";
    expect(block).toContain(".iff-pads{position:fixed;right:10px;bottom:10px;z-index:5;");
  });
});
