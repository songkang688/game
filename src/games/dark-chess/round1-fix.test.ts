/**
 * 翻翻暗棋 · 1.3 第 1 轮 C 档修复契约。
 *
 * A 档 5-2（阻断）：`.dc-cell{min-height:44px}` 经 aspect-ratio 转移出 44px 的最小内容宽，
 * 8 列 1fr 一行最小约 373px，360/320 视口下末列被 overflow:hidden 裁掉、点不到。
 * 修法：触区与列宽解耦——列模板改 `minmax(0,1fr)`、格子加 `min-width:0`，
 * 44px 触控高度保留，列宽允许收进容器（收缩后仍是 ≥31×44 的可点面积）。
 */
import { describe, expect, it } from "vitest";
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
