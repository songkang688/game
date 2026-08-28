/** 三人组 r9 · N-32 无尽地牢战斗三钮 sticky,闯关 l99 不加类 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-32 brave-path 无尽战斗操作行", () => {
  it("有逃跑钮的战斗才挂 bvp-endless-fight,操作行 sticky bottom", () => {
    expect(src).toContain('if (opts.onFlee) wrap.className = "bvp-endless-fight"');
    expect(src).toContain(".bvp-endless-fight .bvp-acts{");
    expect(src).toContain("position:sticky;bottom:0");
  });

  it("备战小屋长列表选择器未改成 sticky", () => {
    expect(src).not.toMatch(/\.bvp-opts\{[^}]*position:sticky/);
  });
});
