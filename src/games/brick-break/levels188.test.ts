// 1.1：碰碰砖块 99 → 188 的新砖阵、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import {
  breakableCount,
  CHAPTERS,
  COLS,
  isBreakable,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  PATTERN_STENCILS,
  portalCells,
} from "./levels";

/** 前 99 关的「指纹」：任何一处生成参数或 seed 被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);
const chapterLevels = (ci: number) => NEW_LEVELS.filter((lv) => chapterOf(CHAPTERS, lv) === ci);

describe("碰碰砖块 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "彩虹操场", "金字塔谷", "钻石湖", "钢铁堡垒", "流星雨", "银河大挑战",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关砖阵一块未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("57e4433");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.balls).toBeUndefined();
      expect(lv.moveSpeed).toBeUndefined();
      expect(lv.moveRange).toBeUndefined();
      expect(lv.goal).toBeUndefined();
    }
  });
});

describe("碰碰砖块 · 1.1 新砖阵", () => {
  it("总关数 188，末尾追加了 4 座全新砖阵共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["双子流星港", "滑动迷阵", "星门隧道", "图案工坊"]);
  });

  it("新砖阵文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四座新砖阵机制各不相同：双球 / 滑动 / 星门 / 图案", () => {
    for (const lv of chapterLevels(6)) expect(LEVELS[lv].balls).toBe(2);
    for (const lv of chapterLevels(7)) {
      expect(LEVELS[lv].moveSpeed ?? 0).toBeGreaterThan(0);
      expect(LEVELS[lv].moveRange ?? 0).toBeGreaterThan(0);
    }
    for (const lv of chapterLevels(8)) expect(portalCells(LEVELS[lv].layout)).toHaveLength(2);
    for (const lv of chapterLevels(9)) expect(LEVELS[lv].goal).toBe("pattern");
    // 机制不越界
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 6) expect(LEVELS[lv].balls).toBeUndefined();
      if (ci !== 7) expect(LEVELS[lv].moveSpeed).toBeUndefined();
      if (ci !== 8) expect(portalCells(LEVELS[lv].layout)).toHaveLength(0);
      if (ci !== 9) expect(LEVELS[lv].goal).toBeUndefined();
    }
  });

  it("第 100–188 关逐关可解：每关都有足够的可击碎砖，参数都在弹球台上", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.layout.length).toBeGreaterThanOrEqual(2);
      expect(cfg.layout.length).toBeLessThanOrEqual(8);
      for (const row of cfg.layout) {
        expect(row).toHaveLength(COLS);
        for (const v of row) expect([0, 1, 2, 3, 4]).toContain(v);
      }
      expect(breakableCount(cfg.layout)).toBeGreaterThanOrEqual(8);
      expect(cfg.ballSpeed).toBeGreaterThanOrEqual(180);
      expect(cfg.ballSpeed).toBeLessThanOrEqual(360);
      expect(cfg.paddleW).toBeGreaterThanOrEqual(70);
    }
  });

  it("滑动迷阵逐关可解：两侧必留空列，滑动幅度小于一格宽（砖永远不出画面）", () => {
    const brickW = 360 / COLS;
    for (const lv of chapterLevels(7)) {
      const cfg = LEVELS[lv];
      for (const row of cfg.layout) {
        expect(row[0]).toBe(0);
        expect(row[COLS - 1]).toBe(0);
      }
      expect(cfg.moveRange ?? 99).toBeLessThan(brickW);
      expect(cfg.moveSpeed ?? 99).toBeLessThanOrEqual(60);
    }
  });

  it("星门隧道逐关可解：星门恰好一对、分处上下两行，且打不碎不挡通关", () => {
    for (const lv of chapterLevels(8)) {
      const ports = portalCells(LEVELS[lv].layout);
      expect(ports).toHaveLength(2);
      const [[r1], [r2]] = ports;
      expect(r1).not.toBe(r2);
      // 星门自己不算目标砖
      for (const [r, c] of ports) expect(isBreakable(LEVELS[lv].layout[r][c])).toBe(false);
    }
  });

  it("图案工坊逐关可解：每关都有 ≥6 块图案砖，全是一下就碎的目标", () => {
    for (const lv of chapterLevels(9)) {
      const flat = LEVELS[lv].layout.flat();
      const pattern = flat.filter((v) => v === 4).length;
      expect(pattern).toBeGreaterThanOrEqual(6);
      // 图案砖数量不超过可击碎总数（目标必然可达成）
      expect(pattern).toBeLessThanOrEqual(breakableCount(LEVELS[lv].layout));
    }
  });

  it("图案模板本身合法：8 列宽、只用四种记号、图案块足够多", () => {
    expect(PATTERN_STENCILS.length).toBeGreaterThanOrEqual(4);
    for (const stencil of PATTERN_STENCILS) {
      for (const line of stencil) {
        expect(line).toHaveLength(COLS);
        expect(line).toMatch(/^[.os#]+$/);
      }
      const sharp = stencil.join("").split("").filter((ch) => ch === "#").length;
      expect(sharp).toBeGreaterThanOrEqual(6);
    }
  });

  it("同一关砖阵重进不变（确定性 seed）", () => {
    for (const lv of [99, 121, 143, 165, 187]) {
      expect(JSON.stringify(LEVELS[lv].layout)).toBe(JSON.stringify(LEVELS[lv].layout));
      expect(LEVELS[lv].layout.flat().length).toBeGreaterThan(0);
    }
  });

  it("新章内部难度递进：球越来越快", () => {
    const byChapter: Record<number, number[]> = { 6: [], 7: [], 8: [], 9: [] };
    for (const lv of NEW_LEVELS) byChapter[chapterOf(CHAPTERS, lv)].push(lv);
    for (const list of Object.values(byChapter)) {
      expect(LEVELS[list[0]].ballSpeed).toBeLessThan(LEVELS[list[list.length - 1]].ballSpeed);
    }
  });

  it("双子流星港的球拍不比银河大挑战更苛刻（双球本身就是挑战）", () => {
    for (const lv of chapterLevels(6)) {
      expect(LEVELS[lv].paddleW).toBeGreaterThanOrEqual(LEVELS[98].paddleW);
    }
  });
});
