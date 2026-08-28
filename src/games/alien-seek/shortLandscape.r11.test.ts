/**
 * C-6 补笔(trio-r11):alien-seek 推理关在 915×412 上工具+D-pad 须进屏。
 * 矮宽横屏双栏只动壳层 CSS + syncSize 钳高；isDeduceLevel / seed / 判定零触碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDeduceLevel, LEVELS } from "./levels";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("C-6 推理关 121 · 915×412 双栏壳", () => {
  it("存档 Array(121).fill(1) 后继续的那一关是 isDeduceLevel（ch6 idx 2，下标 121）", () => {
    expect(isDeduceLevel(121)).toBe(true);
    expect(LEVELS[121]?.mode).toBe("deduce");
  });

  it("矮宽横屏双栏：画布左、线索/工具/D-pad 右栏（r15 不再靠 sticky）", () => {
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain("grid-template-columns:minmax(0,1fr) minmax(220px,36%)");
    expect(SRC).toContain(".as-wrap>.as-clues{grid-column:2");
    expect(SRC).toContain(".as-wrap.as-land>.as-pads{grid-column:2");
    expect(SRC).toContain(".game-stage:has(.as-wrap){overflow-y:hidden;}");
  });

  it("syncSize 矮宽横屏钳画布高，不按整台宽度 × 0.64", () => {
    expect(SRC).toContain("canvas.clientWidth");
    expect(SRC).toContain("vh <= 500 && vw >= 640");
    expect(SRC).toContain('wrap.classList.add("as-land")');
    expect(SRC).toContain("vh - 148");
  });

  it("工具与方向键热区仍 ≥44（不靠收热区塞进屏）", () => {
    expect(SRC).toMatch(/\.als-tool\{[^}]*min-height:44px/);
    expect(SRC).toMatch(/\.as-btn\{[^}]*min-height:44px/);
  });
});
