/**
 * 朵星格斗王 · 1.3 窗口3 第 2 轮监督修复员 · 修后钉子。
 *
 * 对应第 1 轮 fixer 遗留 #4 / #5:
 * - #4:战斗 HUD 六处微标签(.fk-ch-n / .fk-name×2 / .fk-clock-r / .fk-pad-name /
 *   .fk-fd)从 12~12.5px 提到宪法 14px 下限。360 不溢出的论证:.fk-name 有
 *   JS shortName(3 字上限)+ ellipsis 双兜底;.fk-ch-n 在 ~80px 网格列内;
 *   .fk-clock-r 最长「第 3 回合」≈59px 只会内溢进 8px flex gap;.fk-pad-name
 *   跨满网格行;.fk-fd 包在 .fk-scroll(overflow-x:auto)里。
 * - #5:菜单模式卡 🥊🤖🏯🔥🎓 换画制 SVG 图标(modeIconSVG),选人页标题与
 *   训练场标题同源复用,菜单层与画制头像零代差。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { modeIconSVG } from "./art";
import type { MenuMode } from "./art";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 某选择器全部声明块(含媒体查询里的二次声明)中出现的 font-size(px) */
function fontSizesOf(selector: string): number[] {
  const re = new RegExp(`\\${selector}\\{[^}]*font-size:(\\d+(?:\\.\\d+)?)px`, "g");
  const sizes = [...src.matchAll(re)].map((m) => Number(m[1]));
  expect(sizes.length, `${selector} 需要至少一处 font-size 声明`).toBeGreaterThan(0);
  return sizes;
}

const MODES: MenuMode[] = ["versus", "cpu", "tower", "endless", "training"];

describe("fix(visual-r2) 遗留#4:战斗 HUD 微标签字号 ≥14px", () => {
  it("六处微标签(含媒体查询二次声明)全部 ≥14px", () => {
    for (const sel of [".fk-ch-n", ".fk-name", ".fk-clock-r", ".fk-pad-name", ".fk-fd"]) {
      for (const px of fontSizesOf(sel)) expect(px, `${sel} 应 ≥14px`).toBeGreaterThanOrEqual(14);
    }
  });

  it("380px 媒体查询不再把 .fk-name 降回 12px", () => {
    const mq = src.slice(src.indexOf("@media (max-width:380px)"));
    const block = mq.slice(0, mq.indexOf("}\n") + 2);
    expect(block.includes(".fk-name")).toBe(false);
  });

  it("360 防溢出兜底还在:JS 名字 3 字上限 + ellipsis,帧数表在横向滚动壳里", () => {
    expect(src).toContain("const nameMax = narrowLayout ? 3 : 4");
    expect(src).toContain("text-overflow:ellipsis");
    expect(src).toContain('el("div", "fk-scroll")');
  });
});

describe("fix(visual-r2) 遗留#5:菜单模式卡图标画制化", () => {
  it("五枚 SVG 两两互异,全部矢量(有 path/circle,无 img/位图)", () => {
    const svgs = MODES.map((m) => modeIconSVG(m));
    expect(new Set(svgs).size).toBe(5);
    for (const s of svgs) {
      expect(s.startsWith("<svg")).toBe(true);
      expect(/<(path|circle|rect|line|ellipse)\b/.test(s)).toBe(true);
      expect(s.includes("<img")).toBe(false);
      expect(s.includes("data:image")).toBe(false);
      expect(s.includes("aria-hidden")).toBe(true);
    }
  });

  it("每枚都有描边层(stroke)与高光/亮部层,不是单笔平涂", () => {
    for (const m of MODES) {
      const s = modeIconSVG(m);
      expect(s.includes("stroke="), `${m} 应有描边`).toBe(true);
      const hasGleam = s.includes("#ffffff") || s.includes("#ffe08a") || s.includes("#ffd45e");
      expect(hasGleam, `${m} 应有高光/亮部`).toBe(true);
    }
  });

  it("双人对战图标用 P1 粉 / P2 蓝双通道色系,对战语义不靠兵器", () => {
    const s = modeIconSVG("versus");
    expect(s).toContain("#c8497f");
    expect(s).toContain("#41539c");
  });

  it("尺寸参数直通宽高,菜单 26px / 标题 20px 两档共用同一枚", () => {
    expect(modeIconSVG("tower", 26)).toContain('width="26" height="26"');
    expect(modeIconSVG("tower", 20)).toContain('width="20" height="20"');
  });

  it("菜单模式卡/选人页标题/训练面板标题不再直出模式 emoji(战斗页标题条为文本前缀装饰,登记保留)", () => {
    expect(src.includes("${m.emoji}")).toBe(false);
    expect(src.includes("${modeCard?.emoji")).toBe(false);
    expect(src.includes('el("div", "fk-h", "🎓 训练场")')).toBe(false);
    expect(src).toContain("modeIconSVG(m.mode)");
    expect(src).toContain("modeIconSVG(mode, 20)");
    expect(src).toContain('modeIconSVG("training", 20)');
  });
});
