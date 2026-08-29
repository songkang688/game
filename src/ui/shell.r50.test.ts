/**
 * trio-r50 A：390×844 / 915×412 结算 overlay。
 * N-204 矮屏 overlay 收边、钮钉底、pan-y；不回退 N-203 竖滚、N-202 暂停收边、横滑、CTA、760。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("../games/level99.ts", import.meta.url)), "utf8");

describe("N-204 矮屏结算 overlay", () => {
  it("overlay 仍竖滚；500px 档收边并把钮列钉底；ov-btn 仍 ≥44", () => {
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overflow-y:auto/);
    expect(L99).toMatch(/\.l99-overlay\{[^}]*touch-action:pan-y/);
    expect(L99).toMatch(
      /@media \(max-height:500px\)\{[\s\S]*?\.l99-overlay\{padding:10px 12px;gap:8px;justify-content:flex-start;\}/,
    );
    expect(L99).toMatch(
      /@media \(max-height:500px\)\{[\s\S]*?\.l99-ov-btns\{margin-top:auto;padding-bottom:4px;\}/,
    );
    expect(L99).toMatch(/\.l99-ov-btn\{[^}]*min-height:44px/);
    expect(L99).toMatch(/\.l99-ov-btns\{[^}]*flex:0 0 auto/);
  });
});

describe("既有壳层不回退", () => {
  it("暂停 500px 收边、首页横滑、CTA、760", () => {
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.pause-content \.dialog-text \{[\s\S]*?display: none/,
    );
    expect(STYLES).toMatch(/\.home-screen\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(STYLES).toMatch(/^\.btn \{\n  min-height: 58px;/m);
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toMatch(
      /@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/,
    );
  });
});
