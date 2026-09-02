// 窗口3 · 第 1 轮监督修复:B 档 TOP10 之 9——三主题背景各补 1 层静态剪影饰。
// 钉住:晨光 2 朵云影 / 森林 3 座树影 / 星夜 5 颗星点,全部纯 background 多层、静态无动画。
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

function themeBlock(cls: string): string {
  const start = CSS.indexOf(`.mst-wrap.${cls}{`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = CSS.indexOf("}", start);
  return CSS.slice(start, end + 1);
}

describe("match-stars 三主题剪影饰层(B-9)", () => {
  it("晨光主题:2 朵柔云影(白色椭圆径向渐变,alpha ≤0.2)", () => {
    const block = themeBlock("mst-theme-dawn");
    const clouds = block.match(/radial-gradient\(ellipse[^)]*rgba\(255,255,255,\.\d+\)/g) ?? [];
    expect(clouds.length).toBe(2);
    for (const c of clouds) {
      const alpha = Number(`0${/rgba\(255,255,255,(\.\d+)\)/.exec(c)?.[1]}`);
      expect(alpha).toBeLessThanOrEqual(0.2);
    }
    // 原有主题渐变必须保留(叠层而不是替换)
    expect(block).toContain("linear-gradient(180deg,#FFF3D6,#FFE1EE 55%,#F3E8FF)");
  });

  it("森林主题:底部 3 座圆顶树影(深绿,alpha ≤0.12)", () => {
    const block = themeBlock("mst-theme-forest");
    const trees = block.match(/radial-gradient\(circle \d+px at \d+% 10\d%?[^)]*rgba\(44,102,70,(\.\d+)\)/g) ?? [];
    expect(trees.length).toBe(3);
    for (const t of trees) {
      const alpha = Number(`0${/rgba\(44,102,70,(\.\d+)\)/.exec(t)?.[1]}`);
      expect(alpha).toBeLessThanOrEqual(0.12);
    }
    expect(block).toContain("linear-gradient(180deg,#EAF9E4,#D8F3EA 55%,#E6F3FF)");
  });

  it("星夜主题:5 颗 2px 星点(白 20%,静态)", () => {
    const block = themeBlock("mst-theme-night");
    const stars = block.match(/radial-gradient\(circle at \d+% \d+%,rgba\(255,255,255,\.20\) 0 1px,transparent 2px\)/g) ?? [];
    expect(stars.length).toBe(5);
    expect(block).toContain("linear-gradient(180deg,#2E3161,#453C78 60%,#6C4E96)");
  });

  it("饰层全部静态:三主题块内不引入 animation/transition", () => {
    for (const cls of ["mst-theme-dawn", "mst-theme-forest", "mst-theme-night"]) {
      const block = themeBlock(cls);
      expect(block.includes("animation")).toBe(false);
      expect(block.includes("transition")).toBe(false);
    }
  });
});
