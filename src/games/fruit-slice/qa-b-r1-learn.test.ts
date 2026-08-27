/**
 * 窗口4 · 档B · 第 1 轮学习优化员 —— 水果切切乐的落地覆盖。
 *
 * 落地内容:选关地图的排版公式原本埋在 `index.ts` 的 draw 函数里,
 * 测试想验「360px 排不排得下」只能自己抄一遍公式——抄一遍就等于什么也没测。
 * 现在抽成 `logic.ts` 的纯函数 `mapLayout(w, h, size)`,窄屏基线直接问真代码。
 */
import { describe, expect, it } from "vitest";
import { readGameSources } from "../adventure-king/qaAudit";
import { TOTAL_ROUNDS, mapLayout, themeSize } from "./logic";

const SOURCES = readGameSources("fruit-slice");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;

/** 四个断点:窄屏、常见手机、平板、桌面 */
const SCREENS: Array<[number, number, string]> = [
  [320, 568, "320 极窄"],
  [360, 640, "360 窄屏"],
  [375, 667, "375 常见手机"],
  [768, 1024, "768 平板"],
  [1280, 800, "1280 桌面"],
];

describe("档B R1 落地 · 水果切切乐 · 选关地图排版抽成纯函数", () => {
  it("index.ts 真的改用了 mapLayout,公式不再有第二份", () => {
    expect(INDEX.text).toContain("const layout = mapLayout(w, h, size);");
    expect(INDEX.text).not.toContain("const nr = Math.max(13, Math.min(28,");
  });

  it("十二个果园在五种屏宽上都排得下:节点不出界、不重叠", () => {
    for (const [w, h, label] of SCREENS) {
      for (let ci = 0; ci < 12; ci++) {
        const size = themeSize(ci);
        const layout = mapLayout(w, h, size);
        expect(layout.spots).toHaveLength(size);
        for (const s of layout.spots) {
          expect(s.x - s.r, `${label} 第 ${ci + 1} 章左边出界`).toBeGreaterThanOrEqual(0);
          expect(s.x + s.r, `${label} 第 ${ci + 1} 章右边出界`).toBeLessThanOrEqual(w);
          expect(s.y - s.r, `${label} 第 ${ci + 1} 章上边出界`).toBeGreaterThanOrEqual(0);
          expect(s.y + s.r, `${label} 第 ${ci + 1} 章下边出界`).toBeLessThanOrEqual(h);
        }
        // 任意两点都不能叠在一起
        for (let i = 0; i < layout.spots.length; i++) {
          for (let j = i + 1; j < layout.spots.length; j++) {
            const a = layout.spots[i];
            const b = layout.spots[j];
            expect(
              Math.hypot(a.x - b.x, a.y - b.y),
              `${label} 第 ${ci + 1} 章第 ${i + 1} 与第 ${j + 1} 个节点叠住了`,
            ).toBeGreaterThan(a.r);
          }
        }
      }
    }
  });

  it("节点半径有下限 13、上限 28,再窄也点得到", () => {
    for (const [w, h] of SCREENS) {
      for (let ci = 0; ci < 12; ci++) {
        const layout = mapLayout(w, h, themeSize(ci));
        expect(layout.r).toBeGreaterThanOrEqual(13);
        expect(layout.r).toBeLessThanOrEqual(28);
      }
    }
  });

  it("排版是蛇形的:偶数行从左往右,奇数行折回来", () => {
    const layout = mapLayout(375, 667, 12);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(3);
    const row0 = layout.spots.slice(0, 4).map((s) => s.x);
    const row1 = layout.spots.slice(4, 8).map((s) => s.x);
    expect([...row0].sort((a, b) => a - b)).toEqual(row0);
    expect([...row1].sort((a, b) => b - a)).toEqual(row1);
  });

  it("一章 29~30 回合时列数自动加到 5", () => {
    expect(mapLayout(375, 667, 16).cols).toBe(4);
    expect(mapLayout(375, 667, 17).cols).toBe(5);
    expect(mapLayout(375, 667, 30).cols).toBe(5);
  });

  it("坏参数不会把地图算崩", () => {
    for (const bad of [0, -3, Number.NaN]) {
      const layout = mapLayout(360, 640, bad);
      expect(layout.spots).toHaveLength(1);
      expect(Number.isFinite(layout.r)).toBe(true);
    }
  });

  it("十二章加起来还是 188 回合(抽函数没把章节切分动坏)", () => {
    let sum = 0;
    for (let ci = 0; ci < 12; ci++) sum += mapLayout(360, 640, themeSize(ci)).spots.length;
    expect(sum).toBe(TOTAL_ROUNDS);
  });
});
