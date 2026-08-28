import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r43–r44 B 热区票", () => {
  it("N-189 .rbt-vs-btn 44，不改 vs-back 与隔离带", () => {
    const s = read("red-blue-tap/arena.ts");
    expect(s).toMatch(/\.rbt-vs-btn \{[^}]*min-height: \$\{TOUCH_MIN_PX\}px/);
    expect(s).toMatch(/\.rbt-vs-back, \.rbt-vs-mode \{[^}]*min-height: \$\{TOUCH_MIN_PX\}px/);
    expect(s).toContain("again.className = \"rbt-vs-btn\"");
  });

  it("N-190 .rte-btn 规则 44；本文件仍不挂 class，不改 open/back", () => {
    const s = read("red-blue-tap/index.ts");
    expect(s).toMatch(/\.rte-btn \{[^}]*min-height: 44px/);
    expect(s).not.toMatch(/className = ["']rte-btn/);
    expect(s).toMatch(/\.rte-open \{[^}]*min-height: 44px/);
    expect(s).toMatch(/\.rte-back \{[^}]*min-height: 44px/);
    expect(s).toContain('versusBtn.className = "rte-open"');
    expect(s).toContain('openBtn.className = "rte-open"');
  });

  it("N-192 .ba-lv 44，不改 ba-btn kit / 关卡表", () => {
    const s = read("bubble-aim/index.ts");
    expect(s).toMatch(/\.ba-lv \{[^}]*min-height: 44px/);
    expect(s).toContain('touchUpliftCss([".ba-btn", ".bba-mode", ".bba-swap"], { minWidth: true })');
  });

  it("N-193 .cs-lv 44，不改 cds-tap/mode 与 N-144 fk-ch", () => {
    expect(read("candy-swing/index.ts")).toMatch(/\.cs-lv \{[^}]*min-height: 44px/);
    expect(read("candy-swing/index.ts")).toContain(".cds-tap { min-height: 44px; min-width: 44px;");
    expect(read("fight-king/index.ts")).toMatch(/\.fk-ch\{[^}]*min-height:44px/s);
  });

  it("不回退 N-186 与果盆中间档；N-105 禁第四版", () => {
    expect(read("memory-cards/index.ts")).toMatch(/\.mmc-open \{[^}]*min-height: 44px/);
    expect(read("fruit-stack/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("mahjong-bloom/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });
});
