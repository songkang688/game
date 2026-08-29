/**
 * trio-r22…r25 测试员 A：N-128 宿主滚动契约、N-131 quiz 820 档、N-132/137 kit。
 * 不回退 N-117/118/120；不碰 B 的 N-121/122/124。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_BODY_FONT_PX, MIN_TOUCH_PX, bodyFontUpliftCss, touchUpliftCss } from "../art/kit/uiTouch";

const L99 = readFileSync(fileURLToPath(new URL("./level99.ts", import.meta.url)), "utf8");
const QUIZ = readFileSync(fileURLToPath(new URL("./quiz99.ts", import.meta.url)), "utf8");
const SP = readFileSync(fileURLToPath(new URL("./sudoku-petal/index.ts", import.meta.url)), "utf8");
const BD = readFileSync(fileURLToPath(new URL("./block-drop/index.ts", import.meta.url)), "utf8");
const CLK = readFileSync(fileURLToPath(new URL("./clock-house/runner.ts", import.meta.url)), "utf8");
const FDF = readFileSync(fileURLToPath(new URL("./find-diff/index.ts", import.meta.url)), "utf8");
const MST = readFileSync(fileURLToPath(new URL("./match-stars/view.ts", import.meta.url)), "utf8");

describe("N-117/118/120 不回退", () => {
  it("页签徽章、无 136px 硬钳、pan-y 仍在", () => {
    expect(L99).toContain('l99-tab-lockmark');
    expect(L99).not.toContain(".l99-wrap{max-height:");
    expect(L99).toMatch(/\.l99-view\{[^}]*touch-action:pan-y/);
    expect(L99).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:auto/);
  });
});

describe("N-128 .l99-host 溢出契约", () => {
  it("host 裁剪、内部 .l99-view 可滚，不把滚条交回 game-stage", () => {
    expect(L99).toMatch(/\.l99-host\{[^}]*overflow:hidden/);
    expect(L99).toMatch(/\.l99-view\{[^}]*overflow-y:auto/);
    expect(L99).toContain("game-stage--l99");
  });
});

describe("N-99 数独盘可滚到键排", () => {
  /* 回填 1.3:1.3 的 wrapScroll.n99 闸锁死「竖屏基线 .sp-wrap 仍 overflow:hidden」,
     可滚是由 ≤500 的媒体查询叠上去的,不改基础态。本闸改成守这条更窄的实现口径。 */
  it("矮屏 .sp-wrap 由媒体查询给可滚（基础态仍 hidden），矮屏数字键 ≥44", () => {
    expect(SP).toMatch(/@media \(max-height:500px\)\{[\s\S]*?\.sp-wrap\{[^}]*overflow-y:auto/);
    expect(SP).toMatch(/\.sp-key\{min-height:44px/);
  });
});

describe("N-131 / N-127 A 平板中间档", () => {
  it("quiz99 有 820px × pointer:coarse，选项热区不降", () => {
    expect(QUIZ).toContain("@media (max-height: 820px) and (pointer: coarse)");
    const mid = QUIZ.slice(QUIZ.indexOf("@media (max-height: 820px) and (pointer: coarse)"));
    expect(mid).toMatch(/\.qz-choice \{ min-height: 52px/);
    expect(mid).toMatch(/\.qz-say \{ min-height: 44px/);
  });

  it("clock-house / find-diff / match-stars 同档", () => {
    expect(CLK).toContain("@media (max-height: 820px) and (pointer: coarse)");
    expect(FDF).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(MST).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(FDF).toMatch(/\.fdf-btn\{min-height:44px/);
    expect(MST).toMatch(/\.mst-btn\{min-height:44px/);
  });
});

describe("N-132 / N-137 kit 触区与正文", () => {
  it("MIN_TOUCH_PX=44、MIN_BODY_FONT_PX=16", () => {
    expect(MIN_TOUCH_PX).toBe(44);
    expect(MIN_BODY_FONT_PX).toBe(16);
    expect(touchUpliftCss([".x"])).toBe(".x{min-height:44px;}");
    expect(bodyFontUpliftCss([".t"])).toBe(".t{font-size:16px;}");
  });
});

describe("N-135 / N-136 A 返回钮", () => {
  it(".bd-back min-height 44", () => {
    expect(BD).toMatch(/\.bd-back\{[^}]*min-height:44px/);
  });
});

describe("N-130 A 学习款 *-msg 正文", () => {
  it(".qz-msg / .fdf-msg / .mst-msg ≥16", () => {
    expect(QUIZ).toMatch(/\.qz-msg \{[^}]*font-size: 16px/);
    expect(FDF).toMatch(/\.fdf-msg\{[^}]*font-size:16px/);
    expect(MST).toMatch(/\.mst-msg\{[^}]*font-size:16px/);
  });
});
