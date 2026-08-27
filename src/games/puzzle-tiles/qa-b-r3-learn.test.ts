/**
 * 窗口4 · 档B · 第 3 轮学习优化员 —— 拼图乐园(puzzle-tiles)。
 *
 * 落地 B3-L4:一共 10 套图,无尽画廊从头到尾只翻得到最后 4 套
 * (原来写死 `theme = 6 + (n % 4)`),1.0 那 6 套一次都不露面。
 * 写死是有原因的:6×6 的板子要 35 张图,小图库只有 15 张——这个限制是真的。
 * 所以改成按板子大小挑:装得下就 10 套轮着来,装不下还只用大图库。
 */
import { describe, expect, it } from "vitest";
import { THEME_TILES, endlessBoard, galleryTheme, tilesNeeded } from "./levels";
import { boardKind } from "./logic";

describe("档B R3-L4 · 无尽画廊:10 套图都翻得到", () => {
  it("推格子要空一格,转向/补块要摆满——用图张数算得对", () => {
    expect(tilesNeeded(3, 3, "slide")).toBe(8);
    expect(tilesNeeded(6, 6, "slide")).toBe(35);
    expect(tilesNeeded(4, 4, "rotate")).toBe(16);
    expect(tilesNeeded(5, 5, "fill")).toBe(25);
  });

  it("挑出来的图库一定装得下这块板子", () => {
    for (let need = 1; need <= 36; need++) {
      for (let n = 1; n <= 40; n++) {
        const t = galleryTheme(n, need);
        expect(THEME_TILES[t], `第 ${n} 幅挑了不存在的图库 ${t}`).toBeDefined();
        expect(
          THEME_TILES[t].length,
          `第 ${n} 幅要 ${need} 张,图库 ${t} 只有 ${THEME_TILES[t].length} 张`,
        ).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it("小板子把 10 套图全轮一遍,大板子还只用装得下的那 4 套", () => {
    const small = new Set<number>();
    for (let n = 1; n <= 40; n++) small.add(galleryTheme(n, 15));
    expect(small.size, "15 张以内的板子没把 10 套图都用上").toBe(THEME_TILES.length);

    const big = new Set<number>();
    for (let n = 1; n <= 40; n++) big.add(galleryTheme(n, 35));
    expect([...big].sort((a, b) => a - b), "35 张的板子挑到了装不下的小图库").toEqual([6, 7, 8, 9]);
  });

  it("真跑一趟画廊:300 幅里露面的图库比原来的 4 套多", () => {
    const used = new Set<number>();
    for (let n = 1; n <= 300; n++) used.add(endlessBoard(n).theme);
    expect(used.size, `300 幅只翻到 ${used.size} 套图`).toBeGreaterThan(4);
    // 1.0 那 6 套小图库至少露一次面
    expect([...used].some((t) => t < 6), "1.0 的 6 套小图库还是一次都没露面").toBe(true);
  });

  it("300 幅每一幅的图都够用,一张都不缺", () => {
    for (let n = 1; n <= 300; n++) {
      const cfg = endlessBoard(n);
      const need = tilesNeeded(cfg.rows, cfg.cols, boardKind(cfg));
      expect(
        THEME_TILES[cfg.theme].length,
        `第 ${n} 幅(${cfg.rows}×${cfg.cols} ${boardKind(cfg)})要 ${need} 张,图库只有 ${THEME_TILES[cfg.theme].length} 张`,
      ).toBeGreaterThanOrEqual(need);
    }
  });

  it("换图不动难度:板子大小、步数上限、提示数一个都没被带偏", () => {
    for (let n = 1; n <= 300; n++) {
      const cfg = endlessBoard(n);
      expect(cfg.rows).toBeGreaterThanOrEqual(3);
      expect(cfg.rows).toBeLessThanOrEqual(6);
      expect(cfg.moveLimit).toBeGreaterThan(cfg.two);
      expect(cfg.two).toBeGreaterThan(cfg.three);
      expect(cfg.hints).toBeGreaterThanOrEqual(3);
    }
  });

  it("同一幅取两次还是同一套图(画廊照样是 seeded 可复现的)", () => {
    for (let n = 1; n <= 120; n++) {
      expect(endlessBoard(n), `第 ${n} 幅两次取的不一样`).toEqual(endlessBoard(n));
    }
  });
});
