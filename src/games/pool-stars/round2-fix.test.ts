/**
 * 星星台球 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-3（一般 · r1 5-4 修复不彻底的尾巴①）：`.ps-tip` 的 CSS 在 r1 已提到 14px，
 * 但 `tableLayout` 的 `fontPx: w < 380 ? 13 : 14` 每次 resize 都用内联样式把它改回 13px
 * （360/320 实测 computed 13px），CSS 修复被运行时来源整个架空。
 * 修法：`fontPx` 统一 14，不再按视口回降——内联与 CSS 两条来源从此说同一个数。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tableLayout } from "./view";

/** 视图 CSS 没导出，直接读源码量（与 round1-fix 同口径） */
const VIEW_SRC = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

describe("pool-stars · .ps-tip 运行时字号来源不再回降（r2-3）", () => {
  it("全部视口档位 fontPx ≥ 14，窄屏内联不再架空 CSS 提级", () => {
    for (const w of [320, 360, 375, 379, 380, 414, 560, 768]) {
      expect(tableLayout(w).fontPx, `视口 ${w}px 的内联字号又回降了`).toBeGreaterThanOrEqual(14);
    }
  });
});

describe("pool-stars · 淡草绿壳卡（B 档 r2 一致性①）", () => {
  const rule = VIEW_SRC.match(/\.ps-wrap\{[^}]*\}/)?.[0] ?? "";

  it("ps-wrap 带上家族壳卡：淡草绿渐变 + 16px 圆角 + 内衬", () => {
    expect(rule).toContain("linear-gradient(180deg,#EFF7F0,#E7F1EA)");
    expect(rule).toContain("border-radius:16px");
    expect(rule).toContain("padding:10px 6px");
  });

  it("320px 几何：竖版台面 cssW 恰好放进「屏内宽 − 卡内衬」，不裁台面", () => {
    // 窗口 1 .screen 左右内边距 clamp(14px,4vw,32px):320px 上 4vw=12.8 → 下限 14px 起作用
    expect(tableLayout(320).cssW).toBeLessThanOrEqual(320 - 2 * 14 - 2 * 6);
    expect(tableLayout(360).cssW).toBeLessThanOrEqual(360 - 2 * 14.4 - 2 * 6);
  });
});
