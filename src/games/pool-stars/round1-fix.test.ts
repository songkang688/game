/**
 * 星星台球 · 1.3 第 1 轮 C 档修复契约（对应 A 档 5-4 一般：HUD 小字 <14px）。
 * chip / power 标签 / tip / veil-s（view.ts）与 pick / over-s / recap-t（index.ts）
 * 全部提到 ≥14px，窄屏媒体查询里也不许再降回去。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const VIEW = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");
const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

function checkMin14(src: string, cls: string): void {
  const rules = [...src.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
  expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
  for (const [rule] of rules) {
    const m = /font-size:([\d.]+)px/.exec(rule);
    if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
  }
}

describe("pool-stars · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("view.ts 里的 chip / power 标签 / tip / veil-s 都 ≥14", () => {
    for (const cls of ["ps-chip", "ps-power-tag", "ps-power-val", "ps-tip", "ps-veil-s"]) checkMin14(VIEW, cls);
  });

  it("index.ts 里的 pick / over-s / recap-t 都 ≥14", () => {
    for (const cls of ["ps-pick", "ps-over-s", "ps-recap-t"]) checkMin14(INDEX, cls);
  });
});
