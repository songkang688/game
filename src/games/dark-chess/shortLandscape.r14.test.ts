import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-65 dark-chess 双人取消/暂停", () => {
  it("矮宽屏收盘钉 .dc-row", () => {
    expect(CSS).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(CSS).toContain(".dc-board{max-width:min(280px,62dvh)}");
    expect(CSS).toContain(".dc-row{position:sticky;bottom:0");
  });
});
