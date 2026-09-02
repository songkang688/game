/**
 * 星星琴键 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:.tt-keys 键位提示 13px→14px,420px 媒体查询里
 * 把 .tt-banner/.tt-keys 压回 13px 的两处覆写一并撤掉(两者都是居中可换行文本,
 * 无溢出通道)。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("fix(visual-r3) N-R3-01:提示行字号 ≥14px", () => {
  it(".tt-keys/.tt-banner 全部声明(含媒体查询)≥14px", () => {
    for (const sel of ["\\.tt-keys", "\\.tt-banner"]) {
      const re = new RegExp(`${sel}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "g");
      const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
      expect(sizes.length, `${sel} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
      for (const px of sizes) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("420px 媒体查询不再有任何降字覆写", () => {
    const mq = src.slice(src.indexOf("@media (max-width:420px)"));
    const block = mq.slice(0, mq.indexOf("\n}") + 2);
    expect(block.includes("font-size")).toBe(false);
  });

  it("CSS 里不再有任何 <14px 的 font-size 声明", () => {
    for (const m of src.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1]), "DOM 文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });
});
