import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-2 flight-chess r14 视口钳 dvh", () => {
  it("保留 r12 锁舞台字符串,再垫 100dvh-76", () => {
    expect(CSS).toContain(".fc-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(CSS).toContain(".fc-wrap{max-height:calc(100dvh - 76px)}");
    expect(CSS).toContain("position:sticky;bottom:0");
  });
});
