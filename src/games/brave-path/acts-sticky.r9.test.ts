/**
 * r9 tester-B · N-32 无尽战斗三钮配方 E:操作行 sticky bottom。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-32 brave-path 无尽战斗操作行", () => {
  it(".bvp-acts sticky 置底,矮屏压战报高度", () => {
    expect(src).toMatch(/\.bvp-acts\{[^}]*position:sticky/);
    expect(src).toMatch(/\.bvp-acts\{[^}]*bottom:0/);
    expect(src).toMatch(/@media \(max-height:500px\)\{/);
    expect(src).toMatch(/\.bvp-log\{max-height:72px/);
  });

  it("攻击/防御/莓果仍走同一套 add() 渲染,不改判定", () => {
    expect(src).toContain('add("👊 攻击"');
    expect(src).toContain("kind: \"attack\"");
  });
});
