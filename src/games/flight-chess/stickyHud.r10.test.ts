import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-2 flight-chess 掷骰行配方 E", () => {
  it("矮屏钉住 .fc-hud，盘面按余高收方", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".fc-hud{");
    expect(CSS).toContain("position:sticky;bottom:0");
    expect(CSS).toContain(".fc-boardwrap{max-width:min(440px, calc(100dvh - 148px));}");
  });

  it("840 档钉 HUD,不把 500 档 wrap overflow 拷过去,且无多余花括号", () => {
    expect(CSS).toContain("@media (max-height:840px) and (min-height:501px)");
    const at = CSS.indexOf("@media (max-height:840px) and (min-height:501px)");
    const next = CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    const block = CSS.slice(at, next);
    expect(block).toContain("position:sticky;bottom:0");
    expect(block).not.toContain("overflow:hidden");
    expect(CSS.slice(next - 20, next + 40)).toMatch(/;\}\s*\}\s*@media \(prefers-reduced-motion:reduce\)/);
    expect(CSS.slice(next - 20, next)).not.toMatch(/\}\s*\}\s*\}\s*$/);
  });
});
