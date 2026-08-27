/**
 * 红蓝点点 · 第 2 轮监督修复 TOP9（B 档第 1 轮移交建议）：
 * 闯关场地氛围底——5 个淡色圆点错落铺在 .rbt-arena 上。
 *
 * 钉住三件事：
 *  ① 圆点确实铺上了：金蓝交替 5 个 radial-gradient，透明度 ≤ .12；
 *  ② 纯静态零动效：这条规则里没有 animation / transition / @keyframes；
 *  ③ 只动 background-image 长手：不写 background 简写（不许覆盖底色），
 *     不碰几何（width/height/padding/margin/border），热区零影响。
 */
import { describe, expect, it } from "vitest";
import { PASTEL, withAlpha } from "../../art/kit/palette";
import { CAMPAIGN_VISUAL_CSS } from "./skin";

/** 抠出氛围底那条规则的声明体（选择器带 .rbt-wrap 压过基础壳） */
function atmosphereRule(): string {
  const at = CAMPAIGN_VISUAL_CSS.indexOf(".rbt-wrap .rbt-arena {");
  expect(at, "找不到 .rbt-wrap .rbt-arena 氛围底规则").toBeGreaterThan(-1);
  return CAMPAIGN_VISUAL_CSS.slice(at, CAMPAIGN_VISUAL_CSS.indexOf("}", at));
}

describe("红蓝点点 R2 · TOP9 闯关场地氛围底", () => {
  it("5 个圆点金蓝交替，全部走调色板 token，透明度 ≤ .12", () => {
    const rule = atmosphereRule();
    expect([...rule.matchAll(/radial-gradient\(circle at /g)]).toHaveLength(5);
    // 金 3 蓝 2 交替；色值必须来自 PASTEL，不许手搓第二套色
    const gold = withAlpha(PASTEL.starGold, 0.1);
    const blue = withAlpha(PASTEL.blue, 0.08);
    expect([...rule.matchAll(new RegExp(gold.replace(/[().]/g, "\\$&"), "g"))]).toHaveLength(3);
    expect([...rule.matchAll(new RegExp(blue.replace(/[().]/g, "\\$&"), "g"))]).toHaveLength(2);
    // 所有 rgba 第四位 ≤ .12（收尾透明段的 0 除外）
    for (const m of rule.matchAll(/rgba\(\d+,\d+,\d+,(0(?:\.\d+)?)\)/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(0.12);
    }
  });

  it("纯静态零动效，且不碰几何与热区", () => {
    const rule = atmosphereRule();
    for (const banned of [
      "animation", "transition", "@keyframes",
      "width", "height", "padding", "margin", "border",
      "position", "inset", "top:", "left:", "z-index"
    ]) {
      expect(rule, `氛围底不许出现 ${banned}`).not.toContain(banned);
    }
    // 只写 background-image 长手，不许 background 简写覆盖底色
    expect(rule).toContain("background-image:");
    expect(rule).not.toMatch(/background\s*:/);
  });

  it("氛围底叠在点点样式之后、不改点点自身的果冻皮规则", () => {
    // 点点的果冻皮（radial 高光 + inset 描边）原样健在
    const dot = CAMPAIGN_VISUAL_CSS.slice(
      CAMPAIGN_VISUAL_CSS.indexOf(".rbt-arena .rbt-dot {"),
      CAMPAIGN_VISUAL_CSS.indexOf("}", CAMPAIGN_VISUAL_CSS.indexOf(".rbt-arena .rbt-dot {"))
    );
    expect(dot).toContain("radial-gradient(ellipse 130% 58%");
    expect(dot).toContain("inset 0 0 0 2px");
  });
});
