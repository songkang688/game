/**
 * N-39：l99 蓝本地图初次进图 / 回地图要聚焦当前关。
 * 切章节页签仍走 showMap()（看章头），那一处不许改成 true。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-39 蓝本地图聚焦当前关", () => {
  it("初次进图 showMap(true)，当前关会 scrollIntoView({block:\"center\"})", () => {
    expect(SRC).toMatch(/\n  showMap\(true\);\n\n  return \{/);
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain('grid.querySelector(".l99-node-cur")');
    expect(SRC).not.toMatch(/querySelector\("\.l99-node-cur"\)[\s\S]{0,80}instanceof HTMLElement/);
  });

  it("过关 / 失败 / 关内选关 三处回地图都传 true", () => {
    const wins = SRC.match(/label: "🗺️ 回地图", ghost: true, onClick: \(\) => showMap\((true)?\)/g) ?? [];
    expect(wins).toHaveLength(2);
    expect(wins.every((s) => s.includes("showMap(true)"))).toBe(true);
    expect(SRC).toMatch(/back\.textContent = "🗺️ 选关";[\s\S]*?showMap\(true\);/);
  });

  it("章节页签切章保持 showMap() 不聚焦", () => {
    expect(SRC).toMatch(/viewChapter = ci;\s*showMap\(\);/);
    expect(SRC).not.toMatch(/viewChapter = ci;\s*showMap\(true\);/);
  });
});
