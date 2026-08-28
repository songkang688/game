/**
 * 三人组 r9-B(d909) · N-34 / N-35 续:拼写关与全选关的矮横屏宽档三段式。
 *
 * 先合版已经上了一套「画面在左、内容在右」的双栏，实测把拼写关从裁 450 收到裁 198、
 * 全选关从裁 179 收到裁 67，但两关都还没过线：
 *  - 拼写关 915×412：四枚声调票 + 「🚂 发车」共 5 件掉在裁切线以下；
 *  - 全选关 915×412：「✅ 就挑这些」漏出裁切线 17px。
 * 两关同一个原因——右栏一列要竖着叠四层，`.pyt-go` / `.pk-go` 的 sticky
 * 又钉在 `.l99-stage{overflow:hidden}` 的下沿上，不起作用。
 *
 * 修法：矮横屏且够宽（≥760）时收起装饰用的火车画面，把票排让到宽栏并竖着吃满整格，
 * 车厢 / 拼音 / 发车区（标题 / 提示 / 交卷区）收进右侧固定栏。
 * 字号、热区、题库、判定、存档 key 一律不动；限时关（135 族）走的是 quiz 皮，本文件不碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PINYIN_FONT_MIN } from "./spell";

const spell = readFileSync(fileURLToPath(new URL("./spell.ts", import.meta.url)), "utf8");
const pickAll = readFileSync(fileURLToPath(new URL("./pickAll.ts", import.meta.url)), "utf8");
const scene = readFileSync(fileURLToPath(new URL("./scene.ts", import.meta.url)), "utf8");
const timed = readFileSync(fileURLToPath(new URL("./timed.ts", import.meta.url)), "utf8");

const WIDE = "@media (max-height:500px) and (min-width:760px){";

function wideBlock(src: string): string {
  const at = src.lastIndexOf(WIDE);
  expect(at, "缺矮横屏宽档媒体查询").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at + WIDE.length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at + WIDE.length, i);
    }
  }
  throw new Error("矮横屏宽档媒体查询没有闭合");
}

describe("N-34/N-35 续 · 矮横屏宽档命中面", () => {
  const hit = (w: number, h: number): boolean => h <= 500 && w >= 760;

  it("只有 915×412 这一档命中,竖屏与大屏都不命中", () => {
    expect(hit(915, 412)).toBe(true);
    expect(hit(390, 844)).toBe(false);
    expect(hit(412, 915)).toBe(false);
    expect(hit(1024, 768)).toBe(false);
    expect(hit(1280, 800)).toBe(false);
  });

  it("窄一点的矮横屏仍走先合版那套画面在左的双栏,不被顶掉", () => {
    expect(hit(640, 412)).toBe(false);
    for (const src of [spell, pickAll]) {
      expect(src).toContain("@media (max-height:500px) and (min-width:640px){");
      // 宽档那段排在双栏之后才能覆盖
      expect(src.indexOf("@media (max-height:500px) and (min-width:640px){")).toBeLessThan(src.lastIndexOf(WIDE));
    }
  });
});

describe("N-34 续 · 拼写关票排独占宽栏", () => {
  const block = (): string => wideBlock(spell);

  it("票排搬到宽栏并竖着吃满整格", () => {
    expect(block()).toContain(".pyt-yard{grid-column:1;grid-row:2 / -1;");
    expect(block()).toContain("grid-template-columns:minmax(0,1fr) minmax(232px,300px);");
  });

  it("车厢 / 拼音 / 发车区收进右侧固定栏", () => {
    const b = block();
    expect(b).toContain(".pyt-slots{grid-column:2;grid-row:2;}");
    expect(b).toContain(".pyt-view{grid-column:2;grid-row:3;}");
    expect(b).toContain(".pyt-say-row{grid-column:2;grid-row:4;}");
    expect(b).toContain(".pyt-bottom{grid-column:2;grid-row:5;align-self:start;}");
  });

  it("收起的只有拼写关自己那块装饰画面,限时关 / 全选关的画面各管各的", () => {
    expect(block()).toContain(".pyt-spell>.pyt-scene{display:none;}");
    expect(block()).not.toContain(" .pyt-scene{display:none;}");
    // scene.ts 只被读来核对,本轮一个字都没改
    expect(scene).toContain("@media (max-height:500px){.pyt-scene{height:72px;}}");
    expect(timed).not.toContain("display:none");
  });

  it("票排上限跟视口高联动,再挤也留 64px 并自滚", () => {
    expect(block()).toContain("max-height:calc(100dvh - 200px);min-height:64px;");
    expect(spell).toContain(".pyt-yard{min-height:0;overflow-y:auto;}");
    // 412 高的实档:上限 212px,恰好等于舞台给拼写关的净余量
    expect(412 - 200).toBe(212);
  });

  it("字号下限与热区一格不让", () => {
    expect(block()).not.toContain("font-size");
    expect(block()).not.toContain("min-width:");
    expect(PINYIN_FONT_MIN).toBe(20);
    expect(spell).toContain(".pyt-view{min-height:28px;font-size:${PINYIN_FONT_MIN + 6}px;}");
  });
});

describe("N-35 续 · 全选关票排独占宽栏", () => {
  const block = (): string => wideBlock(pickAll);

  it("票排搬到宽栏,标题 / 提示 / 交卷区收进右侧固定栏", () => {
    const b = block();
    expect(b).toContain("grid-template-columns:minmax(0,1fr) minmax(232px,300px);");
    expect(b).toContain(".pk-chips{grid-column:1;grid-row:2 / -1;");
    expect(b).toContain(".pk-title{grid-column:2;grid-row:2;}");
    expect(b).toContain(".pk-hint{grid-column:2;grid-row:3;}");
    expect(b).toContain(".pk-say-row{grid-column:2;grid-row:4;}");
    expect(b).toContain(".pk-bottom{grid-column:2;grid-row:5;align-self:start;}");
  });

  it("收起的只有全选关自己那块装饰画面", () => {
    expect(block()).toContain(".pk-wrap>.pyt-scene{display:none;}");
    expect(block()).not.toContain(" .pyt-scene{display:none;}");
  });

  it("票排上限跟视口高联动,再挤也留 64px 并自滚", () => {
    expect(block()).toContain("max-height:calc(100dvh - 200px);min-height:64px;overflow-y:auto;");
  });

  it("字号与热区一格不让", () => {
    expect(block()).not.toContain("font-size");
    expect(pickAll).toContain(".pk-chip{font-size:17px;min-width:64px;min-height:50px;");
  });
});

describe("N-34/N-35 续 · 只改排版,不碰题库与判定", () => {
  it("两个关型的题目生成与判定函数原样", () => {
    expect(spell).toContain("judgeSpell");
    expect(pickAll).toContain("export function runPickAll");
    for (const src of [spell, pickAll]) {
      const block = wideBlock(src);
      // 宽档那段全是排版属性,没有一条落到 JS 上
      expect(block).not.toContain("function");
      expect(block).not.toContain("localStorage");
    }
  });
});
