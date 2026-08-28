import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-64 junqi-camp 双人确认行", () => {
  it("保留 300 字符串,矮屏覆盖 min-height 并钉工具", () => {
    expect(CSS).toContain("min-height:300px");
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".jq-stage{min-height:0;height:min(58dvh,236px)}");
    expect(CSS).toContain(".jq-tools{position:sticky;bottom:0");
  });
});
