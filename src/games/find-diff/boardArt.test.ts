/**
 * W8R1-04 · 盘面贴纸映射的钉子（窗口 8 第 2 轮监督修复员，专项第一步）。
 *
 * 第 1 轮挂账：盘面 emoji 格是题目数据（SHA-256 钉死），不能动题库。
 * 本轮落地渲染层查表 + 整关门控：这里钉六件事：
 *   1. 题库零改动的前提下，第 1–3 章（水果 / 萌宠 / 海底）图集配齐——
 *      表情池 + 双胞胎替换对一张不缺；
 *   2. 整关门控：前 3 章全部关卡（含无尽用的 classic 场）贴纸就绪；
 *      第 4 章起（图集未配齐）必须原样 emoji 直出，绝不混排；
 *   3. glyphHTML 贴纸档：sr-only 原 emoji 一字不差 + aria-hidden 贴纸，
 *      字号 / transform 与 emoji 档走同一份 style；
 *   4. 兜底：门控关掉或查不到贴纸时，输出与 1.2 的老写法逐字节一致；
 *   5. 贴纸两两不同：换装章节里「找不同」的差异点在贴纸上依然成立；
 *   6. 接线防拆：paintCell 走 glyphHTML，runner 用 sceneStickersReady 门控。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasSticker, sticker } from "../../art/kit/stickers";
import { BOARD_ART_CSS, STICKER_FONT_RATIO, glyphHTML, sceneStickersReady } from "./boardArt";
import { buildScene } from "./scene12";
import { CHAPTERS, LEVELS, THEME_POOLS } from "./levels";

const PICTO = /\p{Extended_Pictographic}/u;

/** 本轮已配齐图集的主题（第 1–3 章：水果果园 / 萌宠乐园 / 海底世界） */
const READY_THEMES = [0, 1, 2];

/** 双胞胎替换表（LOOKALIKE 是题库私有常量，这里从源码现抓，谁改表这里跟着变） */
function lookalikeTwins(pool: readonly string[]): string[] {
  const src = readFileSync(new URL("./levels.ts", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const LOOKALIKE"), src.indexOf("export type DiffMode"));
  const twins: string[] = [];
  for (const m of block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    if (pool.includes(m[1])) twins.push(m[2]);
  }
  return twins;
}

/** 这一章的盘面上可能出现的全部图案：表情池 + 池内图案的双胞胎替换 */
function themeGlyphs(theme: number): string[] {
  const pool = THEME_POOLS[theme];
  return [...new Set([...pool, ...lookalikeTwins(pool)])];
}

describe("W8R1-04 · 第 1–3 章图集配齐（题库零改动）", () => {
  it("表情池 + 双胞胎替换对，一张贴纸都不缺", () => {
    for (const theme of READY_THEMES) {
      expect(themeGlyphs(theme).filter((e) => !hasSticker(e)), `第 ${theme + 1} 章`).toEqual([]);
    }
  });

  it("换装章节里贴纸两两不同：差异点换到贴纸上照样找得出来", () => {
    for (const theme of READY_THEMES) {
      const svgs = themeGlyphs(theme).map((e) => sticker(e, 32));
      expect(new Set(svgs).size, `第 ${theme + 1} 章`).toBe(svgs.length);
    }
  });
});

describe("W8R1-04 · 整关门控", () => {
  it("前 3 章全部关卡（含连环轮次）贴纸就绪", () => {
    for (let level = 0; level < LEVELS.length; level++) {
      if (!READY_THEMES.includes(LEVELS[level].theme)) continue;
      for (let round = 0; round < Math.max(1, LEVELS[level].rounds); round++) {
        expect(sceneStickersReady(buildScene(level, round)), `第 ${level + 1} 关第 ${round + 1} 轮`).toBe(true);
      }
    }
  });

  it("图集没配齐的章节整关关闸，绝不出半贴纸半 emoji 的混排图", () => {
    let checked = 0;
    for (let level = 0; level < LEVELS.length; level++) {
      const theme = LEVELS[level].theme;
      if (READY_THEMES.includes(theme)) continue;
      // 第 4 章起每章抽第一关（连环模式抽第一轮）
      if (LEVELS.findIndex((c) => c.theme === theme) !== level) continue;
      expect(sceneStickersReady(buildScene(level, 0)), `第 ${level + 1} 关`).toBe(false);
      checked++;
    }
    expect(checked).toBe(CHAPTERS.length - READY_THEMES.length);
  });
});

describe("W8R1-04 · glyphHTML 两档输出", () => {
  const style = "font-size:26px;transform:translate(-50%,-50%) translate(0.0px,0.0px) scale(1.00) scaleX(1)";

  it("贴纸档：sr-only 原 emoji + aria-hidden 贴纸，style 原样透传", () => {
    const html = glyphHTML("🍓", 26, style);
    expect(html).toContain('<span class="fdf-glyph-sr">🍓</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`style="${style}"`);
    expect(html).toContain('data-sticker="草莓"');
    expect(html).toContain(`width="${Math.round(26 * STICKER_FONT_RATIO)}"`);
    // 可见层（sr 之外）一个裸 emoji 都不许有
    expect(PICTO.test(html.replace('<span class="fdf-glyph-sr">🍓</span>', ""))).toBe(false);
  });

  it("个别图案查不到贴纸：兜底与 1.2 老写法逐字节一致，绝不空格子", () => {
    expect(glyphHTML("🤷", 26, style)).toBe(`<span class="fdf-glyph" style="${style}">🤷</span>`);
  });
});

describe("W8R1-04 · 接线与纪律", () => {
  const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

  it("paintCell 门控分流：开闸走 glyphHTML，关闸保留 1.2 原样模板串", () => {
    expect(SRC).toContain("art ? glyphHTML(view.emoji, font, style)");
    expect(SRC).toContain("const artOn = sceneStickersReady(scene);");
    expect(SRC).toContain("CSS + STAGE_CSS + BOARD_ART_CSS");
  });

  it("BOARD_ART_CSS 只有自己的类：不碰 .fdf-cell 几何、无动画", () => {
    expect(BOARD_ART_CSS).not.toMatch(/\.fdf-cell\s*\{/);
    expect(BOARD_ART_CSS).not.toContain("@keyframes");
    expect(BOARD_ART_CSS).not.toContain("animation");
  });
});
