/**
 * 彩虹手牌 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:局内 DOM 十处 13px(.hh-banner/.hh-foe-name/
 * .hh-count/.hh-bubble/.hh-catch 按钮/.hh-deck-count/.hh-say/.hh-keys/.hh-chip/
 * .hh-rank-note)提到宪法 14px 下限;420px 媒体查询里把字号压回 13px 的两处覆写
 * (.hh-foe-name/.hh-keys)一并撤掉。溢出安全:.hh-foe-name / .hh-rank-name 自带
 * nowrap+ellipsis,其余为居中可换行或胶囊自撑宽。
 *
 * 书面登记取舍(A 档预判口径):.hh-card-corner / .hh-card-corner2 卡面角标保持 13px——
 * 它是卡面印刷美术的一部分(对应实体牌角标比例),与中央大符号构成双保险,不属于
 * 宪法「HUD 数字、按钮字」范畴;再放大会压进中央白椭圆的白底区,白字靠投影撑对比,
 * 反而更难读。取舍详情见 docs/qa/1.3-window3-round3-fixer.md 降级申请一节。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 某选择器全部声明块(含媒体查询里的二次声明)中出现的 font-size(px) */
function fontSizesOf(selector: string): number[] {
  const re = new RegExp(`\\${selector}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "g");
  const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
  expect(sizes.length, `${selector} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
  return sizes;
}

const LIFTED = [
  ".hh-banner",
  ".hh-foe-name",
  ".hh-count",
  ".hh-bubble",
  ".hh-catch",
  ".hh-deck-count",
  ".hh-say",
  ".hh-keys",
  ".hh-chip",
  ".hh-rank-note",
];

describe("fix(visual-r3) N-R3-01:局内 DOM 字号 ≥14px", () => {
  it("十处原 13px 选择器(含媒体查询二次声明)全部 ≥14px", () => {
    for (const sel of LIFTED) {
      for (const px of fontSizesOf(sel)) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("420px 媒体查询不再把 .hh-foe-name / .hh-keys 的字号压回 14 以下(64px 名宽省略号兜底仍在)", () => {
    const mq = src.slice(src.indexOf("@media (max-width:420px)"));
    const block = mq.slice(0, mq.indexOf("\n}") + 2);
    expect(/\.hh-foe-name\{[^}]*font-size/.test(block)).toBe(false);
    expect(/\.hh-keys\{[^}]*font-size/.test(block)).toBe(false);
    expect(block).toContain(".hh-foe-name{max-width:64px;}");
  });

  it("溢出兜底还在:对手名与排名行名字 nowrap+ellipsis", () => {
    expect(/\.hh-foe-name\{[^}]*text-overflow:ellipsis/.test(src)).toBe(true);
    expect(/\.hh-rank-name\{[^}]*text-overflow:ellipsis/.test(src)).toBe(true);
  });

  it("书面取舍钉死:卡面角标 .hh-card-corner/.hh-card-corner2 保持 13px 印刷比例,其余无 <14px", () => {
    expect(fontSizesOf(".hh-card-corner")).toEqual([13]);
    expect(fontSizesOf(".hh-card-corner2")).toEqual([13]);
    const rest = src.replace(/\.hh-card-corner2?\{[^}]*\}/g, "");
    for (const m of rest.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1]), "卡面角标之外的 DOM 文字应 ≥14px").toBeGreaterThanOrEqual(14);
    }
  });
});
