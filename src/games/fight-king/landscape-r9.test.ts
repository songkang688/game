/**
 * r9 tester-B · N-25 格斗塔矮横屏折叠出战格 + N-31 训练场键排 sticky / 教学面板限高。
 * FIGHT_MIN_H 与 stageMaxWidthPx 下限语义零触碰。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FIGHT_MIN_H, shortLandscape } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-25/N-31 fight-king 矮屏布局", () => {
  it("shortLandscape 只认矮横屏:915×412 是,390×844 / 1024×768 不是", () => {
    expect(shortLandscape(915, 412)).toBe(true);
    expect(shortLandscape(390, 844)).toBe(false);
    expect(shortLandscape(412, 915)).toBe(false);
    expect(shortLandscape(1024, 768)).toBe(false);
    expect(shortLandscape(Number.NaN, 412)).toBe(false);
  });

  it("FIGHT_MIN_H 仍是 150,下限语义不改", () => {
    expect(FIGHT_MIN_H).toBe(150);
  });

  it("触屏键排 sticky 置底,矮横屏双栏把键排挪到画布右侧", () => {
    expect(src).toMatch(/\.fk-pads\{[^}]*position:sticky/);
    expect(src).toContain(".fk-fight-row");
    expect(src).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)/);
    expect(src).toMatch(/\.fk-fight-row\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  });

  it("塔模式出战八宫格矮屏折叠,训练场帧数表单独限高自滚,假人钮挂顶栏", () => {
    expect(src).toContain("fk-hero-compact");
    expect(src).toContain("当前出战：");
    expect(src).toMatch(/\.fk-train-panel \.fk-scroll\{max-height:/);
    expect(src).toContain("bar.appendChild(modeRow)");
  });
});
