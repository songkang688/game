/**
 * 花园国际象棋 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-4（一般 · r1 5-4 修复不彻底的尾巴②）：A 档 5-4 点名过「各款 pick 按钮」，
 * fs/ps/jq 的在 r1 已提级，本款 `.cg-pick` 13.5px 与结算正文 `.cg-over-s` 13.5px 漏网。
 * 修法：两类统一提到 ≥14px（同 5-4 口径）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** 局外屏（模式菜单 / 结算）的 SHELL_CSS 没导出，直接读源码量 */
const SHELL_SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("chess-garden · 局外屏字号 ≥14px（r2-4，r1 5-4 尾巴②）", () => {
  it("cg-pick / cg-over-s 的每条规则字号都 ≥14", () => {
    for (const cls of ["cg-pick", "cg-over-s"]) {
      const rules = [...SHELL_SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});
