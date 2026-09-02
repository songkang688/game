/**
 * 欢乐斗地主 · 窗口 7 第 2 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档 R2 报告(docs/qa/1.3-window7-round2-tester.md)N-1 修后状态:
 * 大小王「大/小王」9px 缎带小字改图形徽记(花徽 vs 星徽),
 * 1.3 新增样式块 LDV_CSS 再无任何 <14px 字号;窄牌砍缎带的降级逻辑保留。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isJoker } from "./logic";
import { LDV_CSS, cardFaceArtHTML, kribbonBadgeSvg } from "./visual";

const jokerIds: number[] = [];
for (let id = 0; id < 56 && jokerIds.length < 2; id++) if (isJoker(id)) jokerIds.push(id);

describe("窗口7 R2 修复 · N-1 大小王缎带图形化", () => {
  it("LDV_CSS 全量扫描:font-size 一律 ≥14px(1.3 新增样式块小字清零,钉死不回退)", () => {
    const sizes = [...LDV_CSS.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    for (const px of sizes) expect(px, "LDV_CSS 字号偷小").toBeGreaterThanOrEqual(14);
  });

  it("徽记是图形不是小字:花徽 / 星徽两形不同、无 <text> 节点、身份色相分开", () => {
    const big = kribbonBadgeSvg("big");
    const small = kribbonBadgeSvg("small");
    expect(big).toContain('data-part="ribbon-flower"');
    expect(small).toContain('data-part="ribbon-star"');
    expect(big).not.toBe(small);
    for (const svg of [big, small]) {
      expect(svg).toContain("<svg");
      expect(svg).not.toContain("<text");
    }
    // 大王暖色花瓣 vs 小王冷色星:16px 下色相 + 形状双通道
    expect(big).toContain("#E2648F");
    expect(small).toContain("#5C79C4");
  });

  it("宽牌缎带挂徽记且不再有缎带小字;窄牌照旧砍缎带(EMBOSS_MIN_W 降级逻辑保留)", () => {
    expect(jokerIds.length).toBe(2);
    for (const id of jokerIds) {
      const wideHtml = cardFaceArtHTML(id, 80);
      expect(wideHtml).toContain("ldv-kribbon");
      expect(wideHtml).toMatch(/data-part="ribbon-(flower|star)"/);
      // 缎带 span 里紧跟的是 SVG,不再是「大王/小王」裸文字
      expect(/ldv-kribbon[^>]*>\s*[^<\s]/.test(wideHtml)).toBe(false);
      // 身份文字仍由角标承担(≥14px 的 ld-c-i)
      expect(wideHtml).toContain("ld-c-i");
      const slim = cardFaceArtHTML(id, 24);
      expect(slim).not.toContain("ldv-kribbon");
    }
  });
});

describe("窗口7 R2 修复 · B 档一致性 #4 深影色收敛", () => {
  it("第三支深影 rgba(46,26,60) 清零,牌沿分隔影统一进 rgba(90,74,110,α) 家族", () => {
    expect(LDV_CSS).toContain("1px 0 0 rgba(90,74,110,.14)");
    expect(LDV_CSS).not.toContain("46,26,60");
    const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(indexSrc).not.toContain("46,26,60");
    // .ld-card 基础影与 .ldv-can 抬升影的分隔线分量同源同值(同款内不许双 token)
    expect(indexSrc).toContain("1px 0 0 rgba(90,74,110,.14)");
  });
});
