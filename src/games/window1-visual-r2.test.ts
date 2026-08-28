/**
 * 1.3 窗口 1 · 第 2 轮视觉验收 · 测试员新增的机器化回归用例。
 *
 * 本轮重点是第 1 轮监督修复员(C 档)12 项修复的**逐条回归钉子**:
 * 把 P1–P10 + 自查 clamp 的落地状态固化成源码级契约,防后续轮次悄悄退化。
 * 另补三条「回归猎手」契约:fixer 新增绘制段无 emoji 码位、全静态(不引时间源)、
 * star-estate 不再出现 emoji 主角级地格节点。
 *
 * 只读源码、不改绘制实现;报告见 docs/qa/1.3-window1-round2-tester.md。
 * 与 window1-visual-r1.test.ts / window1-visual-r1-fix.test.ts 互补,用例只增不减。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

// ---------------------------------------------------------------------------
// P1 = G-6 · star-estate 地格图标矢量化
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P1 star-estate 地格矢量化回归", () => {
  it("TILE_ICONS 与 board.ts 地格 emoji 全集双向覆盖(无缺无余)", () => {
    const art = src("src/games/star-estate/art.ts");
    const board = src("src/games/star-estate/board.ts");
    const boardEmoji = [...new Set([...board.matchAll(/emoji:\s*"([^"]+)"/g)].map((m) => m[1]))];
    const iconKeys = [...art.matchAll(/^\s{2}"([^"]+)":$/gm)].map((m) => m[1]);
    expect(boardEmoji.length).toBeGreaterThanOrEqual(33);
    for (const e of boardEmoji) {
      expect(iconKeys, `board.ts 地格 emoji ${e} 缺矢量图标`).toContain(e);
    }
    for (const k of iconKeys) {
      expect(boardEmoji, `TILE_ICONS 冗余键 ${k}(board.ts 已不用)`).toContain(k);
    }
  });

  it("TILE_ICONS 图形体不含 <text> 文本节点(尤其防「? 徽章」类构图回归)", () => {
    const art = src("src/games/star-estate/art.ts");
    const start = art.indexOf("export const TILE_ICONS");
    const end = art.indexOf("TILE_ICON_FALLBACK");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = art.slice(start, end);
    expect(block).not.toContain("<text");
    expect(block).not.toContain(">?<");
  });

  it("index.ts 地格用 se-tile-icon 插 SVG,emoji 主角级节点 se-tile-emoji 保持清零", () => {
    const idx = src("src/games/star-estate/index.ts");
    expect(idx).toContain('class="se-tile-icon"');
    expect(idx).toContain("tileIconSVG(tile.emoji)");
    expect(idx).not.toContain("se-tile-emoji");
  });

  it("自查 clamp:.se-tile-icon 字号 clamp 下限 ≥ 13px(360px 字号红线)", () => {
    const idx = src("src/games/star-estate/index.ts");
    const m = idx.match(/\.se-tile-icon\{font-size:clamp\((\d+(?:\.\d+)?)px/);
    expect(m, ".se-tile-icon 必须保留 font-size:clamp 声明").not.toBeNull();
    expect(parseFloat((m as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(13);
  });
});

// ---------------------------------------------------------------------------
// P2 · orb-arena 中景具象贴片层
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P2 orb-arena 贴片层回归", () => {
  it("视差 0.3 与圆斑层同系数,贴片层调用位于圆斑层之后、网格层之前", () => {
    const art = src("src/games/orb-arena/art.ts");
    expect(art).toMatch(/export const DECOR_PARALLAX = 0\.3;/);
    const bg = art.slice(art.indexOf("export function drawArenaBackground"));
    const blobAt = bg.indexOf("BLOB_SEEDS");
    const decorAt = bg.indexOf("drawArenaDecorLayer(g, o)");
    const gridAt = bg.indexOf("globalAlpha = 0.06");
    expect(blobAt).toBeGreaterThan(-1);
    expect(decorAt).toBeGreaterThan(blobAt);
    expect(gridAt).toBeGreaterThan(decorAt);
  });

  it("三式贴片齐全且 alpha 值域封顶 0.5", () => {
    const art = src("src/games/orb-arena/art.ts");
    expect(art).toContain("五瓣小花");
    expect(art).toContain("四芒星");
    expect(art).toContain("糖果石子");
    // decorAt 的 alpha = 0.35 + (0..15)/15*0.15,上限恰 0.5
    expect(art).toMatch(/alpha: 0\.35 \+ \(\(\(h >>> 21\) % 16\) \/ 15\) \* 0\.15/);
  });
});

// ---------------------------------------------------------------------------
// P3 · flight-chess 四象限静态装饰
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P3 flight-chess 装饰层回归", () => {
  it("decorArt 恰 4 草簇 + 2 云,装饰层 aria-hidden 且 pointer-events:none", () => {
    const idx = src("src/games/flight-chess/index.ts");
    const start = idx.indexOf("export function decorArt");
    expect(start).toBeGreaterThan(-1);
    const fn = idx.slice(start, idx.indexOf("\n}", start));
    expect((fn.match(/fc-decor-grass/g) ?? []).length).toBe(1); // 模板串 ×4 由 grassSpots 驱动
    expect((fn.match(/\[\d+(?:\.\d+)?, \d+(?:\.\d+)?, \d\]/g) ?? []).length).toBe(4);
    expect((fn.match(/fc-decor-cloud/g) ?? []).length).toBe(2);
    expect(idx).toContain('.fc-decor{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}');
    expect(idx).toContain('decor.setAttribute("aria-hidden", "true")');
  });
});

// ---------------------------------------------------------------------------
// P5 · combo-clash 土丘三阶
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P5 combo-clash 土丘三阶回归", () => {
  it("nearMounds 保留 base 平涂 + tint 0.3 亮弧 + shade 0.2 暗带三笔", () => {
    const art = src("src/games/combo-clash/art.ts");
    const start = art.indexOf("function nearMounds");
    const fn = art.slice(start, art.indexOf("\n}", start));
    expect(fn).toContain("tint(th.near, 0.3)");
    expect(fn).toContain("shade(th.near, 0.2)");
    expect(fn).toContain("rgba(th.near, 0.9)");
  });
});

// ---------------------------------------------------------------------------
// P6 · snake-royale 远景色岛 + 双档视差
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P6 snake-royale 色岛与视差回归", () => {
  it("恰两档视差常量(0.6 / 0.85),贴片尺寸下限 3.2", () => {
    const art = src("src/games/snake-royale/art.ts");
    expect(art).toMatch(/export const ISLAND_PARALLAX = 0\.6;/);
    expect(art).toMatch(/export const DECOR_PARALLAX = 0\.85;/);
    expect(art).toMatch(/export const DECOR_MIN_SIZE = 3\.2;/);
    const parallaxDecls = art.match(/PARALLAX = 0\.\d+/g) ?? [];
    expect(parallaxDecls.length, "视差档位只许两档,不许出现第三档").toBe(2);
  });

  it("色岛 alpha 值域 0.08–0.12,每 900 世界格恰一枚", () => {
    const art = src("src/games/snake-royale/art.ts");
    expect(art).toMatch(/export const ISLAND_CELL = 900;/);
    expect(art).toMatch(/globalAlpha = 0\.08 \+ \(\(hsh >>> 3\) % 5\) \/ 100/);
  });
});

// ---------------------------------------------------------------------------
// P8 · mahjong-bloom 织纹 / hero-cards 纸感
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P8 织纹与纸感回归", () => {
  it("mahjong-bloom 毛毡织纹在位且 alpha ≤ 4%", () => {
    const idx = src("src/games/mahjong-bloom/index.ts");
    const m = idx.match(/repeating-linear-gradient\(45deg,rgba\(255,255,255,(\.\d+)\)/);
    expect(m, "毛毡斜织纹声明必须保留").not.toBeNull();
    expect(parseFloat(`0${(m as RegExpMatchArray)[1]}`)).toBeLessThanOrEqual(0.04);
  });

  it("hero-cards 卡面保持米白纸感渐变,不回退 #fff 平涂", () => {
    const idx = src("src/games/hero-cards/index.ts");
    const card = idx.match(/\.hc-card\{[^}]+\}/);
    expect(card).not.toBeNull();
    expect((card as RegExpMatchArray)[0]).toContain("linear-gradient(180deg,#fffdf8,#f6efe2)");
    expect((card as RegExpMatchArray)[0]).not.toMatch(/background:#fff[^d]/);
  });
});

// ---------------------------------------------------------------------------
// P9 · block-drop 井壁浮雕
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P9 block-drop 井壁浮雕回归", () => {
  it("四主题浮雕分支齐全,件高 12px、纵向每 6 格一件、只挂井壁", () => {
    const art = src("src/games/block-drop/art.ts");
    expect(art).toMatch(/export const RELIEF_H = 12;/);
    const start = art.indexOf("export function paintWallRelief");
    const fn = art.slice(start, art.indexOf("\n}", start + 40));
    for (const th of ['"clouds"', '"ice"', '"dusk"']) {
      expect(fn, `paintWallRelief 缺 ${th} 主题分支`).toContain(`theme.decor === ${th}`);
    }
    expect(art).toMatch(/reliefStep = Math\.max\(60, cell \* 6\)/);
    // 两处调用点都在壁中线(ws/2 与 w-ws/2),不进玩法区
    expect(art).toContain("paintWallRelief(g, ws / 2,");
    expect(art).toContain("paintWallRelief(g, w - ws / 2,");
  });
});

// ---------------------------------------------------------------------------
// P10 = G-7 · weiqi-garden 测试文件组织
// ---------------------------------------------------------------------------
describe("窗口1·r2 · P10 weiqi-garden 测试组织回归", () => {
  it("独立 art.test.ts 在位,旧 5 个 1.3 视觉契约 describe 未从 index.test.ts 迁走", () => {
    expect(existsSync(join(ROOT, "src/games/weiqi-garden/art.test.ts"))).toBe(true);
    const legacy = src("src/games/weiqi-garden/index.test.ts");
    const kept = legacy.match(/describe\("weiqi-garden · 1\.3 视觉契约/g) ?? [];
    expect(kept.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 回归猎手:fixer 新增绘制段的负面清单
// ---------------------------------------------------------------------------
describe("窗口1·r2 · 回归猎手:r1 修复段负面清单", () => {
  it("fixer 新增绘制段无 emoji 码位(TILE_ICONS 图形体 / grassSVG / paintWallRelief / paintArenaDecor)", () => {
    const chunks: Array<[string, string, string]> = [
      ["star-estate/art.ts TILE_ICONS", "src/games/star-estate/art.ts", "export const TILE_ICONS"],
      ["flight-chess/art.ts grassSVG", "src/games/flight-chess/art.ts", "export function grassSVG"],
      ["block-drop/art.ts paintWallRelief", "src/games/block-drop/art.ts", "export function paintWallRelief"],
      ["orb-arena/art.ts paintArenaDecor", "src/games/orb-arena/art.ts", "export function paintArenaDecor"]
    ];
    for (const [label, file, anchor] of chunks) {
      const text = src(file);
      const start = text.indexOf(anchor);
      expect(start, `${label} 锚点丢失`).toBeGreaterThan(-1);
      const body = text.slice(start, start + 4000).replace(/"[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}][^"]*":/gu, "KEY:");
      // TILE_ICONS 的键本身是 emoji(映射表键,不渲染),剥掉键后图形体不许再有 emoji
      expect(EMOJI_RE.test(body), `${label} 图形体疑似 emoji 直出`).toBe(false);
    }
  });

  it("r1 新增装饰全部静态:装饰函数不引时间源与动画帧", () => {
    const spans: Array<[string, string, string, string]> = [
      ["orb-arena 贴片", "src/games/orb-arena/art.ts", "function drawArenaDecorLayer", "export function drawArenaBackground"],
      ["snake-royale 色岛", "src/games/snake-royale/art.ts", "2.5) 远景「原野色岛」", "// 3)"],
      ["block-drop 浮雕", "src/games/block-drop/art.ts", "export function paintWallRelief", "paintWellBackground"],
      ["flight-chess 装饰", "src/games/flight-chess/index.ts", "export function decorArt", "export function movePreview"]
    ];
    for (const [label, file, from, to] of spans) {
      const text = src(file);
      const a = text.indexOf(from);
      const b = text.indexOf(to, a + 1);
      expect(a, `${label} 起始锚点丢失`).toBeGreaterThan(-1);
      expect(b, `${label} 结束锚点丢失`).toBeGreaterThan(a);
      const body = text.slice(a, b);
      for (const banned of ["Date.now", "performance.now", "requestAnimationFrame", "setInterval", "@keyframes"]) {
        expect(body.includes(banned), `${label} 引入了动态源 ${banned}`).toBe(false);
      }
    }
  });

  it("P4 触区四处 min-height:44px 保持在位(oa-open / sr-open / bd-open / sr-skin)", () => {
    expect(src("src/games/orb-arena/index.ts")).toMatch(/\.oa-open\{[^}]*min-height:44px/);
    expect(src("src/games/snake-royale/index.ts")).toMatch(/\.sr-open\{[^}]*min-height:44px/);
    expect(src("src/games/block-drop/index.ts")).toMatch(/\.bd-open\{[^}]*min-height:44px/);
    const sr = src("src/games/snake-royale/index.ts");
    const skin = sr.match(/\.sr-skin\{[^}]+\}/s);
    expect(skin).not.toBeNull();
    expect((skin as RegExpMatchArray)[0]).toContain("min-height:44px");
  });
});
