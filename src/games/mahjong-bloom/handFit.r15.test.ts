import { describe, expect, it } from "vitest";
import { MJ_CSS } from "./index";

describe("N-75 mahjong-bloom 对局手牌矮横屏", () => {
  it("N-41 牌宽 44 不动,矮屏把手牌钉底横滑", () => {
    expect(MJ_CSS).toMatch(/\.mj-tile\{[^}]*min-width:44px/);
    expect(MJ_CSS).toContain("@media (max-height:500px)");
    expect(MJ_CSS).toContain(".mj-hand{position:sticky;bottom:0");
    expect(MJ_CSS).toContain("flex-wrap:nowrap");
    expect(MJ_CSS).toContain(".mj-wrap{height:100%;max-height:calc(100dvh - 108px)");
  });
});
