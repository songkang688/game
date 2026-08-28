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
 *   6. 接线防拆：paintCell 走 glyphHTML，runner 用 sceneStickersReady 门控；
 *   7. FLIPPABLE 非对称契约（第 3 轮终验）：会被「换朝向」差异用到的图案，
 *      贴纸剪影必须左右非对称——把 SVG 光栅化取 alpha 通道剪影，与 scaleX(-1)
 *      镜像逐像素比对（正是玩家看到的口径），差异占比 ≥ 10% 才算翻过来看得出。
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hasSticker, sticker } from "../../art/kit/stickers";
import { BOARD_ART_CSS, STICKER_FONT_RATIO, glyphHTML, sceneStickersReady } from "./boardArt";
import { FLIPPABLE, buildEndlessScene, buildScene, plainCell } from "./scene12";
import { CHAPTERS, LEVELS, THEME_POOLS } from "./levels";

const PICTO = /\p{Extended_Pictographic}/u;

/** 已配齐图集的主题（第 3 轮终验补齐第 4–10 章，配齐一章亮一章） */
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

describe("W8R1-04 · 十章图集配齐（题库零改动）", () => {
  it("十章全亮灯：表情池 + 双胞胎替换对，一张贴纸都不缺", () => {
    expect(READY_THEMES.length).toBe(THEME_POOLS.length);
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

describe("W8R1-04 · 整关门控（第 3 轮终验 · 188 关全量回归）", () => {
  it("188 关全量（含三图 / 动态 / 镜像 / 连环的每一轮）贴纸就绪，无混排无漏网", () => {
    expect(LEVELS.length).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
    for (let level = 0; level < LEVELS.length; level++) {
      for (let round = 0; round < Math.max(1, LEVELS[level].rounds); round++) {
        expect(sceneStickersReady(buildScene(level, round)), `第 ${level + 1} 关第 ${round + 1} 轮`).toBe(true);
      }
    }
  });

  it("无尽马拉松前 30 轮（十章池子各三巡 + 双胞胎替换渐入）同样全量就绪", () => {
    for (let round = 1; round <= 30; round++) {
      expect(sceneStickersReady(buildEndlessScene(round)), `无尽第 ${round} 轮`).toBe(true);
    }
  });

  it("门控机制原样：盘面混进没有贴纸的图案，整关关闸回 1.2 emoji 直出", () => {
    const cell = (emoji: string): ReturnType<typeof plainCell> => plainCell(emoji);
    const scene = {
      left: [cell("🍎"), cell("🤷")],
      second: null,
      right: [cell("🍎"), cell("🍌")],
    };
    expect(sceneStickersReady(scene)).toBe(false);
    expect(sceneStickersReady({ left: [cell("🍎")], second: [cell("🤷")], right: [cell("🍎")] })).toBe(false);
    expect(sceneStickersReady({ left: [cell("🍎")], second: null, right: [cell("🍌")] })).toBe(true);
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

// ---------------------------------------------------------------------------
// FLIPPABLE 非对称契约（第 3 轮终验 · 设计稿 4.3 的机器化钉子）
// ---------------------------------------------------------------------------

/** 剪影镜像差异占比：光栅化 alpha 通道，原图 vs 左右镜像逐像素比对（0–1） */
async function silhouetteAsymmetry(svg: string): Promise<number> {
  const SIZE = 64;
  const alphaOf = async (flop: boolean): Promise<Buffer> => {
    let img = sharp(Buffer.from(svg), { density: 96 }).resize(SIZE, SIZE);
    if (flop) img = img.flop();
    return img.ensureAlpha().extractChannel("alpha").raw().toBuffer();
  };
  const [a, b] = await Promise.all([alphaOf(false), alphaOf(true)]);
  let diff = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] > 128;
    const bv = b[i] > 128;
    if (av || bv) union++;
    if (av !== bv) diff++;
  }
  return union ? diff / union : 0;
}

describe("W8R1-04 · FLIPPABLE 非对称契约", () => {
  it("FLIPPABLE 全表贴纸配齐，且剪影与镜像的像素差异 ≥ 10%（换朝向翻得出来）", async () => {
    const covered = [...FLIPPABLE].filter((e) => hasSticker(e));
    expect(covered.length, "FLIPPABLE 图案必须一张不缺").toBe(FLIPPABLE.size);
    for (const e of covered) {
      const score = await silhouetteAsymmetry(sticker(e, 48)!);
      expect(score, `${e} 剪影不对称度 ${(score * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("指标对照组：对称造型（⭐ / 🔵）差异 < 5%，证明口径本身没失真", async () => {
    for (const e of ["⭐", "🔵"]) {
      expect(await silhouetteAsymmetry(sticker(e, 48)!), e).toBeLessThan(0.05);
    }
  });
});

// ---------------------------------------------------------------------------
// 双胞胎区分位（第 3 轮终验 · 设计稿 4.2「像但可辨」的机器化钉子）
// ---------------------------------------------------------------------------

/**
 * 每对双胞胎钉一个稳定区分位：cue 片段必须出现在 own 的贴纸里、
 * 且不出现在 twin 的贴纸里——谁把两张画成一个样，这里直接红。
 */
const TWIN_CUES: Array<{ own: string; twin: string; cue: string; what: string }> = [
  { own: "🎂", twin: "🍰", cue: "#8ecbe8", what: "生日蛋糕的蓝蜡烛（🍰 是切片配草莓）" },
  { own: "🍭", twin: "🍬", cue: "M24 31.5 L24 43", what: "棒棒糖的小木棒（🍬 是双扭糖纸）" },
  { own: "🍩", twin: "🍪", cue: 'fill-rule="evenodd"', what: "甜甜圈的中孔（🍪 无孔配巧克力豆）" },
  { own: "🌟", twin: "⭐", cue: 'opacity=".22"', what: "亮星星的光晕（⭐ 无光晕）" },
  { own: "🌠", twin: "✨", cue: "#ffe9a8", what: "流星的长拖尾（✨ 是三星簇）" },
  { own: "🏀", twin: "⚽", cue: "#f08c3a", what: "篮球的橙底弧线缝（⚽ 黑白五边形）" },
  { own: "🚂", twin: "🚗", cue: "#5f6678", what: "火车头的深色大车轮与烟囱侧（🚗 是轿车）" },
  { own: "🚁", twin: "✈️", cue: "M6 8.5 L42 8.5", what: "直升机的顶置旋翼（✈️ 是固定翼）" },
  { own: "📕", twin: "📒", cue: "#ff6b6b", what: "红课本的正红封面（📒 金黄线圈本）" },
  { own: "🌀", twin: "🌪️", cue: "a3 3 0 0 1 3 3", what: "旋涡的圆盘螺旋芯（🌪️ 是漏斗）" },
  { own: "🫧", twin: "💧", cue: 'fill-opacity=".55"', what: "泡泡串的透明三连泡（💧 是实心单滴）" },
  { own: "🪸", twin: "🪷", cue: "#f2d9a8", what: "珊瑚枝的沙丘底座（🪷 是整朵花）" },
  { own: "⌛", twin: "⏱️", cue: 'stroke-dasharray="2.2 1.6"', what: "沙漏的细沙流（⏱️ 是表冠圆表盘）" },
];

describe("W8R1-04 · 双胞胎区分位", () => {
  it("区分位钉子表覆盖题库 LOOKALIKE 的全部双胞胎对", () => {
    const src = readFileSync(new URL("./levels.ts", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("const LOOKALIKE"), src.indexOf("export type DiffMode"));
    const pairs = new Set<string>();
    for (const m of block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
      pairs.add([m[1], m[2]].sort().join("↔"));
    }
    const pinned = new Set(TWIN_CUES.map((t) => [t.own, t.twin].sort().join("↔")));
    expect([...pairs].filter((p) => !pinned.has(p))).toEqual([]);
    expect(pinned.size).toBe(pairs.size);
  });

  it("每对双胞胎：贴纸不同张，且区分位片段只在自己那张上", () => {
    for (const { own, twin, cue, what } of TWIN_CUES) {
      const a = sticker(own, 32)!;
      const b = sticker(twin, 32)!;
      expect(a, `${own} 缺贴纸`).toBeTruthy();
      expect(b, `${twin} 缺贴纸`).toBeTruthy();
      expect(a, `${own}↔${twin} 画成了同一张`).not.toBe(b);
      expect(a.includes(cue), `${own} 丢了区分位：${what}`).toBe(true);
      expect(b.includes(cue), `${twin} 不该有 ${own} 的区分位：${what}`).toBe(false);
    }
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
