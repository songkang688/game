/**
 * trio-r48 A：915×412 走查壳层。
 * N-202 矮屏暂停弹窗不被裁；不回退 N-201 横滑 / .btn 58、CTA、平板 760。
 * 不改 .l99-tabs overflow-x、mapColumns、dialogs 点击守卫。不抢 B 游戏文件。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("../games/level99.ts", import.meta.url)), "utf8");

describe("N-202 矮屏暂停弹窗", () => {
  it("max-height 500px 收 overlay/dialog，暂停说明藏起，.btn 仍 58", () => {
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.overlay \{[\s\S]*?padding: 6px 12px/,
    );
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?max-height: calc\(var\(--vv-h, 100dvh\) - 12px\)/,
    );
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.pause-content \.dialog-text \{[\s\S]*?display: none/,
    );
    expect(STYLES).toMatch(
      /\.btn,\s*\.icon-btn[\s\S]*?min-height:\s*44px[\s\S]*?^\.btn \{\n  min-height: 58px;/m,
    );
  });
});

describe("N-201 / CTA / 760 不回退", () => {
  it("首页横滑、继续回卷、平板 760 仍在", () => {
    expect(STYLES).toMatch(/\.home-screen\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toMatch(
      /@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/,
    );
    expect(L99).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:\s*auto/);
  });
});
