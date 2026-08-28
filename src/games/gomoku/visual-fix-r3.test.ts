/**
 * 五子棋 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:.gmk-tierblurb 难度简介 12.5px→14px(min-height
 * 随行高同步 18→21px,只是撑高下限不裁字)、.gmk-claimtip 认输提示 13px→14px。
 * 两处都在可换行的面板文本流里,无溢出通道;菜单按钮原文与 DIFFICULTY_NAME 零改动。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

describe("fix(visual-r3) N-R3-01:面板小字 ≥14px", () => {
  it(".gmk-tierblurb / .gmk-claimtip 全部声明 ≥14px", () => {
    for (const sel of ["\\.gmk-tierblurb", "\\.gmk-claimtip"]) {
      const re = new RegExp(`${sel}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "g");
      const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
      expect(sizes.length, `${sel} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
      for (const px of sizes) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("view.ts 的 CSS 里不再有任何 <14px 的 font-size 声明", () => {
    for (const m of src.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1]), "DOM 文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });

  it("简介行高下限跟着字号走:14px×1.5=21px,不再是 12.5px 时代的 18px", () => {
    expect(/\.gmk-tierblurb\{[^}]*min-height:21px/.test(src)).toBe(true);
  });
});
