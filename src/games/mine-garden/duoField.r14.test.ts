import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MN_CSS, cellPx } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-71 mine-garden 双人同屏末行", () => {
  it("9×9 在 412 高余量下末行贴进视口", () => {
    const px = cellPx(9, 400, 250, 9);
    expect(px).toBeGreaterThanOrEqual(22);
    expect(px * 9).toBeLessThanOrEqual(250);
    expect(cellPx(9, 400)).toBeGreaterThan(px);
  });

  it("矮横屏双栏 + layout 吃 maxH，设置页 CSS 未改开始钮", () => {
    expect(MN_CSS).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(MN_CSS).toContain(".mn-duo{flex-wrap:nowrap");
    expect(SRC).toContain("getBoundingClientRect().top");
    expect(SRC).toContain('go.textContent = "开始 ▶"');
  });
});
