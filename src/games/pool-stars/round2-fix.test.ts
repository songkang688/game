/**
 * 星星台球 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-3（一般 · r1 5-4 修复不彻底的尾巴①）：`.ps-tip` 的 CSS 在 r1 已提到 14px，
 * 但 `tableLayout` 的 `fontPx: w < 380 ? 13 : 14` 每次 resize 都用内联样式把它改回 13px
 * （360/320 实测 computed 13px），CSS 修复被运行时来源整个架空。
 * 修法：`fontPx` 统一 14，不再按视口回降——内联与 CSS 两条来源从此说同一个数。
 */
import { describe, expect, it } from "vitest";
import { tableLayout } from "./view";

describe("pool-stars · .ps-tip 运行时字号来源不再回降（r2-3）", () => {
  it("全部视口档位 fontPx ≥ 14，窄屏内联不再架空 CSS 提级", () => {
    for (const w of [320, 360, 375, 379, 380, 414, 560, 768]) {
      expect(tableLayout(w).fontPx, `视口 ${w}px 的内联字号又回降了`).toBeGreaterThanOrEqual(14);
    }
  });
});
