import { describe, expect, it } from "vitest";
import { HC_CSS } from "./index";

describe("N-4 hero-cards 手牌行配方 E", () => {
  it("矮屏把手牌与出牌行钉底，战况日志收高", () => {
    expect(HC_CSS).toContain("@media (max-height:500px)");
    expect(HC_CSS).toContain(".hc-hand{");
    expect(HC_CSS).toContain("position:sticky;bottom:52px");
    expect(HC_CSS).toContain(".hc-pad{");
    expect(HC_CSS).toContain("position:sticky;bottom:0");
    expect(HC_CSS).toContain(".hc-log{min-height:0;max-height:3.2em;}");
  });

  it("U-15 840 档同样钉手牌与出牌行", () => {
    expect(HC_CSS).toContain("@media (max-height:840px)");
  });

  it("手牌换行规则仍在", () => {
    expect(HC_CSS).toContain(".hc-hand{display:flex;gap:6px;flex-wrap:wrap");
  });
});
