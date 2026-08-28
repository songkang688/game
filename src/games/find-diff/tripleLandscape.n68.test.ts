/**
 * N-68：find-diff 三图关矮横屏下图 play 格须进 915×412。
 * ≠ L-1 两图并排（第 1 关仍走 rowLayout = !triple）；≠ 镜像关。
 * 判定仍读 play 格 getBoundingClientRect；regrow 只放大。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { panelCellForRoomRow, panelsSideBySide, regrowCellPx, tripleLandscape } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("const CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("const CSS = `")));
const RUNTIME = readFileSync(new URL("./runtime.ts", import.meta.url), "utf8");

describe("N-68 三图侦探社 · 矮横屏可点区", () => {
  it("第 100 关（下标 99）是 triple；第 1 关不是", () => {
    expect(LEVELS[99]?.mode).toBe("triple");
    expect(LEVELS[0]?.mode).not.toBe("triple");
    expect(LEVELS[0]?.mode ?? "classic").toBe("classic");
  });

  it("tripleLandscape 只认真横屏，口径与 L-1 视口相同、布局开关分开", () => {
    expect(tripleLandscape(915, 412)).toBe(true);
    expect(panelsSideBySide(915, 412)).toBe(true);
    expect(tripleLandscape(390, 844)).toBe(false);
    expect(tripleLandscape(412, 915)).toBe(false);
    expect(SRC).toContain("const rowLayout = !triple && wideShort");
    expect(SRC).toContain("const tripleRow = triple && tripleLandscape");
  });

  it("三图矮横屏挂自己的类，不改 L-1 的 .fdf-panels-row 规则", () => {
    expect(CSS).toContain(".fdf-panels-triple.fdf-panels-row");
    expect(SRC).toContain('panelsEl.classList.add("fdf-panels-triple")');
    // 可点区在右侧吃满，参考图挤在 .fdf-row 里
    expect(CSS).toContain(".fdf-panels-triple .fdf-row{flex:0 1 auto;max-width:46%");
    expect(CSS).toContain(".fdf-panels-triple > .fdf-panel{flex:1 1 auto");
  });

  it("play 格走单图余量摊法：915 舞台余量 260 时 3 行 ≥26 且能进 412", () => {
    const px = panelCellForRoomRow(3, 260);
    expect(px).toBeGreaterThanOrEqual(26);
    expect(px * 3 + 40).toBeLessThan(412);
  });

  it("regrow 第六参 true 只放大；判定仍按 play 格盒子", () => {
    expect(regrowCellPx(26, 3, 412, 260, 44, true)).toBe(27);
    expect(regrowCellPx(40, 3, 412, 260, 44, true)).toBeNull();
    expect(RUNTIME).toContain("return grown > currentPx ? grown : null");
    const hit = SRC.slice(SRC.indexOf("function hitAt("), SRC.indexOf("const missTimes"));
    expect(hit).toContain("btn.getBoundingClientRect()");
    expect(hit).toContain("pickNearest(centers, clientX, clientY, radius)");
  });

  it("参考图仍用 miniCellPx，不把三图误并进 L-1 的 rowLayout", () => {
    expect(SRC).toContain("const miniPx = triple ? miniCellPx");
    expect(SRC).toMatch(/const rowLayout = !triple && wideShort/);
  });
});
