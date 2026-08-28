import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nodeCurFullyVisible } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-39 l99 进图/回地图聚焦当前关（配方 K）", () => {
  it("初次进图与三处回地图传 showMap(true)", () => {
    expect(SRC).toMatch(/showMap\(true\);\s*\n\s*return \{/);
    expect(SRC).toContain('onClick: () => showMap(true) }');
    expect(SRC).toContain('{ label: "🗺️ 回地图", ghost: true, onClick: () => showMap(true) }');
    expect(SRC).toMatch(/api\.play\("tap"\);\s*showMap\(true\);/);
    expect([...SRC.matchAll(/showMap\(true\)/g)].length).toBeGreaterThanOrEqual(6);
  });

  it("切章节页签仍 showMap() 默认 false，不误聚焦", () => {
    expect(SRC).toMatch(/viewChapter = ci;\s*showMap\(\);/);
    expect(SRC).not.toMatch(/viewChapter = ci;\s*showMap\(true\)/);
  });

  it("聚焦仍走现成 scrollIntoView({block:center})，零新机制", () => {
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain('grid.querySelector(".l99-node-cur")');
  });

  it(".l99-node-cur 整格在 915×412 视口内才算过（hop-pads 样本尺子）", () => {
    expect(nodeCurFullyVisible({ top: 426, bottom: 502 }, 412)).toBe(false);
    expect(nodeCurFullyVisible({ top: 168, bottom: 244 }, 412)).toBe(true);
    expect(nodeCurFullyVisible({ top: -8, bottom: 68 }, 412)).toBe(false);
    expect(nodeCurFullyVisible({ top: 340, bottom: 416 }, 412)).toBe(false);
  });
});
