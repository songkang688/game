/**
 * 豆豆迷宫 · 1.3 第 1 轮 C 档修复契约（对应 A 档 5-4 一般：HUD 小字 <14px）。
 * chip / note / sub / tip 全部提到 ≥14px，窄屏媒体查询里也不许再降回去。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("dot-maze · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("chip / note / sub / tip 的每一条规则字号都 ≥14", () => {
    for (const cls of ["dmz-chip", "dmz-note", "dmz-sub", "dmz-tip"]) {
      const rules = [...SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});
