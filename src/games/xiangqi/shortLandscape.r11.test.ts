import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-10 xiangqi r11 矮横屏工具行钉底", () => {
  it("500px 高档把悔棋那排 sticky 住，248 收幅仍在", () => {
    expect(CSS).toContain("@media (min-width:700px) and (max-height:500px)");
    expect(CSS).toContain(".xq-wrap{max-width:248px;}");
    expect(CSS).toContain(".xq-btns{position:sticky;bottom:0");
  });

  it("412 高再收到 196，棋盘与工具行能进同一屏", () => {
    expect(CSS).toContain("@media (min-width:700px) and (max-height:430px)");
    expect(CSS).toContain(".xq-wrap{max-width:196px;}");
  });

  it("915 档棋盘左、工具列右，悔棋不跟在盘底", () => {
    expect(CSS).toContain("@media (min-width:800px) and (max-height:430px)");
    expect(CSS).toContain(".xq-boardhost{grid-column:1");
    expect(CSS).toContain("flex-direction:column;flex-wrap:nowrap");
  });
});
