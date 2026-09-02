/**
 * 数字花园 · 1.3 第 1 轮 C 档修复契约。
 *
 * B 档 TOP10 #10（建议·密度）：`.mg-wrap` 盘外留白补两颗淡星点静饰——
 * 12% 18% 一颗 3px 淡金、88% 72% 一颗 2px 淡紫,纯 background-image,
 * 零 DOM、零动效;且「只加这两颗,别铺满」(顶部原有 4 颗小星点不变)。
 */
import { describe, expect, it } from "vitest";
import { MG_CSS } from "./index";

function cssRule(sel: string): string {
  const re = new RegExp(sel.replace(/[.[\]]/g, "\\$&") + "\\{[^}]*\\}");
  const m = re.exec(MG_CSS);
  if (!m) throw new Error(`规则没找到:${sel}`);
  return m[0];
}

describe("merge-2048 · 盘外星点静饰(B 档 #10 修复)", () => {
  it("两颗规格里钉死的星点都在 .mg-wrap 的背景栈里", () => {
    const wrap = cssRule(".mg-wrap");
    expect(wrap).toContain("radial-gradient(circle 3px at 12% 18%,#FFD75E14 0 60%,transparent 61%)");
    expect(wrap).toContain("radial-gradient(circle 2px at 88% 72%,#D0A9F512 0 60%,transparent 61%)");
  });

  it("星点列在不透明线性渐变之前,层叠上真的看得见", () => {
    const wrap = cssRule(".mg-wrap");
    const gold = wrap.indexOf("12% 18%");
    const lilac = wrap.indexOf("88% 72%");
    const base = wrap.indexOf("linear-gradient(180deg,#EFE4FB");
    expect(gold).toBeGreaterThan(-1);
    expect(lilac).toBeGreaterThan(-1);
    expect(base).toBeGreaterThan(gold);
    expect(base).toBeGreaterThan(lilac);
  });

  it("克制条款:静饰只加这两颗,radial 总数恰为 6(顶部原 4 + 新 2)", () => {
    const wrap = cssRule(".mg-wrap");
    expect((wrap.match(/radial-gradient/g) ?? []).length).toBe(6);
    // 零动效:星点不进任何 animation 声明
    expect(wrap).not.toContain("animation");
  });
});
