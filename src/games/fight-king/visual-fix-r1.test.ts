/**
 * 朵星格斗王 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子（静态源码断言）。
 *
 * 对应 A 档 P-03：菜单副标题 `.fk-sub` 13px、模式卡描述 `.fk-mode-d` 12.5px
 * 低于宪法第七节 14px 门槛。修后把菜单正文与按钮字统一提到 ≥14px，
 * 这里逐个选择器钉住（含媒体查询里的二次声明），防后续改动又降回去。
 *
 * HUD 微字号（.fk-name / .fk-clock-r / .fk-pad-name / .fk-ch-n / .fk-fd）
 * 是 360px 防溢出的刻意设计，本轮登记遗留不动，不在钉子范围内。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 某选择器全部声明块（含媒体查询里的二次声明）中出现的 font-size（px），至少命中一处 */
function fontSizesOf(selector: string): number[] {
  const re = new RegExp(`\\${selector}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "g");
  const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
  expect(sizes.length, `${selector} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
  return sizes;
}

describe("fix(visual-r1) P-03：菜单正文与按钮字号 ≥14px", () => {
  it(".fk-sub（菜单副标题/键位说明）≥14px", () => {
    for (const px of fontSizesOf(".fk-sub")) expect(px).toBeGreaterThanOrEqual(14);
  });

  it(".fk-mode-d（模式卡描述）≥14px", () => {
    for (const px of fontSizesOf(".fk-mode-d")) expect(px).toBeGreaterThanOrEqual(14);
  });

  it("菜单里的其余正文类字号也 ≥14px（同类同修）", () => {
    for (const sel of [".fk-info", ".fk-live", ".fk-swap", ".fk-train-hint"]) {
      for (const px of fontSizesOf(sel)) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("触屏按钮字与连段字（含窄屏媒体查询的二次声明）≥14px", () => {
    for (const sel of [".fk-padbtn", ".fk-combo"]) {
      for (const px of fontSizesOf(sel)) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });
});
