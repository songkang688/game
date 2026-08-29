import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");
const styles = readFileSync(join(games, "../styles.css"), "utf8");

describe("r31–r34 B 热区票", () => {
  it("N-153 sky-squad 单人 --k 与 .sks-key 都不小于 44", () => {
    const s = read("sky-squad/index.ts");
    for (const hit of s.matchAll(/--k:\s*(\d+)px/g)) {
      expect(Number(hit[1]), `sky-squad --k=${hit[1]}`).toBeGreaterThanOrEqual(44);
    }
    expect(s).toMatch(/\.sks-key\{[^}]*min-height:44px/);
    expect(s).toContain("canvasBoxHeight");
  });

  it("N-154 王子双人 --k≥44、三列、N-79 画布钳与 .pcp-key 44 不回退", () => {
    const s = read("prince-princess/index.ts");
    const css = s.slice(s.indexOf("export const CSS"));
    for (const hit of css.matchAll(/--k:\s*(\d+)px/g)) {
      expect(Number(hit[1]), `prince --k=${hit[1]}`).toBeGreaterThanOrEqual(44);
    }
    expect(s).toContain('.pcp-pads[data-players="2"]{--k:44px;--cols:3;}');
    expect(s).toContain("grid-template-columns:repeat(var(--cols),var(--k))");
    expect(s).toMatch(/\.pcp-key\{[^}]*min-height:44px/s);
    expect(s).toContain('.pcp-wrap[data-players="2"] .pcp-cv{height:118px;}');
    expect(s).toContain(".pcp-pads{position:sticky;bottom:0");
  });

  it("N-156 仓鼠矮屏格子 44，N-80 钉底不回退", () => {
    const s = read("box-hamster/index.ts");
    expect(s).toMatch(/grid-auto-rows:44px/);
    expect(s).not.toMatch(/grid-auto-rows:40px/);
    expect(s).toMatch(/\.bh-key\{[^}]*min-height:44px/s);
    expect(s).toContain(".bh-pad{position:sticky;bottom:0");
  });

  it("N-157 钓鱼收线全媒体 TOUCH_MIN，对战结算钮 44", () => {
    const fs = read("fishing-star/index.ts");
    expect(fs).toMatch(/\.fs-act\{[^}]*min-height:\$\{TOUCH_MIN_PX\}px/s);
    expect(fs).toContain(".fs-back{");
    const dvs = read("duo-vs-star/index.ts");
    expect(dvs).toMatch(/\.dvs-over button\{[^}]*min-height:44px/s);
    expect(dvs).toContain(".dvs-pad button{min-width:42px;min-height:42px");
  });

  it("N-159 字园花钮 44，不改描红画板", () => {
    const t = read("word-garden/tracing.ts");
    expect(t).toMatch(/\.wgd-garden-flower\{[^}]*width:44px;height:44px/);
    expect(t).not.toMatch(/\.wgd-garden-flower\{[^}]*width:34px/);
    expect(t).toContain(".wgd-pad{");
  });

  it("N-160 涂色缩略图 44，clf-tight 工具热区原文", () => {
    const ui = read("color-fun/ui.ts");
    expect(ui).toMatch(/\.clf-work\{[^}]*min-height:44px/s);
    expect(ui).toContain("**热区一个都不动**：.clf-tool / .clf-swatch / .clf-primary / .clf-zoom 的 44px");
  });

  it("N-162 / N-163 summary 折叠标题 44", () => {
    expect(read("orb-arena/index.ts")).toMatch(/\.oa-board summary\{[^}]*min-height:44px/);
    expect(read("snake-royale/index.ts")).toMatch(/\.sr-board summary\{[^}]*min-height:44px/);
    expect(read("orb-arena/index.ts")).toMatch(/\.oa-back\{[^}]*min-height:44px/);
    expect(styles).toMatch(/\.cg-log-sum \{[^}]*min-height: 44px/s);
    expect(styles).toContain(".cg-wrap .cg-log-sum {\n  min-height: 44px;\n}");
  });
});
