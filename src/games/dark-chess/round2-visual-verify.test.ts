/**
 * 翻翻暗棋 · 1.3 第 2 轮 A 档复验契约。
 *
 *  ① r1 一般 2-2 修复加固:渐变 id 拼格号后,同兵种铺满 32 格 id 也两两互异,
 *     且每张 svg 的 url(#…) 引用与自己的 defs id 严格配对——不再有跨格串色可能;
 *  ② 窄屏收缩契约:≤400px 媒体查询里 gap/padding/border 收窄、点数行收起,
 *     这是第 2 轮实测 360/320 八列全部可见可点的前提,钉住防回退。
 */
import { describe, expect, it } from "vitest";
import { pieceFaceSVG } from "./art";
import { CSS as BOARD_CSS } from "./view";

describe("dark-chess · 渐变 id 全盘唯一（r1 2-2 修复加固）", () => {
  it("同兵种铺 32 格,32 个渐变 id 两两互异,引用与定义配对", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 32; i++) {
      const svg = pieceFaceSVG("red", "soldier", i);
      const def = /<radialGradient id="([^"]+)"/.exec(svg)?.[1] ?? "";
      const use = /url\(#([^)]+)\)/.exec(svg)?.[1] ?? "";
      expect(def, `第 ${i} 格没有渐变定义`).not.toBe("");
      expect(use, `第 ${i} 格引用与定义不配对`).toBe(def);
      ids.add(def);
    }
    expect(ids.size).toBe(32);
  });
});

describe("dark-chess · 窄屏收缩契约（r2 实测口径钉死）", () => {
  it("≤400px 时棋盘 gap/padding/border 收窄,棋面点数行收起只留汉字", () => {
    const at = BOARD_CSS.indexOf("@media (max-width:400px)");
    expect(at).toBeGreaterThan(-1);
    for (const rule of [".dc-board{gap:3px;}", ".dc-board{padding:3px;border-width:4px;}", ".dc-face g.dcd{display:none;}"]) {
      expect(BOARD_CSS.indexOf(rule, at), `窄屏媒体查询缺 ${rule}`).toBeGreaterThan(at);
    }
  });
});
