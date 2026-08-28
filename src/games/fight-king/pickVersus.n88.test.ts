/** 三人组 r16 · N-88 双人对战选人「开打」（≠ N-57 训练场选人壳） */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-88 fight-king 双人对战选人开打", () => {
  it("versus 选人卡把开打并进返回行,矮屏 sticky", () => {
    expect(SRC).toContain("fk-card fk-pick-versus");
    expect(SRC).toContain('bar.classList.add("fk-versus-go")');
    expect(SRC).toContain(".fk-pick-versus .fk-versus-go{");
    expect(SRC).toContain("mode !== \"training\" && mode !== \"versus\"");
    const versusCss = SRC.slice(
      SRC.indexOf("/* N-88"),
      SRC.indexOf(".fk-bar{display:flex")
    );
    expect(versusCss).toContain("position:sticky;top:0");
    expect(versusCss).toContain(".fk-pick-versus .fk-info{");
  });

  it("训练场选人壳与关内键排原样保留", () => {
    expect(SRC).toContain("fk-card fk-pick-train");
    expect(SRC).toContain("fk-bar fk-dummy-go");
    expect(SRC).toContain(".fk-pick-train .fk-dummy-go{");
    expect(SRC).toContain(".fk-train-shell .fk-scroll{max-height:");
    expect(SRC).toContain(".fk-train-shell .fk-pads{");
    expect(SRC).toContain("bar.appendChild(modeRow)");
  });
});
