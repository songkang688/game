/**
 * r16 A 余力：壳层 HUD 芯片 36→44；收藏册星星余额芯片补 44。
 * N-59 页签/知道啦/关闭钮口径不回退。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const COL = readFileSync(fileURLToPath(new URL("./collection.ts", import.meta.url)), "utf8");

describe("r16 壳层/收藏小热区", () => {
  it(".shell-hud-chip min-height ≥44", () => {
    const m = /\.shell-hud-chip\s*\{[^}]*min-height:\s*(\d+)px/.exec(STYLES);
    expect(m, ".shell-hud-chip 应写 min-height").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("收藏册 .collection-stars 余额芯片 ≥44；页签/知道啦/关闭不回退", () => {
    expect(COL).toMatch(/\.collection-stars\{[^}]*min-height:44px/);
    expect(COL).toMatch(/\.collection-tab\{[^}]*min-height:44px/);
    expect(COL).toMatch(/\.collection-done\{[^}]*min-height:44px/);
    expect(COL).toMatch(/\.collection-close\{[^}]*width:44px/);
    expect(COL).toMatch(/\.collection-close\{[^}]*height:44px/);
  });
});
