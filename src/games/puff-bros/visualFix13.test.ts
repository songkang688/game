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
import { CANDY_KINDS, PB_CANDY, drawCandy } from "./visual13";

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

  it("index.ts 糖果不再走 emojiAt 字形,改走 drawCandy;糖果 emoji 全部退场", () => {
    const src = read("index.ts");
    expect(src).toContain("drawCandy(");
    expect(src).not.toMatch(/emojiAt\(g, CANDY/);
    for (const e of ["🍬", "🍭", "🧁", "🍡"]) expect(src).not.toContain(e);
  });
});
