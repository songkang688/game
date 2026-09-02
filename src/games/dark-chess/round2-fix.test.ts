/**
 * 翻翻暗棋 · 1.3 第 2 轮 C 档修复契约。
 *
 * r2-1（严重 · r1 修复引入的回归）：`.dc-cell{min-height:44px;aspect-ratio:1/1}` 在收缩轨道上
 * 被 Chrome 传导成 44×44 固定格——相邻格横向重叠 9.98px@360 / 13.88px@320、末列出棋盘框
 * 6.0/9.9px、有效触区宽只剩 ≈34/30px。
 * 修法：格尺寸完全跟随轨道（格上不再写任何最小尺寸，方格边长由 aspect-ratio 从轨道宽得出），
 * 44px 触控红线改由 `::before` 零视觉扩展点击区保住——格宽不足 44 时 inset 取负值把热区
 * 补到 44×44，格宽 ≥44 时被 min() 钳回 0 不缩热区；空格是禁用按钮，不给扩展区。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CSS as BOARD_CSS } from "./view";

/** 局外屏（模式菜单 / 结算）的 SHELL_CSS 没导出，直接读源码量 */
const SHELL_SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("dark-chess · 格互叠回归修复（r2-1）", () => {
  const cellRule = BOARD_CSS.match(/\.dc-cell\{[^}]*\}/)?.[0] ?? "";

  it("格子本体零最小尺寸：轨道多宽格子就多宽，360/320 不再互叠、不再出框", () => {
    expect(cellRule).toContain("aspect-ratio:1/1");
    expect(cellRule).toContain("min-width:0");
    expect(cellRule).toContain("min-height:0");
    // 病灶不许回潮：会被 aspect-ratio 传导成固定宽的最小尺寸一个都不能有
    expect(cellRule).not.toContain("min-height:44px");
    expect(cellRule).not.toContain("min-width:44px");
  });

  it("44px 触控红线由 ::before 扩展点击区保住，且格宽 ≥44 时自动钳回 0", () => {
    const hit = BOARD_CSS.match(/\.dc-cell:not\(\.dc-empty\)::before\{[^}]*\}/)?.[0] ?? "";
    expect(hit, "扩展点击区规则丢了").not.toBe("");
    expect(hit).toContain("position:absolute");
    // min(0px, (格宽-44)/2)：31px 格 → -6.5px 补成 44；27.1px 格 → -8.45px 补成 44；≥44px 格 → 0
    expect(hit).toContain("inset:min(0px,calc((100% - 44px)/2))");
    // 数学口径钉死：A 档实测的两档格宽经此公式后热区恰为 44px
    for (const w of [31.0, 27.1]) {
      const inset = Math.min(0, (w - 44) / 2);
      expect(w - 2 * inset).toBeCloseTo(44, 5);
    }
    // 宽格不缩热区
    expect(57 - 2 * Math.min(0, (57 - 44) / 2)).toBe(57);
  });

  it("空格（禁用按钮）不带扩展区，免得盖住邻格边缘吞掉点击", () => {
    // 扩展区只落在 :not(.dc-empty) 的选择器上，没有裸 .dc-cell::before 的兜底规则
    expect(BOARD_CSS).not.toMatch(/\.dc-cell::before/);
  });
});

describe("dark-chess · 记牌面板文本 ≥14px（r2-5）", () => {
  it(".dc-count span 字号提到 14px，随行的兵种存量数字一起可读", () => {
    const rule = BOARD_CSS.match(/\.dc-count span\{[^}]*\}/)?.[0] ?? "";
    expect(rule, ".dc-count span 规则丢了").not.toBe("");
    const m = /font-size:([\d.]+)px/.exec(rule);
    expect(m).not.toBeNull();
    expect(Number.parseFloat((m as RegExpExecArray)[1])).toBeGreaterThanOrEqual(14);
  });
});

describe("dark-chess · 局外屏字号 ≥14px（r2-4，r1 5-4 尾巴②）", () => {
  it("dc-sub / dc-tip / dc-pick 的每条规则字号都 ≥14", () => {
    for (const cls of ["dc-sub", "dc-tip", "dc-pick"]) {
      const rules = [...SHELL_SRC.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});