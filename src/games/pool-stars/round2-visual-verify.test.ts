/**
 * 星星台球 · 1.3 第 2 轮 A 档复验契约。
 *
 * 深度走查「角色特写」在本款落在球体:球直径是极小尺寸下花印/星印退化形
 * 能否被认出的前提。tableLayout 是纯函数,把 320 / 360 / 768 三档视口的
 * 球径 ≥ MIN_BALL_PX 钉死;≥380px 视口的正文字号 =14px 也一并钉住
 * (＜380 档现值 13px 已另行立案交 C 档,不在这里锁)。
 */
import { describe, expect, it } from "vitest";
import { MIN_BALL_PX, tableLayout } from "./view";

describe("pool-stars · 球径与正文字号的布局契约（r2 复验加固）", () => {
  it("320 / 360 / 768 三档视口球直径都 ≥ MIN_BALL_PX", () => {
    expect(MIN_BALL_PX).toBeGreaterThanOrEqual(14);
    for (const w of [320, 360, 768]) {
      expect(tableLayout(w).ballPx, `视口 ${w}px 球径不足`).toBeGreaterThanOrEqual(MIN_BALL_PX);
    }
  });

  it("≥380px 视口正文字号 14px(与 .ps-tip 的 CSS 提级口径一致)", () => {
    for (const w of [380, 414, 768]) {
      expect(tableLayout(w).fontPx, `视口 ${w}px 字号回退`).toBeGreaterThanOrEqual(14);
    }
  });
});
