/**
 * 扫雷花园 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项①：emoji 只许活在图标的 <title>（无障碍口径），shapes 里一颗都不许有；
 *  ② 专项②：盛开花 = 花瓣暗描边 + 内层高光瓣 + 花芯描边 + 花芯高光点，四层体积俱全；
 *  ③ 花的三档(破土/花苞/盛开)形状清单两两不同——三档不是换色贴皮。
 */
import { describe, expect, it } from "vitest";
import { cloverSVG, flagSVG, flowerSVG, signSVG, wateringCanSVG, wreathSVG, type ArtIcon } from "./art";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

const ICONS: Array<[string, ArtIcon]> = [
  ["flower0", flowerSVG(0)],
  ["flower1", flowerSVG(1)],
  ["flower2", flowerSVG(2)],
  ["flag", flagSVG()],
  ["clover", cloverSVG()],
  ["sign", signSVG()],
  ["wreath", wreathSVG()],
  ["wateringCan", wateringCanSVG()],
];

describe("专项①:emoji 只在 <title>,不在形状里", () => {
  it("每个图标的 shapes 属性值都不含 emoji 码点", () => {
    for (const [name, icon] of ICONS) {
      for (const shape of icon.shapes) {
        for (const [attr, value] of Object.entries(shape.attrs)) {
          expect(EMOJI_RE.test(value), `${name}.${shape.tag}[${attr}] 混进了 emoji`).toBe(false);
        }
      }
    }
  });
});

describe("专项②:盛开花的四层体积", () => {
  it("stage 2 有 5 片描边花瓣 + 5 片内层高光瓣 + 描边花芯 + 花芯高光点", () => {
    const icon = flowerSVG(2);
    const petals = icon.shapes.filter((s) => s.attrs["data-part"] === "petal");
    expect(petals.length, "外层花瓣 5 片").toBe(5);
    for (const p of petals) expect(p.attrs.stroke, "花瓣要有描边").toBeTruthy();
    const inner = icon.shapes.filter((s) => s.tag === "ellipse" && s.attrs.fill === "#FFF1F6");
    expect(inner.length, "内层高光瓣 5 片").toBe(5);
    const core = icon.shapes.find((s) => s.tag === "circle" && s.attrs.stroke === "#E0A94A");
    expect(core, "花芯要有描边").toBeTruthy();
    const shine = icon.shapes.find((s) => s.tag === "circle" && s.attrs.fill === "#FFF3C9");
    expect(shine, "花芯要有高光点").toBeTruthy();
  });
});

describe("三档花与图标互异", () => {
  it("破土/花苞/盛开的形状清单两两不同", () => {
    const dump = (i: ArtIcon): string => JSON.stringify(i.shapes);
    const seen = new Set([dump(flowerSVG(0)), dump(flowerSVG(1)), dump(flowerSVG(2))]);
    expect(seen.size).toBe(3);
  });

  it("八个图标的形状清单两两不同,且都至少 3 个图元(不是草稿单圆)", () => {
    const seen = new Set<string>();
    for (const [name, icon] of ICONS) {
      expect(icon.shapes.length, `${name} 图元太少`).toBeGreaterThanOrEqual(3);
      seen.add(JSON.stringify(icon.shapes));
    }
    expect(seen.size).toBe(ICONS.length);
  });
});
