/**
 * 188 关壳层 · 1.3 手机端显示修复的结构钉(只增不减)。
 *
 * 手机实拍病灶(格斗塔 / 台球 / 果果合成,360×740 上下的竖屏):
 *  1. 选关地图比舞台高,底部被裁且划不动——根子是 `.game-stage{overflow:hidden}`
 *     (styles.css,已改成竖向可滚)+ 这里的 `.l99-stage-wrap` 定高只裁;
 *  2. 章节页签横滑 + 藏滚动条(scrollbar-width:none),看起来像末个页签被切掉;
 *  3. 关内 HUD(选关 / 攻略 / 管理员跳关)一叠吃掉小半屏,玩法区被顶出视口。
 *
 * 修法全在布局层:玩法、关卡数值、存档 key、胜负规则一个字没动。
 * 这里逐条钉住新口径,防止哪次重构又改回「只裁不滚」。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "level99.ts"), "utf8");

describe("level99 壳层 · 1.3 手机端布局钉", () => {
  it("章节页签换行铺开:flex-wrap:wrap,不再横滑 + 藏滚动条", () => {
    expect(SRC).toMatch(/\.l99-tabs\{[^}]*flex-wrap:wrap/);
    expect(SRC).not.toMatch(/\.l99-tabs\{[^}]*overflow-x:auto/);
    expect(SRC).not.toMatch(/\.l99-tabs\{[^}]*scrollbar-width:none/);
  });

  it("整棵关卡树排成 flex 列并铺满舞台:.l99-wrap flex 列 + min-height:100%", () => {
    expect(SRC).toMatch(/\.l99-wrap\{[^}]*display:flex/);
    expect(SRC).toMatch(/\.l99-wrap\{[^}]*flex-direction:column/);
    expect(SRC).toMatch(/\.l99-wrap\{[^}]*min-height:100%/);
  });

  it("view 挂了 .l99-view 类,且有对应的填满规则", () => {
    expect(SRC).toContain('view.className = "l99-view"');
    expect(SRC).toMatch(/\.l99-view\{[^}]*flex:1 0 auto/);
  });

  it("关卡卡 .l99-stage-wrap 排成 flex 列并至少填满剩余高度,玩法区 .l99-stage 跟着长", () => {
    expect(SRC).toMatch(/\.l99-stage-wrap\{[^}]*display:flex;flex-direction:column;flex:1 0 auto/);
    expect(SRC).toMatch(/\.l99-stage\{[^}]*flex:1 0 auto/);
  });

  it("740px 上下的竖屏手机有矮屏压缩档:只压内边距和间距,热区与字号不动", () => {
    const at = SRC.indexOf("@media (max-height:740px)");
    expect(at, "缺少 max-height:740px 矮屏档").toBeGreaterThanOrEqual(0);
    const block = SRC.slice(at, SRC.indexOf("}\n}", at));
    // 只许出现留白类属性,禁止顺手动字号 / 热区
    expect(block).not.toContain("font-size");
    expect(block).not.toContain("min-height");
    expect(block).not.toContain("min-width");
  });

  it("prefers-reduced-motion 档保持在场", () => {
    expect(SRC).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
