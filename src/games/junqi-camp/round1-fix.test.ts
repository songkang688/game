/**
 * 军旗对决 · 1.3 第 1 轮 C 档修复契约（对应 A 档 3-1 严重：双方只靠颜色区分）。
 *
 * 修法（只动绘制层）：
 *  ① sideMarkSVG——朵朵一朵圆瓣小花、星星一颗尖角五角星，剪影互异，成为形状第二通道；
 *  ② faceHTML 给「翻开的」棋面挂 jq-mark 角标；牌背仍统一无侧别（暗棋信息红线）；
 *  ③ crestSVG / hqSVG / hoistSVG 的旗形与旗徽双方互异（波浪旗+花徽 vs 燕尾旗+星徽）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SIDE_COLOR, SIDE_DARK, backSVG, crestSVG, hoistSVG, sideMarkSVG } from "./art";
import { CSS as BOARD_CSS, faceHTML } from "./view";
import { idx } from "./board";

const stripSideColors = (svg: string): string => {
  let out = svg;
  for (const c of [...Object.values(SIDE_COLOR), ...Object.values(SIDE_DARK)]) out = out.split(c).join("#SIDE");
  return out;
};

describe("junqi-camp · 双方形状第二通道（A 档 3-1 严重修复）", () => {
  it("sideMarkSVG 双方去色后仍互异:朵朵是圆瓣花、星星是尖角星", () => {
    const duo = sideMarkSVG("duo");
    const star = sideMarkSVG("star");
    expect(stripSideColors(duo)).not.toBe(stripSideColors(star));
    // 朵朵徽记靠圆（花瓣圈 ≥5 圆），星星徽记靠尖角（polygon 星）
    expect((duo.match(/<circle /g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(star).toContain("<polygon");
    expect(star).not.toContain("<circle");
  });

  it("翻开的棋面带 jq-mark 角标且双方不同;牌背不带、保持无侧别", () => {
    const duoFace = faceHTML(idx(6, 0), "siling", { id: 1, side: "duo", kind: "siling" });
    const starFace = faceHTML(idx(6, 0), "siling", { id: 2, side: "star", kind: "siling" });
    expect(duoFace).toContain("jq-mark");
    expect(starFace).toContain("jq-mark");
    expect(duoFace).not.toBe(starFace);
    // 牌背对任何一方都是同一张、无角标——构造上不可能泄密
    const back = faceHTML(idx(3, 0), null, { id: 3, side: "duo", kind: "siling" });
    expect(back).toBe(faceHTML(idx(8, 4), null, { id: 4, side: "star", kind: "gongbing" }));
    expect(back).not.toContain("jq-mark");
    expect(back).toBe(backSVG());
  });

  it("升旗动画的旗面双方去色后互异（三角尖旗+花徽 vs 燕尾旗+星徽）", () => {
    expect(stripSideColors(hoistSVG("duo"))).not.toBe(stripSideColors(hoistSVG("star")));
    expect(stripSideColors(crestSVG("duo"))).not.toBe(stripSideColors(crestSVG("star")));
  });

  it("jq-mark 有定位样式:左下角、不挡点击", () => {
    const rule = BOARD_CSS.match(/\.jq-mark\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("position:absolute");
    expect(rule).toContain("pointer-events:none");
  });

  it("双方面板底渐变的灰度差拉开到 ≥20/255（B 档 #1② 规格）", () => {
    const lum = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const stops = (sel: string): string[] => {
      const rule = BOARD_CSS.match(new RegExp(`\\.${sel} \\.jq-face\\{[^}]*\\}`))?.[0] ?? "";
      return rule.match(/#[0-9A-Fa-f]{6}(?=[,)])/g) ?? [];
    };
    const duo = stops("jq-duo");
    const star = stops("jq-star");
    expect(duo.length).toBeGreaterThanOrEqual(2);
    expect(star.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(lum(duo[0]) - lum(star[0]))).toBeGreaterThanOrEqual(20);
    expect(Math.abs(lum(duo[1]) - lum(star[1]))).toBeGreaterThanOrEqual(20);
  });
});

describe("junqi-camp · HUD 字号 ≥14px（A 档 5-4 修复）", () => {
  it("chip / note / tip / sub / pick / crest / 图例的每条规则字号都 ≥14", () => {
    const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    for (const cls of ["jq-chip", "jq-note", "jq-tip", "jq-sub", "jq-pick", "jq-crest"]) {
      const rules = [...INDEX.matchAll(new RegExp(`\\.${cls}\\{[^}]*\\}`, "g"))];
      expect(rules.length, `${cls} 没找到规则`).toBeGreaterThan(0);
      for (const [rule] of rules) {
        const m = /font-size:([\d.]+)px/.exec(rule);
        if (m) expect(Number.parseFloat(m[1]), `${cls} 字号 ${m[1]}px 低于 14`).toBeGreaterThanOrEqual(14);
      }
    }
    const legend = BOARD_CSS.match(/\.jq-legend\{[^}]*\}/)?.[0] ?? "";
    expect(legend).toContain("font-size:14px");
  });
});
