import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-67 gomoku 开始下棋 CTA", () => {
  it("进局仍 248,设置页 :has(开始) 放宽,工具 sticky 不删", () => {
    expect(CSS).toContain(".gmk-wrap{max-width:248px;}");
    expect(CSS).toContain(".gmk-wrap:has(.gmk-start){max-width:420px;}");
    expect(CSS).toContain(".gmk-btns{position:sticky;bottom:0");
  });
});
