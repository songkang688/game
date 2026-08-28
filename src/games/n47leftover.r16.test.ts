/**
 * N-47 漏网（trio-r16 A）：r13/r14 已抬 shoot/alien/ak/mn；
 * r15 仍记 alien 无尽/双人与仓鼠撤销/重来/提示 40。三款主体（保龄/王子/坦克）勿重写。
 * kit `touchUpliftCss` 40 行保留，后盖 44。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bhVisualCss } from "./box-hamster/visual";

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function lastMinHeight(css: string, selector: string): number {
  const re = new RegExp(
    `${selector.replace(".", "\\.")}(?:,[^{.\n]+)?\\{[^}]*min-height:\\s*(\\d+)px`,
    "g"
  );
  const all = [...css.matchAll(re)];
  expect(all.length, `${selector} 应写 min-height`).toBeGreaterThan(0);
  return Number(all.at(-1)![1]);
}

function ruleHasMin44(css: string, selector: string): void {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\{[\\s\\S]*?min-height:44px`);
  expect(css, `${selector} 应 44`).toMatch(re);
}

describe("N-47 漏网芯片 ≥44（三款主体不改写）", () => {
  it("box-hamster 撤销/重来/提示 .bh-btn 与模式 .bh-mode 后盖 44", () => {
    const css = bhVisualCss();
    expect(css).toMatch(/\.bh-mode,\.bh-btn\{min-height:40px;\}/);
    expect(css).toMatch(/\.bh-mode,\.bh-btn\{min-height:44px;\}/);
    expect(lastMinHeight(css, ".bh-btn")).toBeGreaterThanOrEqual(44);
    expect(lastMinHeight(css, ".bh-mode")).toBeGreaterThanOrEqual(44);
  });

  it("mole-pop 菜单 .mp-open 后盖 44，kit 40 字面量仍在", () => {
    const s = src("./mole-pop/index.ts");
    expect(s).toContain(".mp-open, .mp-back { min-height: 40px; }");
    expect(s).toContain(".mp-open, .mp-back { min-height: 44px; }");
  });

  it("alien-seek .as-open 仍盖过 kit 40", () => {
    expect(src("./alien-seek/index.ts")).toMatch(/\.as-open,\.as-back\{min-height:44px;\}/);
  });

  it("保龄/王子/坦克菜单高度钉子不回退", () => {
    ruleHasMin44(src("./bowling-lane/index.ts"), ".bl-open");
    ruleHasMin44(src("./prince-princess/index.ts"), ".pcp-mode");
    ruleHasMin44(src("./tank-battle/index.ts"), ".tkb-open");
  });
});
