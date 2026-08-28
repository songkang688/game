/** N-102:bumper-cars 915 画布 140×140 过小 + 1024 刹车排切 17——双垫钉角+实测缺口回收 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-102 bumper-cars 场地尺寸与键排", () => {
  it("矮横屏双垫 fixed 钉视口两下角(sticky 只会压住场地,禁回退)", () => {
    const block = SRC.split("@media (max-height:500px) and (min-width:640px)")[1] ?? "";
    expect(block).toContain(".bc-tip,.bpc-legend{display:none;}");
    expect(block).toContain(".bc-pads{display:contents;}");
    expect(block).toContain(".bc-padwrap{position:fixed;bottom:10px;");
    expect(block).toContain(".bc-padwrap:first-child{left:10px;right:auto;}");
    expect(block).toContain(".bc-padwrap:last-child{left:auto;right:10px;}");
  });

  it("layout() 感知双垫 fixed 后不再按 118 预算扣场地,且铺完量缺口二次收", () => {
    expect(SRC).toContain("padsFixed ? 52 : 118");
    expect(SRC).toContain("const over = Math.ceil(wrap.getBoundingClientRect().bottom + 6 - clipB);");
    expect(SRC).toContain("extraCut = over;");
  });
});
