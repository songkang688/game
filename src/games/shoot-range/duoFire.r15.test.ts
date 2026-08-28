import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-78 shoot-range 双人开火矮横屏", () => {
  it("锁 wrap 自滚并把垫钉底,不改菜单芯片 40", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".shr-wrap{height:100%;max-height:calc(100dvh - 76px)");
    expect(CSS).toContain(".shr-pads{position:sticky;bottom:0");
    expect(CSS).toContain(".shr-cv{height:min(140px,36dvh)}");
  });
});
