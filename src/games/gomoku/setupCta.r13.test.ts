import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-67 gomoku 自由对战开始下棋", () => {
  it("设置页 CTA sticky,进局 248 钳盘字符串仍在", () => {
    expect(CSS).toContain(".gmk-panel .gmk-start{position:sticky;bottom:0");
    expect(CSS).toContain(".gmk-wrap{max-width:248px;}");
    expect(CSS).toContain(".gmk-btns{position:sticky;bottom:0");
  });
});
