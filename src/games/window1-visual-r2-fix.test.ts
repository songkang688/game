/**
 * 1.3 窗口 1 · 第 2 轮监督修复员(C 档)新增的修复钉子。
 *
 * R2-2(= r1 遗留 L-2):hero-cards `.hc-table` 桌面叠织物暗纹——
 * 与 `.mj-board`(mahjong-bloom)同 45° 角、同 6px/12px 节距;浅暖米底上白纹不可见,
 * 织纹色改用木沿色 #EBD2B4 向深派生的暖褐 rgba(170,120,80,.04),alpha ≤ 4% 红线;
 * 织纹作为多重背景第一层,位于纸色 linear-gradient 之前(织纹在上)。
 *
 * 只读源码;修复报告见 docs/qa/1.3-window1-round2-fixer.md。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function src(game: string, file = "index.ts"): string {
  return readFileSync(join(ROOT, "src", "games", game, file), "utf8");
}

describe("R2-2 · hero-cards 桌面织物暗纹(源码级钉子)", () => {
  it(".hc-table 叠了 45° 暖褐斜织纹,节距 6px/12px 与 .mj-board 同规格,且 alpha 严格 ≤ 0.04", () => {
    const text = src("hero-cards");
    const weave =
      /\.hc-table\{[^}]*repeating-linear-gradient\(45deg,rgba\(170,120,80,\.0([0-4])\) 0 6px,transparent 6px 12px\)/s.exec(
        text,
      );
    expect(weave, "桌面没有织纹层(或织纹色/alpha/节距不符 learner 规格)").toBeTruthy();
  });

  it("织纹是多重背景第一层,位于纸色 linear-gradient(180deg,…) 之前;桌面底渐变保持不变", () => {
    const rule = /\.hc-table\{[^}]*\}/s.exec(src("hero-cards"))?.[0] ?? "";
    const weaveAt = rule.indexOf("repeating-linear-gradient");
    const baseAt = rule.indexOf("linear-gradient(180deg,#FBEBD8,#F5DCC2)");
    expect(weaveAt, "织纹层缺失").toBeGreaterThan(-1);
    expect(baseAt, "桌面纸色底渐变被改动").toBeGreaterThan(-1);
    expect(weaveAt, "织纹应在底渐变之前(多重背景第一层)").toBeLessThan(baseAt);
  });
});
