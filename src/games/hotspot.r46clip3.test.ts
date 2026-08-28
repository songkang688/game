import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r46 B 抽验二 · 五子棋/象棋/小鸟 820 CTA", () => {
  it("三款加 820，既有 500/840 原文仍在", () => {
    const gmk = read("gomoku/view.ts");
    expect(gmk).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(gmk).toContain(".gmk-wrap{max-width:248px;}");
    expect(gmk).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    const xq = read("xiangqi/view.ts");
    expect(xq).toContain("@media (min-width:700px) and (max-height:840px)");
    expect(xq).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(xq).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(read("sling-birds/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
  });

  it("不回退砖塔/数独/怪物；不改 level99；N-105 禁第四版", () => {
    expect(read("brick-break/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(read("sudoku-petal/index.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("monster-crisis/index.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("level99.ts")).not.toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
