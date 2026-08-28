import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * N-55(r18 收口):915×412 双人对战第二排六键 top 382 bottom 428,切 16px。
 * 修法只压铺垫:双人档 wrap 钳高、牌名让位(左右家靠粉/蓝描边分辨)、
 * 键回 44 触区下限。回合/灯笼判定与 N-85 闯关垫零触碰。
 */
describe("N-55 snow-fight 双人十二键进 412", () => {
  it("双人档 wrap 单独钳高,牌名让位,键 44 下限", () => {
    expect(SRC).toContain(".snf-wrap:has(.snf-pads[data-duo]){max-height:calc(100dvh - 128px);}");
    expect(SRC).toContain(".snf-pads[data-duo] .snf-pad-t{display:none;}");
    expect(SRC).toContain("min-height:44px;min-width:44px;");
  });

  it("N-85 闯关垫与 data-duo 并排规则不回退", () => {
    expect(SRC).toContain("opts.humans === 1 ? 118 : 0");
    expect(SRC).toContain(".snf-pads[data-duo]{display:grid;grid-template-columns:1fr 1fr");
    expect(SRC).toContain(".snf-pads{position:sticky;bottom:0");
  });
});
