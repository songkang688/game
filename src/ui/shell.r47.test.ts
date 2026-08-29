/**
 * trio-r47 A：390×844 走查壳层。
 * N-201 首页页签横滑（祖先 touch-action 交集）+ .btn 不被分组 44 压扁。
 * 不改 .l99-tabs overflow-x、mapColumns、dialogs 点击守卫。不抢 B 游戏文件。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("../games/level99.ts", import.meta.url)), "utf8");

describe("N-201 首页分类页签横滑", () => {
  it("home-screen 放行 pan-x，不把 .tabs 的 overflow-x:auto 卡死", () => {
    expect(STYLES).toMatch(/\.home-screen\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(STYLES).toMatch(/\.tabs\s*\{[^}]*overflow-x:\s*auto/);
    expect(L99).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:\s*auto/);
  });
});

describe("N-201 .btn 不被分组 44 压扁", () => {
  it("分组地板 44 之后仍有 .btn min-height 58（暂停列）", () => {
    expect(STYLES).toMatch(
      /\.btn,\s*\.icon-btn[\s\S]*?min-height:\s*44px[\s\S]*?^\/\* N-201[\s\S]*?^\.btn \{\n  min-height: 58px;/m,
    );
  });

  it("不回退壳层五钮与 CTA / 平板 760", () => {
    expect(L99).toMatch(/\.l99-continue\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-back\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-view\{[^}]*touch-action:pan-y/);
    expect(L99).toMatch(
      /@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/,
    );
  });
});
