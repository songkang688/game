/**
 * W8R1-10 · 拔河键帽提示字号的钉子（窗口 8 第 1 轮监督修复员）。
 *
 * A 档报告（建议级）：`.rbg-sub` 键帽提示 12px 太小（按钮本体热区/主字号达标）。
 * 修法：基础副标签与键帽提示都提到 14px；按钮盒子、热区、三处「按住 K」文本零改动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("W8R1-10 · 键帽提示 ≥14px", () => {
  it(".rbg-sub 基础字号与 .rbg-pull 键帽字号都不小于 14px", () => {
    const base = SRC.match(/\.rbg-sub \{ font-size: (\d+)px/);
    expect(base).not.toBeNull();
    expect(Number(base![1])).toBeGreaterThanOrEqual(14);
    const chip = SRC.match(/\.rbg-pull \.rbg-sub \{[^}]*font-size: (\d+)px/);
    expect(chip).not.toBeNull();
    expect(Number(chip![1])).toBeGreaterThanOrEqual(14);
  });

  it("按钮尺寸规则与键帽文本原样（只动字号）", () => {
    expect(SRC).toContain("btn.style.width = `${layout.width}px`;");
    expect(SRC).toContain("btn.style.height = `${layout.height}px`;");
    expect((SRC.match(/星星[^\n]{0,40}按住 K/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
