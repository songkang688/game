/**
 * N-100 续：聚焦当前关后「继续」不得留在 .l99-view 裁切线以上。
 * 不回退 N-39 block:center、四处 showMap(true)、N-63 stage.scrollTop=0。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scrollAdjustToRevealCta } from "./level99";

const SRC = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");

describe("N-100 地图继续钮不飞出滚动盒", () => {
  it("仍用 scrollIntoView center + stage scrollTop 0", () => {
    expect(SRC).toContain('cur.scrollIntoView?.({ block: "center" })');
    expect(SRC).toContain("stageEl.scrollTop = 0");
    expect([...SRC.matchAll(/showMap\(true\)/g)].length).toBeGreaterThanOrEqual(6);
  });

  it("聚焦后按尺子把 CTA 拉回盒顶", () => {
    expect(SRC).toContain("scrollAdjustToRevealCta(vr.top, cr.top, view.scrollTop)");
    expect(SRC).toContain('view.querySelector(".l99-continue")');
  });

  it("915 档：CTA 在盒上方时减少 scrollTop；已在盒内不动", () => {
    expect(scrollAdjustToRevealCta(66, -27, 216)).toBe(123);
    expect(scrollAdjustToRevealCta(80, 12, 134)).toBe(66);
    expect(scrollAdjustToRevealCta(148, 148, 0)).toBe(0);
    expect(scrollAdjustToRevealCta(80, 148, 0)).toBe(0);
  });
});
