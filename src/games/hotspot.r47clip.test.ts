import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r47 B 抽验 · 大厅/设置开始钮 820", () => {
  it("三款加 820，既有档原文仍在", () => {
    const dvs = read("duo-vs-star/index.ts");
    expect(dvs).toContain("@media (max-height:520px) and (orientation:landscape){");
    expect(dvs).toContain(
      ".dvs-go{display:block;width:100%;margin-top:12px;border:none;border-radius:18px;padding:13px;font-size:17px;",
    );
    expect(dvs).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(dvs).toContain(".dvs-go{position:sticky;bottom:0;z-index:5;");

    const bvp = read("brave-path/index.ts");
    expect(bvp).toContain("@media (max-height:520px){");
    expect(bvp).toContain(".bvp-endless-fight .bvp-acts{");
    expect(read("brave-path/lobbyFit.ts")).toContain("@media (max-height:500px){");
    expect(bvp).toContain("wrap.className = \"bvp-arena-setup\"");
    expect(bvp).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(bvp).toContain(".bvp-arena-setup .bvp-bar{order:-1;position:sticky;top:0;z-index:5;");

    const tug = read("red-blue-tug/index.ts");
    expect(tug).toContain(".rbg-picks { display: flex; flex-direction: column; gap: 8px; }");
    expect(tug).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(tug).toContain(".rbg-picks{max-height:calc(100dvh - 108px);overflow:auto;display:grid;");
  });

  it("不回退开擂/围子/音砖；不改 oa-back/钓鱼 fs-back 口径；不改 l99；N-105 禁第四版", () => {
    expect(read("duo-arena/index.ts")).toContain(
      "@media (max-height:820px) and (min-width:640px) and (pointer:coarse)",
    );
    expect(read("weiqi-garden/index.ts")).toContain(".wq-setup .wq-open{position:sticky;bottom:0;z-index:5;}");
    expect(read("tap-tiles/index.ts")).toContain(".tt-over .tt-open{position:sticky;bottom:0;z-index:5;}");
    expect(read("orb-arena/index.ts")).toMatch(/\.oa-back\{[^}]*min-height:44px/s);
    expect(read("fishing-star/index.ts")).toMatch(/\.fs-back\{[^}]*min-height:44px/s);
    // 回填 1.3:A 侧 N-196/N-198 已把壳层 CTA 抬到 44,本闸跟着守 44
    expect(read("level99.ts")).toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
