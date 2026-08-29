/**
 * trio-r49 A：1024×768 走查壳层。
 * N-203 结算 overlay 可竖滚，CTA 不被 game-stage--l99 裁掉。
 * 不回退 N-202 矮横屏收边、首页横滑、CTA 回卷、平板 760。不抢 B 游戏文件。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const L99 = readFileSync(fileURLToPath(new URL("../games/level99.ts", import.meta.url)), "utf8");

describe("N-203 结算 overlay 不被舞台裁 CTA", () => {
  it(".l99-overlay 竖向可滚，钮列不收缩", () => {
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overflow-y:auto/);
    expect(L99).toMatch(/\.l99-overlay\{[^}]*overscroll-behavior:contain/);
    expect(L99).toMatch(/\.l99-ov-btns\{[^}]*flex:0 0 auto/);
    expect(L99).toMatch(/\.l99-ov-btn\{[^}]*min-height:44px/);
  });
});

describe("N-201/202 / CTA / 760 不回退", () => {
  it("首页横滑、矮屏暂停收边、继续回卷、平板 760 仍在", () => {
    expect(STYLES).toMatch(/\.home-screen\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(STYLES).toMatch(
      /@media \(max-height: 500px\) \{[\s\S]*?\.pause-content \.dialog-text \{[\s\S]*?display: none/,
    );
    expect(STYLES).toMatch(/^\.btn \{\n  min-height: 58px;/m);
    expect(L99).toContain("scrollAdjustToRevealCta");
    expect(L99).toMatch(
      /@media \(min-width:760px\) and \(min-height:600px\)\{\.l99-wrap\{max-width:760px;\}/,
    );
    expect(L99).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:\s*auto/);
  });
});
