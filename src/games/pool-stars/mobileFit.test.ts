/**
 * 星星台球 · 1.3 手机端「球桌按舞台剩余高度缩放」契约。
 *
 * 手机实拍病灶:竖屏 360×740 上下,关内 HUD(选关 / 攻略 / 管理员跳关)吃掉
 * 小半屏后,竖版球桌仍按老口径画满 560px 高——整张桌被拉成瘦高竖条且下半截
 * 被裁掉。根子是 `tableLayout` 只看宽度,从不问「舞台还剩多高」。
 *
 * 新口径:`tableLayout(width, availHeight?)`
 *  - 不传第二参:与 1.2 完全同款(竖版封顶 MAX_VERTICAL_PX、球径 ≥ MIN_BALL_PX),
 *    320/360/768 的既有断言原样成立;
 *  - 传了:剩余高度是硬约束,球桌高绝不超过它(下限 MIN_TABLE_PX,再挤靠舞台滚动)。
 */
import { describe, expect, it } from "vitest";
import {
  MAX_VERTICAL_PX,
  MIN_BALL_PX,
  MIN_TABLE_PX,
  MIN_TOUCH_PX,
  tableLayout,
} from "./view";

describe("tableLayout(width, availHeight) · 剩余高度是硬约束", () => {
  it("360px 视口 + 只剩 280px 高:球桌高 ≤ 280,不再顶出屏幕", () => {
    const lay = tableLayout(360, 280);
    expect(lay.vertical).toBe(true);
    expect(lay.cssH).toBeLessThanOrEqual(280);
    expect(lay.cssW).toBeLessThanOrEqual(360 - 16);
  });

  it("360×640 竖屏回归:量到 380px 剩余高度时,整张桌完整落进舞台", () => {
    const lay = tableLayout(360, 380);
    expect(lay.vertical).toBe(true);
    expect(lay.cssH).toBeLessThanOrEqual(380);
    expect(lay.cssW).toBeLessThanOrEqual(360 - 16);
  });

  it("剩余高度再挤也有下限:100px 的极端值只压到 MIN_TABLE_PX,剩下靠舞台滚动", () => {
    const lay = tableLayout(360, 100);
    expect(lay.cssH).toBeGreaterThanOrEqual(MIN_TABLE_PX - 1e-6);
    expect(lay.cssH).toBeLessThanOrEqual(MIN_TABLE_PX + 1e-6);
  });

  it("横版同样吃高度约束:1024px 宽 + 200px 高,桌高 ≤ 200", () => {
    const lay = tableLayout(1024, 200);
    expect(lay.vertical).toBe(false);
    expect(lay.cssH).toBeLessThanOrEqual(200);
  });

  it("剩余高度充裕时与老口径一致:竖版仍封顶 MAX_VERTICAL_PX", () => {
    const roomy = tableLayout(360, 2000);
    const legacy = tableLayout(360);
    expect(roomy.cssH).toBe(legacy.cssH);
    expect(roomy.cssH).toBeLessThanOrEqual(MAX_VERTICAL_PX);
  });
});

describe("tableLayout(width) · 不传第二参保持 1.2 老契约", () => {
  it("320/360/768 球径 ≥ MIN_BALL_PX,一档不降", () => {
    for (const w of [320, 360, 768]) {
      expect(tableLayout(w).ballPx, `视口 ${w}px 球径不足`).toBeGreaterThanOrEqual(MIN_BALL_PX);
    }
  });

  it("竖版封顶仍是 MAX_VERTICAL_PX,热区常量没被顺手改小", () => {
    expect(tableLayout(360).cssH).toBeLessThanOrEqual(MAX_VERTICAL_PX);
    expect(MIN_TOUCH_PX).toBeGreaterThanOrEqual(44);
    expect(MIN_BALL_PX).toBeGreaterThanOrEqual(14);
  });
});
