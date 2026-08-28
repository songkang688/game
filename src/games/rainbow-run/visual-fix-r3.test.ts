/**
 * 彩虹快跑 · 1.3 窗口3 第 3 轮终验修复员 · 修后钉子。
 *
 * 对应 A 档(round3-tester)N-R3-01:局内/结算画布六处 13px(幽灵名牌 / 章节卡正文 /
 * 无尽结算行 / 起跑信息行 / 追赶条 / 大王护甲条)提到宪法 14px 下限;fitText 缩字地板
 * 与章节卡标题模板地板同步 13→14,不许再有任何路径把字缩回 14 以下。
 * 溢出安全:六处全部走 fitText(先缩到 14 再省略号)或短句直画(条宽 340px 余量充足)。
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
  it("index.ts 字面量 ctx.font 无一处 <14px(原 13px 共 6 处已全部提到 14px)", () => {
    const sizes = fontPxLiterals(src);
    expect(sizes.length).toBeGreaterThan(10);
    for (const px of sizes) expect(px, "局内画布文字应 ≥14px").toBeGreaterThanOrEqual(14);
  });

  it("art.ts 字面量 ctx.font 同样无 <14px", () => {
    for (const px of fontPxLiterals(artSrc)) expect(px).toBeGreaterThanOrEqual(14);
  });

  it("fitText 缩字地板是 14px:循环条件与注释都不许退回 13", () => {
    expect(src).toContain("while (px > 14 && ctx.measureText(text).width > maxW)");
    expect(src.includes("while (px > 13")).toBe(false);
  });

  it("章节卡标题的模板字号地板是 14px", () => {
    expect(src).toContain("Math.max(14, Math.min(17, Math.round(ch * 0.22)))");
    expect(/Math\.max\(\s*1[0-3]\s*,[^)]*px/.test(src)).toBe(false);
  });

  it("模板插值字号里不再有 <14 的 Math.max 地板", () => {
    for (const m of src.matchAll(/font\s*=\s*`[^`]*\$\{Math\.max\((\d+(?:\.\d+)?),/g)) {
      expect(Number(m[1]), "模板字号地板应 ≥14").toBeGreaterThanOrEqual(14);
    }
  });
});

describe("fix(visual-r3) N-R3-02:局内任务条 🎯 前缀画制化", () => {
  it("源码里不再有任何 🎯 直出(多行 fillText 写法也不许躲):三处任务行全走 drawTargetBadge", () => {
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
      .join("\n");
    expect(codeOnly.includes("🎯")).toBe(false);
    expect((src.match(/drawTargetBadge\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("局内任务条与另两处同款:量宽居中 + 徽章画在文字左侧", () => {
    expect(src).toContain("const hudMissionLine =");
    expect(src).toContain("ctx.translate(w / 2 - hudMissionW / 2 - 4, rowY + 26)");
  });
});
