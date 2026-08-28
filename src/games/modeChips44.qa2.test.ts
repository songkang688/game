/**
 * QA #2(ux99 wave1):入口模式按钮热区 ≥44px 补账。
 * 冒烟量出 390×844 / 915×412 下这四款的模式选择按钮只有 32–37px 高,
 * 与 N-47(仓鼠/地鼠芯片 44px)同类伤,统一在基础规则里补 min-height:44px。
 * 三款已修主体(保龄/王子/坦克)与 kit 的 40px 底线不动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function ruleHasMin44(css: string, selector: string): void {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[^}]*min-height:\\s*44px`);
  expect(css, `${selector} 应有 min-height:44px`).toMatch(re);
}

describe("QA2 · 模式选择按钮 44px 热区", () => {
  it("bumper-cars 三个模式钮与难度挑选钮", () => {
    const s = src("./bumper-cars/index.ts");
    ruleHasMin44(s, ".bc-open");
    ruleHasMin44(s, ".bc-pick");
  });

  it("fruit-catch 双人/无尽入口与回地图", () => {
    const s = src("./fruit-catch/index.ts");
    ruleHasMin44(s, ".frc-open");
    ruleHasMin44(s, ".frc-back");
  });

  it("memory-cards 无尽/双人入口与辅助开关", () => {
    const s = src("./memory-cards/index.ts");
    ruleHasMin44(s, ".mmc-open");
    ruleHasMin44(s, ".mmc-toggle");
  });

  it("sky-squad 三个模式钮", () => {
    ruleHasMin44(src("./sky-squad/index.ts"), ".sks-mode");
  });
});
