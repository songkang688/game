import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r46 B 抽验三 · 开擂/围子/音砖 820 开始钮", () => {
  it("三款加 820，既有 500 原文仍在", () => {
    const dua = read("duo-arena/index.ts");
    expect(dua).toContain("@media (max-height:500px)");
    expect(dua).toContain(".dua-wrap{max-width:min(920px,100%);}");
    expect(dua).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    const wq = read("weiqi-garden/index.ts");
    expect(wq).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(wq).toContain(".wq-scroll{max-height:min(260px, calc(100dvh - 168px));}");
    expect(wq).toContain(".wq-setup .wq-open{position:sticky;bottom:0;z-index:5;}");
    const tt = read("tap-tiles/index.ts");
    expect(tt).toContain("@media (max-height:500px){");
    expect(tt).toContain(".tt-keys{display:none;}");
    expect(tt).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
  });

  it("不回退五子棋/象棋/小鸟；不改 level99；N-105 禁第四版", () => {
    expect(read("gomoku/view.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("xiangqi/view.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("sling-birds/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
    // 回填 1.3:A 侧 N-196/N-198 已把壳层 CTA 抬到 44,本闸跟着守 44
    expect(read("level99.ts")).toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
