import { describe, expect, it } from "vitest";
import { OA_CSS, OA_DUO_PANE_H, OA_SHORT_PANE_H, OA_SOLO_PANE_H, orbPaneH } from "./index";

describe("N-60 orb-arena 闯关技能键", () => {
  it("双人高度不变,矮横屏闯关改走双人那档", () => {
    expect(OA_DUO_PANE_H).toBe(200);
    expect(orbPaneH(2, true)).toBe(OA_DUO_PANE_H);
    expect(orbPaneH(2, false)).toBe(OA_DUO_PANE_H);
    expect(orbPaneH(1, false)).toBe(OA_SOLO_PANE_H);
    expect(orbPaneH(1, true)).toBe(OA_SHORT_PANE_H);
  });

  it("矮屏把 .oa-pad 钉成双人底栏", () => {
    expect(OA_CSS).toContain("@media (max-height:500px)");
    expect(OA_CSS).toContain(".oa-pad{position:sticky;bottom:0");
  });
});
