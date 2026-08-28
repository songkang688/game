/**
 * 消消乐矮横屏：棋盘盒内滚到最后一格，不改消除判定。
 */
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("消消乐 915 棋盘盒可滚到末格", () => {
  it("max-height:500px 档给 .mst-boardwrap 内滚，不靠 pointer:coarse", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toMatch(/\.mst-boardwrap\{max-height:min\(240px, calc\(100dvh - 196px\)\);overflow-y:auto/);
    expect(CSS).toContain("touch-action:pan-y");
  });

  it("不改 8×8 格子热区写法", () => {
    expect(CSS).toContain(".mst-cell{position:relative;aspect-ratio:1");
  });
});
