import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIGHT_MIN_H } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-57 fight-king 训练场选人壳开打钉底", () => {
  it("选人卡挂 fk-select-shell，开打行 sticky，假人钮 min-height 44", () => {
    expect(src).toContain('el("div", "fk-card fk-select-shell")');
    expect(src).toContain("fk-bar-go");
    expect(src).toContain(".fk-select-shell .fk-bar-go{");
    expect(src).toContain("position:sticky;bottom:0");
    expect(src).toMatch(/\.fk-btn\{[^}]*min-height:44px/);
  });

  it("关内训练壳键排与 FIGHT_MIN_H 零回退", () => {
    expect(FIGHT_MIN_H).toBe(150);
    expect(src).toContain(".fk-train-shell .fk-pads{");
    expect(src).toContain("wrap.appendChild(trainPanel);");
    expect(src).toContain("wrap.appendChild(pads);");
  });
});
