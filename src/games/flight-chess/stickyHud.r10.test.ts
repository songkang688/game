import { describe, expect, it } from "vitest";
import { CSS } from "./index";

describe("N-2 flight-chess 掷骰行配方 E", () => {
  it("矮屏钉住 .fc-hud，盘面按余高收方", () => {
    expect(CSS).toContain("@media (max-height:500px)");
    expect(CSS).toContain(".fc-hud{");
    expect(CSS).toContain("position:sticky;bottom:0");
    expect(CSS).toContain(".fc-boardwrap{max-width:min(440px, calc(100dvh - 148px));}");
  });
});
