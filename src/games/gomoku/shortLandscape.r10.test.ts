import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-10 gomoku 矮横屏再收棋盘", () => {
  it("500px 高把外壳收到 248，工具行钉底", () => {
    expect(CSS).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(CSS).toContain(".gmk-wrap{max-width:248px;}");
    expect(CSS).toContain(".gmk-btns{position:sticky;bottom:0");
  });
});
