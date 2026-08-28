import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-57 fight-king 训练场选人开打", () => {
  it("选人壳训练卡把假人钮与开打并排,矮屏 sticky,热区 44", () => {
    expect(SRC).toContain("fk-card fk-pick-train");
    expect(SRC).toContain("fk-bar fk-dummy-go");
    expect(SRC).toMatch(/\.fk-btn\{[^}]*min-height:44px/);
    expect(SRC).toContain(".fk-pick-train .fk-dummy-go{");
    expect(SRC).toContain("position:sticky;top:0");
  });

  it("不改关内 .fk-train-shell 键排规则", () => {
    expect(SRC).toContain(".fk-train-shell .fk-scroll{max-height:");
    expect(SRC).toContain(".fk-train-shell .fk-pads{");
    expect(SRC).toContain("bar.appendChild(modeRow)");
  });
});
