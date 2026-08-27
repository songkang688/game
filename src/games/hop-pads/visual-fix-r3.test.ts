/**
 * 荷叶跳跳 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:结算卡(250px 画布,无 CSS 放大)统计行 12px 与
 * 「完美率」注脚 11px 提到宪法 14px 下限(统计行加 maxWidth 兜底);DOM 提示行
 * .hp-tip 13px→14px(居中可换行,无溢出通道)。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const artSrc = readFileSync(fileURLToPath(new URL("./art.ts", import.meta.url)), "utf8");

/** 源码里所有字面量 ctx.font 的像素值(bold/italic/数字字重前缀都认) */
function fontPxLiterals(code: string): number[] {
  return [...code.matchAll(/font\s*=\s*[`"'](?:bold\s+|italic\s+|\d00\s+)?(\d+(?:\.\d+)?)px/g)].map(
    (m) => Number(m[1]),
  );
}

describe("fix(visual-r3) N-R3-01:结算卡画布与提示行字号 ≥14px", () => {
  it("index.ts / art.ts 字面量 ctx.font 无一处 <14px(原 700 12px / 700 11px 已提到 14px)", () => {
    for (const px of [...fontPxLiterals(src), ...fontPxLiterals(artSrc)]) {
      expect(px, "画布文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });

  it("结算卡统计行带 maxWidth 兜底,长数字也不捅出 250px 卡片", () => {
    expect(src).toContain("`站住 ${viz.hops} 座 · 最远第 ${viz.far} 座`, 12, 18, 226");
  });

  it("DOM 的 .hp-tip 全部声明 ≥14px", () => {
    const sizes = [...src.matchAll(/\.hp-tip\{[^}]*font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(14);
  });

  it("CSS 里不再有任何 <14px 的 font-size 声明", () => {
    for (const m of src.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1]), "DOM 文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });
});
