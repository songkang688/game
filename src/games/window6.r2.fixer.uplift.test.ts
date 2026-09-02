/**
 * 窗口 6 · 第 2 轮视觉监督修复员(C 档)· W6R1-09/10 壳层触区/字号统一抬钉子。
 *
 * 第 1 轮 A 档专项⑤登记:9 款壳层按钮高 26–38px、正文字号 10–13px(存量);
 * 第 1 轮 C 档明确「第 2 轮统一抬(触区 ≥40、正文 ≥14)」。本轮落地:
 * 统一规格唯一出处是新增 kit `src/art/kit/uiTouch.ts`(kit 只增不改),
 * 9 款在各自 CSS 末尾消费;mole-pop 因「样式表必须纯字面量」约定改为
 * 字面量落地,由本文件与 kit 常量对账,漂移就红。
 *
 * 豁免登记(不在本钉子范围):共享壳层 l99-*(跨窗口,交统筹)、
 * bubble-pop `.bbp-mark` 图案记号(纯装饰非正文)。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_BODY_FONT_PX,
  MIN_TOUCH_PX,
  MIN_TOUCH_WIDE_PX,
  bodyFontUpliftCss,
  touchUpliftCss,
} from "../art/kit/uiTouch";
import { bhVisualCss } from "./box-hamster/visual";
import { bpVisualCss } from "./bubble-pop/visual";

function src(rel: string): string {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("窗口6 r2 fixer · uiTouch kit 规格(W6R1-09/10 唯一口径)", () => {
  it("触区最小高度 44px、过窄补宽 44px、正文最低 16px", () => {
    expect(MIN_TOUCH_PX).toBe(44);
    expect(MIN_TOUCH_WIDE_PX).toBe(44);
    expect(MIN_BODY_FONT_PX).toBe(16);
  });

  it("touchUpliftCss 只输出 min-height(可选 min-width),不动布局与热区判定", () => {
    expect(touchUpliftCss([".x-btn"])).toBe(".x-btn{min-height:44px;}");
    expect(touchUpliftCss([".a", ".b"], { minWidth: true })).toBe(
      ".a,.b{min-height:44px;min-width:44px;}"
    );
    expect(touchUpliftCss([])).toBe("");
    expect(touchUpliftCss([".x"])).not.toMatch(/width:(?!44px)/);
  });

  it("bodyFontUpliftCss 只输出 font-size:16px", () => {
    expect(bodyFontUpliftCss([".t1", ".t2"])).toBe(".t1,.t2{font-size:16px;}");
    expect(bodyFontUpliftCss([])).toBe("");
  });
});

describe("窗口6 r2 fixer · 9 款壳层触区 ≥40 接线(登记清单逐款钉死)", () => {
  it("brave-path:.bvp-btn 触区 + .bvp-chip/.bvp-btn-sm 字号(85×30/68×30、chips 13 → 达标)", () => {
    const s = src("brave-path/index.ts");
    expect(s).toContain('touchUpliftCss([".bvp-btn"])');
    expect(s).toContain('bodyFontUpliftCss([".bvp-chip", ".bvp-btn-sm"])');
  });

  it("adventure-king:.ak-open 触区 + .ak-tip 字号(高 38、13px → 达标)", () => {
    const s = src("adventure-king/index.ts");
    expect(s).toContain('touchUpliftCss([".ak-open"])');
    expect(s).toContain('bodyFontUpliftCss([".ak-tip"])');
  });

  it("alien-seek:.as-open/.as-back 触区 + .as-tip/.as-pad-t/.als-name 字号", () => {
    const s = src("alien-seek/index.ts");
    expect(s).toContain('touchUpliftCss([".as-open", ".as-back"])');
    expect(s).toContain('bodyFontUpliftCss([".as-tip", ".as-pad-t", ".als-name"])');
  });

  it("brick-break:.brk-open/.brk-back 触区(高 37 → 达标)", () => {
    expect(src("brick-break/index.ts")).toContain('touchUpliftCss([".brk-open", ".brk-back"])');
  });

  it("mole-pop:纯字面量落地(样式表禁插值约定),数值与 kit 常量对账", () => {
    const s = src("mole-pop/index.ts");
    expect(s).toContain(`.mp-open, .mp-back { min-height: ${MIN_TOUCH_PX}px; }`);
  });

  it("box-hamster:bhVisualCss 产出 .bh-mode/.bh-btn 触区与 .bh-tag/.bh-tip 字号(排媒体查询后生效)", () => {
    const css = bhVisualCss();
    expect(css).toContain(`.bh-mode,.bh-btn{min-height:${MIN_TOUCH_PX}px;}`);
    expect(css).toContain(`.bh-tag,.bh-tip{font-size:${MIN_BODY_FONT_PX}px;}`);
    // 既有 14px 兜底不回退
    expect(css).toContain(".bh-chip,.bh-btn{font-size:14px;}");
  });

  it("balloon-pop:.blp-open/.blp-back 触区(高 37 → 达标)", () => {
    expect(src("balloon-pop/index.ts")).toContain('touchUpliftCss([".blp-open", ".blp-back"])');
  });

  it("bubble-pop:bpVisualCss 产出 .bbp-open/.bbp-back 触区;宽屏 .bp-cell 36px 热区一个像素不动", () => {
    const css = bpVisualCss();
    expect(css).toContain(`.bbp-open,.bbp-back{min-height:${MIN_TOUCH_PX}px;}`);
    // 触区抬升不许波及棋盘格热区既有规则
    expect(css).not.toContain(".bp-cell{min-height");
  });

  it("bubble-aim:.ba-btn/.bba-mode/.bba-swap 触区(含 44px 最小宽)+ .ba-msg 字号", () => {
    const s = src("bubble-aim/index.ts");
    expect(s).toContain('touchUpliftCss([".ba-btn", ".bba-mode", ".bba-swap"], { minWidth: true })');
    expect(s).toContain('bodyFontUpliftCss([".ba-msg"])');
  });
});
