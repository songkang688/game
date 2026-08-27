/**
 * 海底大胃王 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:局内 HUD(冲刺条标签/图鉴行/压制提示/对手名牌/
 * 机制徽标行)、场上提示(BOSS 名牌/气泡墙「从这钻!」)、图鉴页(副题/生物名地板/小注)、
 * 结算(吞吃链/体型成长条)共 12 处 10~13px 全部提到宪法 14px 下限。
 * 溢出安全:长句处(图鉴副题/生物名/小注/机制徽标行/模式卡简介)都带 fillText maxWidth 兜底;
 * 其余为短句短词,HUD 条宽余量充足。
 * 注意:改动全部在字号数值,不碰 4× 节流热路径的绘制笔数(N-R3-04 交接禁令仍有效)。
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

describe("fix(visual-r3) N-R3-01:画布字号全部 ≥14px", () => {
  it("index.ts 字面量 ctx.font 无一处 <14px(原 10/12/13px 共 12 处已全部提到 14px)", () => {
    const sizes = fontPxLiterals(src);
    expect(sizes.length).toBeGreaterThan(10);
    for (const px of sizes) expect(px, "局内画布文字应 ≥14px").toBeGreaterThanOrEqual(14);
  });

  it("art.ts 字面量 ctx.font 同样无 <14px", () => {
    for (const px of fontPxLiterals(artSrc)) expect(px).toBeGreaterThanOrEqual(14);
  });

  it("模板插值字号里不再有 <14 的 Math.max 地板(图鉴名 11→14)", () => {
    expect(src).toContain("Math.max(14, Math.round(ch * 0.15))");
    for (const m of src.matchAll(/font\s*=\s*`[^`]*\$\{Math\.max\((\d+(?:\.\d+)?),/g)) {
      expect(Number(m[1]), "模板字号地板应 ≥14").toBeGreaterThanOrEqual(14);
    }
  });

  it("长句处保留/新增 maxWidth 兜底:图鉴副题、生物名、小注、机制徽标行", () => {
    expect(src).toContain('ctx.fillText("吃过、见过的海洋生物都会记在这里!点任意处返回", w / 2, 58, w - 12)');
    expect(src).toContain('ctx.fillText(seen ? d.name : "???", cx, cy + ch * 0.18, cw - 16)');
    expect(src).toContain("ctx.fillText(d.desc, cx, cy + ch * 0.35, cw - 16)");
    expect(src).toContain('ctx.fillText(badges.join(" · "), 12, 70, Math.max(60, w - (shield > 0 ? 90 : 24)))');
  });
});
