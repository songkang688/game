/**
 * N-47 残留(trio-r15 A):仓鼠撤销/重来/提示仍吃 kit 40。
 * 只抬 .bh-btn/.bh-mode;N-16 顺手 .l99-back。禁重写 corridorFit。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("N-47 r15 残留芯片 ≥44", () => {
  it("box-hamster .bh-btn/.bh-mode 盖过 kit 40", () => {
    const src = readFileSync(new URL("./box-hamster/index.ts", import.meta.url), "utf8");
    expect(src).toMatch(/\.bh-btn,\.bh-mode\{min-height:44px;\}/);
  });

  it("alien-seek .as-open 仍 44(r13 已合,本轮回归)", () => {
    const src = readFileSync(new URL("./alien-seek/index.ts", import.meta.url), "utf8");
    expect(src).toMatch(/\.as-open,\.as-back\{min-height:44px;\}/);
  });

  it("N-16 只抬 .l99-back,corridorFit 公式未重写", () => {
    const l99 = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");
    const fit = readFileSync(new URL("./adventure-king/corridorFit.ts", import.meta.url), "utf8");
    expect(l99).toMatch(/\.l99-back\{[^}]*min-height:44px/);
    expect(fit).toContain("export function corridorWantH");
    expect(fit).toContain("export function corridorCanvasCssH");
  });
});
