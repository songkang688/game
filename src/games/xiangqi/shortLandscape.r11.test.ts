import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-10 xiangqi r11 矮横屏工具行钉底", () => {
  it("500px 高档把悔棋那排 sticky 住，248 收幅仍在", () => {
    expect(CSS).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(CSS).toContain(".xq-wrap{max-width:248px;}");
    expect(CSS).toContain(".xq-btns{position:sticky;bottom:0");
  });
});
