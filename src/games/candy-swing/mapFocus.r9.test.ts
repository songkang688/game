/** 三人组 r9 · N-23 candy-swing 地图 focusCurrent */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-23 candy-swing 当前关定位", () => {
  it("渲染后当前关 cs-lv-cur 并 scrollIntoView center", () => {
    expect(src).toContain("cs-lv-cur");
    expect(src).toContain('chaptersEl.querySelector(".cs-lv-cur")');
    expect(src).toContain('scrollIntoView({ block: "center" })');
  });
});
