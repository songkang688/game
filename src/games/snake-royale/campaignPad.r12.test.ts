import { describe, expect, it } from "vitest";
import { SR_CSS, SR_DUO_PANE_H, SR_SHORT_PANE_H, SR_SOLO_PANE_H, snakePaneH } from "./index";

describe("N-61 snake-royale 闯关加速/急停", () => {
  it("双人高度不变,矮横屏闯关改走短画布", () => {
    expect(SR_DUO_PANE_H).toBe(224);
    expect(snakePaneH(2, true)).toBe(SR_DUO_PANE_H);
    expect(snakePaneH(2, false)).toBe(SR_DUO_PANE_H);
    expect(snakePaneH(1, false)).toBe(SR_SOLO_PANE_H);
    expect(snakePaneH(1, true)).toBe(SR_SHORT_PANE_H);
  });

  it("矮屏钉 .sr-pad,回选关热区 44", () => {
    expect(SR_CSS).toContain("@media (max-height:500px)");
    expect(SR_CSS).toContain(".sr-pad{position:sticky;bottom:0");
    expect(SR_CSS).toMatch(/\.sr-back\{[^}]*min-height:44px/);
  });
});
