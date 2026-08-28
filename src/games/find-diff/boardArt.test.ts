/**
 * W8R1-04 · 盘面贴纸映射的钉子（窗口 8 第 2 轮监督修复员，专项第一步）。
 *
 * 第 1 轮挂账：盘面 emoji 格是题目数据（SHA-256 钉死），不能动题库。
 * 本轮落地渲染层查表 + 整关门控：这里钉六件事：
 *   1. 题库零改动的前提下，十章图集配齐（第 1–3 章 W8R2 配、第 4–10 章
 *      trio-r7 L-3 补 50 张）——表情池 + 双胞胎替换对一张不缺；
 *   2. 整关门控：全部 188 关（含连环轮次）贴纸就绪；门控逻辑本身不拆——
 *      混进一张没收录的图案就整关关闸，绝不混排；
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

/** 已配齐图集的主题：十章全亮（第 1–3 章 W8R2；第 4–10 章 trio-r7 L-3 补账） */
const READY_THEMES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

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

describe("W8R1-04 / trio-r7 L-3 · 十章图集配齐（题库零改动）", () => {
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
  it("全部 188 关（含连环轮次、三图/镜像/动态）贴纸就绪", () => {
    expect(READY_THEMES.length).toBe(CHAPTERS.length);
    for (let level = 0; level < LEVELS.length; level++) {
      for (let round = 0; round < Math.max(1, LEVELS[level].rounds); round++) {
        expect(sceneStickersReady(buildScene(level, round)), `第 ${level + 1} 关第 ${round + 1} 轮`).toBe(true);
      }
    }
  });

  it("门控逻辑不拆：盘面混进一张没收录的图案，整关关闸绝不混排", () => {
    const scene = buildScene(0, 0);
    expect(sceneStickersReady(scene)).toBe(true);
    // 上图 / 图② / 下图任何一处漏一张，整关都得回 emoji 直出
    const hole = { ...scene.left[0], emoji: "🛸" };
    expect(sceneStickersReady({ ...scene, left: [hole, ...scene.left.slice(1)] })).toBe(false);
    expect(sceneStickersReady({ ...scene, right: [hole, ...scene.right.slice(1)] })).toBe(false);
    expect(sceneStickersReady({ ...scene, second: [hole] })).toBe(false);
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
