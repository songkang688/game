/**
 * 接住小水果 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 水果主体全自绘(canvas 里不许再出现 emoji 直出的水果);
 * ② kit 水果三停渐变 + 1.5px 描边 + 落影色定义齐全;
 * ③ 双人半屏名牌是自绘小花 / 小星标(两通道可分:形状 + 位置)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FRUIT_GRADIENT_STOPS,
  FRUIT_OUTLINE_PX,
  FRUIT_SHADOW_COLOR,
  FRUIT_KINDS,
  fruitOutline
} from "../../art/kit/fruit";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 匹配 fillText 第一个实参里直接写 emoji 的调用(HUD 文案模板串不算) */
const EMOJI_FILLTEXT = /fillText\(\s*["'`][^"'`]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("窗口7 R1 · fruit-catch 专项①:水果不许 emoji 直出", () => {
  it("index.ts 的 canvas 调用里没有 emoji 直出", () => {
    expect(EMOJI_FILLTEXT.test(SRC)).toBe(false);
  });

  it("场上水果走 kit 剪影(index.ts 引用 FruitKitKind)", () => {
    expect(SRC.includes('from "../../art/kit/fruit"')).toBe(true);
  });
});

describe("窗口7 R1 · fruit-catch 专项②:收集物体积三件套", () => {
  it("三停渐变:kit 渐变停靠点 ≥ 3 且首停提亮、末停压暗", () => {
    expect(FRUIT_GRADIENT_STOPS.length).toBeGreaterThanOrEqual(3);
    expect(FRUIT_GRADIENT_STOPS[0]).toBeGreaterThan(0);
    expect(FRUIT_GRADIENT_STOPS[FRUIT_GRADIENT_STOPS.length - 1]).toBeLessThan(0);
  });

  it("描边 ≥ 1.5px 且落影色是半透明暗色", () => {
    expect(FRUIT_OUTLINE_PX).toBeGreaterThanOrEqual(1.5);
    expect(FRUIT_SHADOW_COLOR).toMatch(/^rgba\(/);
  });

  it("六款剪影两两互异(同半径外接点集不同)", () => {
    const keys = FRUIT_KINDS.map((k) => JSON.stringify(fruitOutline(k, 20)));
    expect(new Set(keys).size).toBe(FRUIT_KINDS.length);
  });
});

describe("窗口7 R1 · fruit-catch 专项③:双人名牌两通道可分", () => {
  it("朵朵配自绘小花、星星配自绘星标(形状通道),各占半屏(位置通道)", () => {
    expect(SRC).toMatch(/drawFcFlower\(c2d,\s*W \* 0\.25/);
    expect(SRC).toMatch(/drawFcStarBadge\(c2d,\s*W \* 0\.75/);
  });
});
