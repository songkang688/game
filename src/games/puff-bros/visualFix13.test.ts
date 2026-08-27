/**
 * puff-bros · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * S6:收集物糖果从「17px 裸 emoji」升级为自绘四型
 *     (圆糖 + 纸角 / 棒棒糖白螺旋 + 木棍 / 纸杯裙线 + 奶油双弧 / 三丸串 + 竹签),
 *     统一 bubbleSkin 同源左上白高光 + 1.5px 深 20% 描边。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import {
  CANDY_KINDS,
  DIZZY_ORBIT_MS,
  PB_CANDY,
  dizzyPhase,
  drawCandy,
  drawDizzyStars,
  drawEventSpark,
  type SparkKind,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

function ctx(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

describe("puff-bros · 修复员 S6 · 糖果四型自绘", () => {
  it("四型糖果都画得动不抛(圆糖 / 棒棒糖 / 纸杯 / 团子)", () => {
    for (const kind of CANDY_KINDS) {
      expect(() => drawCandy(ctx(), kind, 100, 80), kind).not.toThrow();
    }
  });

  it("糖果轮换序恰是 4 型且互不重复(与 1.2 的 4 只 emoji 一一对位)", () => {
    expect(CANDY_KINDS.length).toBe(4);
    expect(new Set(CANDY_KINDS).size).toBe(4);
  });

  it("糖果配色都是合法色值,主色互不重复(收集物剪影 + 色两通道识别)", () => {
    const mains = [PB_CANDY.wrap, PB_CANDY.lolly, PB_CANDY.cup];
    for (const c of [...mains, PB_CANDY.stick, PB_CANDY.cream, ...PB_CANDY.dango]) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(new Set(mains).size).toBe(mains.length);
  });

  it("index.ts 糖果收集物不再走 emojiAt 字形,改走 drawCandy", () => {
    const src = read("index.ts");
    expect(src).toContain("drawCandy(");
    expect(src).not.toContain("CANDY_ART");
    // 棒棒糖 / 纸杯 / 团子字形全退场;🍬 仅剩事件粒子表(G5 同批换)与 HUD DOM 计数字
    for (const e of ["🍭", "🧁", "🍡"]) expect(src).not.toContain(e);
    expect((src.match(/🍬/g) ?? []).length).toBeLessThanOrEqual(2);
  });
});

describe("puff-bros · 修复员 G5 · 眩晕星与事件小图", () => {
  const SPARKS: SparkKind[] = ["bubble", "gust", "cloud", "spark", "swirl", "twinkle", "candy", "star"];

  it("眩晕星画得动不抛;两颗相位差半圈 = 300ms(周期 600ms)", () => {
    expect(() => drawDizzyStars(ctx(), 0, -20, 9, 1234, false)).not.toThrow();
    expect(DIZZY_ORBIT_MS).toBe(600);
  });

  it("眩晕星 reduced 定格:任意毫秒相位恒 0;常规档 300ms 恰好转过半圈", () => {
    expect(dizzyPhase(0, true)).toBe(0);
    expect(dizzyPhase(450, true)).toBe(0);
    expect(dizzyPhase(150, false)).toBeGreaterThan(0);
    expect(dizzyPhase(300, false)).toBeCloseTo(Math.PI, 6);
  });

  it("八种事件小图都画得动不抛(泡/风/云/星屑/旋涡/晕星/糖/大星)", () => {
    for (const kind of SPARKS) {
      expect(() => drawEventSpark(ctx(), kind, 100, 80, 9), kind).not.toThrow();
      expect(() => drawEventSpark(ctx(), kind, 2, 2, 1), kind).not.toThrow();
    }
  });

  it("index.ts 眩晕「××」字形与 13 只飘字 emoji 全部退场,emojiAt 助手退休", () => {
    const src = read("index.ts");
    expect(src).not.toContain('fillText("××"');
    expect(src).toContain("drawDizzyStars(");
    expect(src).toContain("drawEventSpark(");
    expect(src).not.toContain("emojiAt(g");
    for (const e of ["🌀", "💫", "😵", "🌟", "☁️"]) expect(src).not.toContain(e);
    // 🍬 只剩 HUD DOM 计数文案一处(粒子表已换矢量)
    expect((src.match(/🍬/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});
