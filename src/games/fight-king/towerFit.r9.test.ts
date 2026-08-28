/**
 * N-25 / N-31 · 三人组第 9 轮：格斗塔矮屏折叠出战八宫格 + 训练场键排 sticky。
 * FIGHT_MIN_H / stageMaxWidthPx 既有用例零改动；本文件只加断言。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIGHT_MIN_H, towerRosterCompact } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-25 格斗塔出战八宫格矮屏折叠", () => {
  it("915×412 与 390×844 收成一行，1024×768 / 1280×800 / 无尽常用宽屏不收", () => {
    expect(towerRosterCompact(915, 412)).toBe(true);
    expect(towerRosterCompact(390, 844)).toBe(true);
    expect(towerRosterCompact(360, 640)).toBe(true);
    expect(towerRosterCompact(1024, 768)).toBe(false);
    expect(towerRosterCompact(1280, 800)).toBe(false);
    expect(towerRosterCompact(412, 915)).toBe(false);
    expect(towerRosterCompact(Number.NaN, 412)).toBe(false);
  });

  it("塔壳有当前出战摘要 + 换人展开，不改 FIGHT_MIN_H", () => {
    expect(FIGHT_MIN_H).toBe(150);
    expect(src).toContain('el("div", "fk-card fk-hero-row")');
    expect(src).toContain("当前出战：");
    expect(src).toContain("换人 ▾");
    expect(src).toContain(".fk-hero-compact:not(.fk-hero-open) .fk-grid{display:none;}");
    expect(src).toContain("towerRosterCompact(w, h)");
    expect(src).toContain(".fk-tower-nav{display:none;}");
    expect(src).toContain("fk-layout-tower");
    expect(src).toContain("fk-short-chrome");
  });
});

describe("N-31 训练场触屏键排 + 假人行 sticky", () => {
  it("键排和假人行进 .fk-dock sticky 底，帧数表自己限高滚", () => {
    expect(src).toContain(".fk-dock{position:sticky;bottom:0;");
    expect(src).toContain('el("div", "fk-dock")');
    expect(src).toContain("dock.appendChild(modeRow)");
    expect(src).toContain("dock.appendChild(pads)");
    expect(src).toContain(".fk-layout-tower .fk-dock,.fk-layout-train .fk-dock{");
    expect(src).toContain("position:fixed;left:8px;right:8px;bottom:0;z-index:40;");
    expect(src).toContain(".fk-scroll{overflow-x:auto;max-height:min(36vh,280px);overflow-y:auto;");
    expect(src).toContain("@media (max-height:500px){.fk-scroll{max-height:22vh;}}");
  });

  it("训练场帧数表仍挂 .fk-scroll，判定常量零触碰", () => {
    expect(src).toContain('el("div", "fk-scroll")');
    expect(src).toContain("scroll.appendChild(frameTable");
    expect(src).toMatch(/minH = FIGHT_MIN_H/);
  });
});
