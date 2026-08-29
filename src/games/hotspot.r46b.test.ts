import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r46 B · 只做 N-199 .bl-btn", () => {
  it("N-199 HUD 钮 44 + 居中，不改 .bl-pick / 投球", () => {
    const s = read("bowling-lane/index.ts");
    expect(s).toMatch(/\.bl-btn\{[^}]*min-height:44px/s);
    expect(s).toMatch(/\.bl-btn\{[^}]*display:inline-flex/s);
    expect(s).toContain(
      ".bl-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;",
    );
    expect(s).toMatch(/\.bl-roll\{[^}]*min-height:44px/s);
  });

  it("不碰 .l99-*；N-195 返回仍 44；toggle 仍 N-134", () => {
    const l99 = read("level99.ts");
    // 回填 1.3:A 侧 N-196/N-198 已把壳层 CTA 抬到 44,本闸跟着守 44 而不是守「没动过」
    expect(l99).toMatch(/\.l99-continue\{[^}]*min-height:44px/s);
    const shr = read("shoot-range/index.ts");
    expect(shr).toMatch(/\.shr-back\{[^}]*min-height:44px/s);
    expect(shr).toContain(".shr-toggle{border:none;border-radius:999px;min-height:44px");
  });

  it("N-105 禁第四版；不回退中间档", () => {
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("fruit-stack/index.ts")).toContain("@media (max-height:820px) and (pointer:coarse)");
  });
});
