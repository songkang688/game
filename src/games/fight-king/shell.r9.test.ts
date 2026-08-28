/**
 * 三人组 r9 · N-25 格斗塔壳折叠 + N-31 训练场滚动边界。
 * FIGHT_MIN_H / stageMaxWidthPx 既有用例零改动,本文件只钉壳层。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIGHT_MIN_H } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-25 fight-king 塔壳 showTower", () => {
  it("出战八宫格有矮屏/窄屏折叠规则,展开才显示全宫格", () => {
    expect(src).toContain("fk-tower-hero");
    expect(src).toContain("fk-tower-compact");
    expect(src).toContain("当前出战：");
    expect(src).toContain("换人 ▾");
    expect(src).toMatch(/@media \(max-height:640px\),\(max-width:430px\)/);
    expect(src).toContain(".fk-tower-hero:not(.fk-tower-open) .fk-grid");
  });

  it("折叠只挂在 showTower 的 heroRow,不碰人机/双人/无尽壳", () => {
    expect(src).toContain('const heroRow = el("div", "fk-card fk-tower-hero")');
    const fight = src.slice(src.indexOf("function createFight"), src.indexOf("function showTower"));
    expect(fight).not.toContain("fk-tower-hero");
  });
});

describe("N-31 fight-king 训练场触屏键排", () => {
  it("训练壳把键排放到教学表后面,教学表自滚、键排 sticky", () => {
    expect(src).toContain("fk-train-shell");
    expect(src).toContain(".fk-train-shell .fk-scroll{max-height:");
    expect(src).toContain("position:sticky;bottom:0");
    expect(src).toContain("position:sticky;top:0");
    expect(src).toContain("wrap.appendChild(trainPanel);");
    expect(src).toContain("wrap.appendChild(pads);");
    expect(src.indexOf("wrap.appendChild(trainPanel);")).toBeLessThan(src.lastIndexOf("wrap.appendChild(pads);"));
  });

  it("FIGHT_MIN_H 与帧数表选择器零触碰", () => {
    expect(FIGHT_MIN_H).toBe(150);
    expect(src).toContain(".fk-fd{");
  });
});
