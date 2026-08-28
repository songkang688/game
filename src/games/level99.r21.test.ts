/**
 * trio-r21 P0：N-117 页签徽章收纳、N-118 去掉 136px 盲区钳高、N-120 触摸滚动。
 * 不回退 N-63 内部滚 / N-39 聚焦 / window6「.l99-tabs 不许 overflow-x:auto」。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapColumns } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-117 章节页签徽章收纳", () => {
  it("非当前章只挂 emoji 节点，当前章才挂章名", () => {
    expect(SRC).toContain('emojiEl.className = "l99-tab-emoji"');
    expect(SRC).toContain('nameEl.className = "l99-tab-name"');
    expect(SRC).toMatch(/if \(on\) \{[\s\S]*?nameEl\.className = "l99-tab-name"/);
    expect(SRC).not.toMatch(/tab\.textContent = `\$\{ch\.emoji\} \$\{ch\.name\}/);
  });

  it("锁标是独立 .l99-tab-lockmark，给 rootUnlock 摘除", () => {
    expect(SRC).toContain('lockEl.className = "l99-tab-lockmark"');
    expect(SRC).toContain('lockEl.textContent = "🔒"');
  });

  it("页签条仍 flex-wrap:wrap，不用 overflow-x:auto", () => {
    expect(SRC).toMatch(/\.l99-tabs\{[^}]*flex-wrap:wrap/);
    expect(SRC).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:auto/);
  });

  it("非当前章页签收成约 36×44 徽章，避免 8 章堆成两行", () => {
    expect(SRC).toMatch(/\.l99-tab:not\(\.l99-tab-on\)\{width:36px/);
    expect(SRC).toMatch(/\.l99-tab\{[^}]*min-height:44px/);
  });
});

describe("N-118 地图密度与 136px 盲区", () => {
  it("矮屏不再用 100dvh-136px 硬钳 .l99-wrap", () => {
    expect(SRC).not.toMatch(/100dvh\s*-\s*136px/);
    expect(SRC).not.toContain(".l99-wrap{max-height:");
  });

  it("列数按地图容器宽 mapLayoutWidth，不按 innerWidth", () => {
    expect(SRC).toContain("function mapLayoutWidth()");
    expect(SRC).toContain("mapColumns(mapLayoutWidth())");
    expect(SRC).not.toMatch(/mapColumns\(viewportWidth\(\)\)/);
  });

  it("mapColumns 断点数值不回退", () => {
    expect(mapColumns(320)).toBe(4);
    expect(mapColumns(390)).toBe(5);
    expect(mapColumns(560)).toBe(6);
    expect(mapColumns(760)).toBe(7);
    expect(mapColumns(761)).toBe(8);
  });
});

describe("N-120 触摸滚动", () => {
  it(".l99-view 声明 pan-y + contain，不抢 N-63 内部滚", () => {
    expect(SRC).toMatch(/\.l99-view\{[^}]*touch-action:pan-y/);
    expect(SRC).toMatch(/\.l99-view\{[^}]*overscroll-behavior:contain/);
    expect(SRC).toContain("game-stage--l99");
    expect(SRC).toContain("overflow-y:hidden");
  });
});
