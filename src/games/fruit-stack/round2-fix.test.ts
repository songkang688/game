/**
 * 水果叠叠盆 · 1.3 第 2 轮 C 档修复契约。
 *
 * B 档 r2 一致性②：`.fs-wrap` 无壳卡，HUD/按钮/下一颗篮浮在舞台白底上，与其余带卡各款并排露怯。
 * 修法：粉白壳卡（与 canvas 内天空渐变同族）。与 B 档规格的偏差：侧内衬收敛为 0——
 * 双盆画布宽由 `layout()` 按 host.clientWidth（卡外容器）实测分配，任何侧内衬都会让
 * 双盆行比卡内容宽、溢出卡外；上下 10px 留卡已够成立卡片语汇，360/320 几何零改动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX_SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("fruit-stack · 粉白壳卡（B 档 r2 一致性②）", () => {
  const rule = INDEX_SRC.match(/\.fs-wrap\{[^}]*\}/)?.[0] ?? "";

  it("fs-wrap 带上家族壳卡：粉白渐变 + 16px 圆角", () => {
    expect(rule).toContain("linear-gradient(180deg,#FFF4F8,#FBF0FF)");
    expect(rule).toContain("border-radius:16px");
  });

  it("侧内衬必须是 0：双盆画布宽来自卡外容器，侧内衬会把双盆行挤出卡外", () => {
    expect(rule).toContain("padding:10px 0");
    expect(rule).not.toMatch(/padding:10px [1-9]/);
  });
});
