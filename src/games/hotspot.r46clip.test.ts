import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r46 B 抽验 · 915×412 CTA 中间档", () => {
  it("砖塔 / 数独 / 怪物加 820，500 原文仍在", () => {
    expect(read("brick-break/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(read("brick-break/index.ts")).toMatch(/\.brk-canvas \{[^}]*max-height: calc\(100dvh - 168px\)/);
    const sp = read("sudoku-petal/index.ts");
    expect(sp).toContain("@media (max-height:500px){");
    expect(sp).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(sp).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(read("monster-crisis/index.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
  });

  it("不改 level99；N-105 禁第四版；果盆中间档不回退", () => {
    // 回填 1.3:A 侧 N-196/N-198 已把壳层 CTA 抬到 44,本闸跟着守 44
    expect(read("level99.ts")).toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("fruit-stack/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
  });
});
