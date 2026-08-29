/**
 * 消消乐矮横屏：棋盘盒内滚到最后一格，不改消除判定。
 */
import { describe, expect, it } from "vitest";
import { CSS, boardBoxMaxPx } from "./view";

describe("消消乐 915 棋盘盒可滚到末格", () => {
  it("max-height:500px 档给 .mst-boardwrap 内滚，不靠 pointer:coarse", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toMatch(/\.mst-boardwrap\{max-height:min\(240px, calc\(100dvh - 196px\)\);overflow-y:auto/);
  });

  it("按舞台余量钳高：915 档装不下才写 max-height", () => {
    expect(boardBoxMaxPx(100, 648)).toBe(100);
    expect(boardBoxMaxPx(351, 351)).toBeNull();
    expect(boardBoxMaxPx(20, 648)).toBeNull();
  });

  it("不改 8×8 格子热区写法", () => {
    expect(CSS).toContain(".mst-cell{position:relative;aspect-ratio:1");
  });
});
