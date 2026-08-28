import { describe, expect, it } from "vitest";
import { HC_CSS } from "./index";

describe("N-4 hero-cards r14 视口钳 dvh", () => {
  it("保留 r12 wrap 锁,再垫 100dvh-76", () => {
    expect(HC_CSS).toContain(".hc-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(HC_CSS).toContain(".hc-wrap{max-height:calc(100dvh - 76px);}");
  });
});
