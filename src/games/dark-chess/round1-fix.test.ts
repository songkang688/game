/**
 * 翻翻暗棋 · 1.3 第 1 轮 C 档修复契约。
 *
 * A 档 5-2（阻断）：`.dc-cell{min-height:44px}` 经 aspect-ratio 转移出 44px 的最小内容宽，
 * 8 列 1fr 一行最小约 373px，360/320 视口下末列被 overflow:hidden 裁掉、点不到。
 * 修法：触区与列宽解耦——列模板改 `minmax(0,1fr)`、格子加 `min-width:0`，
 * 44px 触控高度保留，列宽允许收进容器（收缩后仍是 ≥31×44 的可点面积）。
 */
import { describe, expect, it } from "vitest";
import { backSVG, pieceFaceSVG } from "./art";
import { CSS as BOARD_CSS } from "./view";

describe("dark-chess · 360/320 列宽收缩（A 档 5-2 阻断）", () => {
  it("列模板 minmax(0,1fr) + 格子 min-width:0，一行八格收得进窄容器", () => {
    expect(BOARD_CSS).toContain("grid-template-columns:repeat(8,minmax(0,1fr))");
    const cellRule = BOARD_CSS.match(/\.dc-cell\{[^}]*\}/)?.[0] ?? "";
    expect(cellRule).toContain("min-width:0");
    // 触控高度红线不回退：44px 仍钉死在格子上
    expect(cellRule).toContain("min-height:44px");
  });
});

describe("dark-chess · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("chip 与 note 的每条规则字号都 ≥14", () => {
    for (const cls of ["dc-chip", "dc-note"]) {
      const rules = [...BOARD_CSS.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe("dark-chess · defs 固定 id 撞车修复（A 档 2-2 一般）", () => {
  it("牌背改三停层叠实心:零 defs/url(#/id=,且 32 张除木纹外仍逐字节相同", () => {
    const strip = (svg: string): string => svg.replace(/<path class="dcg" d="[^"]*"/g, '<path class="dcg"');
    const norm = strip(backSVG(0));
    for (let i = 0; i < 32; i++) {
      const svg = backSVG(i);
      expect(svg, `第 ${i} 张混进 defs`).not.toContain("<defs");
      expect(svg, `第 ${i} 张混进 url(#`).not.toContain("url(#");
      expect(svg, `第 ${i} 张混进 id=`).not.toContain(" id=");
      expect(strip(svg), `第 ${i} 张结构走样`).toBe(norm);
    }
    // 三停木色齐全（顶亮 → 中 → 底暗），渐变等效不缩水
    for (const c of ["#8a5a30", "#744a26", "#5f3a1c"]) expect(backSVG(0)).toContain(c);
  });

  it("棋面渐变 id 拼格号:不同格位互异,同参调用保持确定性", () => {
    const a = pieceFaceSVG("red", "shuai", 3);
    expect(a).toContain('id="dcIvory-red-shuai-3"');
    expect(a).not.toBe(pieceFaceSVG("red", "shuai", 5));
    expect(pieceFaceSVG("blue", "ju")).toBe(pieceFaceSVG("blue", "ju"));
  });
});
