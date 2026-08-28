import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-79 prince-princess 两人一起 D-pad", () => {
  it("500px 档压双人画布并钉垫,620px 无尽档保留", () => {
    expect(CSS).toContain("@media (max-height:620px)");
    expect(CSS).toContain(".pcp-wrap[data-players=\"2\"] .pcp-cv{height:216px;}");
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".pcp-wrap[data-players=\"2\"] .pcp-cv{height:118px;}");
    expect(CSS).toContain(".pcp-pads{position:sticky;bottom:0");
  });
});
