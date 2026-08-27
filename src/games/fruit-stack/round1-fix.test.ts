/**
 * 合果盆栽 · 1.3 第 1 轮 C 档修复契约（对应 A 档 5-4 一般：HUD 小字 <14px）。
 * chip / btn / bowlname / next / result-slot / tip / veil-s / back / open / pick
 * 全部提到 ≥14px，窄屏媒体查询里也不许再降回去。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const CLASSES = [
  "fs-chip",
  "fs-btn",
  "fs-bowlname",
  "fs-next",
  "fs-result-slot",
  "fs-tip",
  "fs-veil-s",
  "fs-back",
  "fs-open",
  "fs-pick",
];

describe("fruit-stack · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("清单里每个类的每条规则字号都 ≥14", () => {
    for (const cls of CLASSES) {
      const rules = [...SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});
