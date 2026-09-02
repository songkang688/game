import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-124 shoot-range 平板粗指针中间档", () => {
  it("820 档抬 toggle/回关/键并钉垫,不改 N-78 的 500 画布钳", () => {
    expect(CSS).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(CSS).toContain(".shr-toggle,.shr-back,.shr-veil-btn,.shr-mode{min-height:44px;}");
    expect(CSS).toContain(".shr-key{min-height:44px;}");
    expect(CSS).toContain(".shr-pads{--k:46px;position:sticky;bottom:0");
    expect(CSS).toContain("@media (max-height:820px) and (min-height:501px) and (pointer:coarse)");
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".shr-cv{height:min(140px,36dvh);}");
    expect(CSS).toContain(".shr-cv{height:min(200px,36dvh);}");
    expect(CSS).toMatch(/\.shr-toggle\{[^}]*min-height:44px/);
  });
});
