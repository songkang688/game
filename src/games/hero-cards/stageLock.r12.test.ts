import { describe, expect, it } from "vitest";
import { HC_CSS } from "./index";

describe("N-4 hero-cards r12 消灭舞台自滚", () => {
  it("矮屏锁 .hc-wrap 高,手牌与确定仍 sticky", () => {
    expect(HC_CSS).toContain("position:sticky;bottom:52px");
    expect(HC_CSS).toContain(".hc-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
  });
});
