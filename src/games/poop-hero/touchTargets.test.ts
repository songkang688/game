/**
 * 便便超人 · HUD 小按钮的热区回归（窗口5 第1轮 学习优化员）。
 *
 * 对应测试员档C 的 **W5C-P01（建议）**：360×720 上「⏸ 暂停」实测 30×32，
 * 宽度差 2px 就低于 32 的下限。摇杆那几个大键有 `padMetrics` 守着，
 * HUD 这排小药丸只靠 padding 撑，窄屏 padding 一收就掉下来，所以在 CSS 里钉死。
 */
import { describe, expect, it } from "vitest";

import { PH_CSS } from "./index";
import { HUD_BTN_MIN_H, HUD_BTN_MIN_W, MIN_HOT } from "./runtime";

/** 把某个选择器的所有声明块揪出来（媒体查询里的那几份也算） */
function rulesFor(css: string, selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(^|[,{}])\\s*${selector.replace(".", "\\.")}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "g");
  for (const hit of css.matchAll(re)) out.push(hit[2]);
  return out;
}

/** 声明块里某个属性的 px 值（没写就返回 null） */
function px(block: string, prop: string): number | null {
  const hit = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(block);
  return hit ? Number(hit[1]) : null;
}

describe("便便超人 · HUD 小按钮的热区（W5C-P01）", () => {
  it("最小热区常量本身就守得住 32px 的下限", () => {
    expect(HUD_BTN_MIN_W).toBeGreaterThanOrEqual(32);
    expect(HUD_BTN_MIN_H).toBeGreaterThanOrEqual(32);
    // 宽度直接跟平台那把尺子（44px）走
    expect(HUD_BTN_MIN_W).toBe(MIN_HOT);
  });

  it(".ph-btn 在 CSS 里写死了最小宽高，撑得开才不会被 padding 收没", () => {
    const blocks = rulesFor(PH_CSS, ".ph-btn");
    expect(blocks.length, "CSS 里找不到 .ph-btn").toBeGreaterThan(0);
    const base = blocks[0];
    expect(px(base, "min-width"), ".ph-btn 没写 min-width").toBe(HUD_BTN_MIN_W);
    expect(px(base, "min-height"), ".ph-btn 没写 min-height").toBe(HUD_BTN_MIN_H);
    // 文字得居中，不然撑大之后字会贴在左上角
    expect(base).toMatch(/display\s*:\s*inline-flex/);
    expect(base).toMatch(/align-items\s*:\s*center/);
  });

  it("窄屏那几档只许收 padding，不许把最小热区改小", () => {
    for (const block of rulesFor(PH_CSS, ".ph-btn")) {
      const w = px(block, "min-width");
      const h = px(block, "min-height");
      if (w !== null) expect(w, `窄屏把 min-width 收到了 ${w}px`).toBeGreaterThanOrEqual(HUD_BTN_MIN_W);
      if (h !== null) expect(h, `窄屏把 min-height 收到了 ${h}px`).toBeGreaterThanOrEqual(HUD_BTN_MIN_H);
    }
  });
});
