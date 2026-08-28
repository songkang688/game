/**
 * C-6 补笔(trio-r15):推理关 121 在 915×412 + root 下 D-pad 须进屏。
 * 双栏 CSS 不够：sticky 钉在自滚 .game-stage 里。本档锁舞台 + as-land。
 * isDeduceLevel / seed / 判定零触碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDeduceLevel, LEVELS } from "./levels";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("C-6 r15 · root×121 先灭舞台自滚", () => {
  it("进度 Array(121).fill(1) 后继续仍是推理关", () => {
    expect(isDeduceLevel(121)).toBe(true);
    expect(LEVELS[121]?.mode).toBe("deduce");
  });

  it("矮横屏挂 as-land，D-pad 在右栏底而不是 sticky", () => {
    expect(SRC).toContain(".as-wrap.as-land");
    expect(SRC).toContain(".as-wrap.as-land>.as-pads{grid-column:2;margin:0;position:absolute;right:0;bottom:0");
    expect(SRC).toContain(".as-wrap.as-land>.als-tools{grid-column:2;position:absolute");
    const land = SRC.slice(SRC.indexOf(".as-wrap.as-land{"));
    expect(land).toContain("overflow:hidden");
    expect(land).toContain("max-height:100%");
    expect(SRC).not.toMatch(/\.as-wrap>style\{display:none/);
    expect(SRC).toContain(".as-wrap.as-land>style{grid-column:1/-1;height:0");
  });

  it("画布钳高给 root 抬头让位（148 > 旧 72）", () => {
    expect(SRC).toContain("wrap.style.maxHeight");
    expect(SRC).toContain("vh - Math.max(0, top) - 4");
  });
});
