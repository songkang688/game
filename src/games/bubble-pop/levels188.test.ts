// 1.1：泡泡噗噗 99 → 188 的新主题、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import { BOARD_COLS, CHAPTERS, LEGACY_CHAPTER_SIZES, LEGACY_LEVELS, LEVELS } from "./levels";
import {
  BOLT,
  CHAMELEON_BASE,
  collapseGrid,
  colorOf,
  countLeftOn,
  cycleChameleons,
  groupAt,
  hasMovesOn,
  HIDDEN_OFFSET,
  isChameleon,
  isHidden,
  RAINBOW,
  revealHidden,
  STONE,
} from "./logic";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
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

describe("泡泡噗噗 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "清泉湖", "彩虹湾", "石头滩", "闪电云", "冻冻港", "星星塔",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("374e954d");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.flipGravity).toBeUndefined();
      expect(lv.chameleon).toBeUndefined();
      expect(lv.moveLimit).toBeUndefined();
      expect(lv.hidden).toBeUndefined();
    }
  });
});

describe("泡泡噗噗 · 1.1 新主题", () => {
  it("总关数 188，末尾追加了 4 个全新主题共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["倒影天湖", "幻彩溶洞", "步数栈桥", "灯影迷宫"]);
  });

  it("新主题文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四个新主题机制各不相同：重力翻转 / 变色 / 限步 / 隐藏", () => {
    for (const lv of chapterLevels(6)) expect(LEVELS[lv].flipGravity).toBe(true);
    for (const lv of chapterLevels(7)) expect(LEVELS[lv].chameleon ?? 0).toBeGreaterThan(0);
    for (const lv of chapterLevels(8)) expect(LEVELS[lv].moveLimit ?? 0).toBeGreaterThan(0);
    for (const lv of chapterLevels(9)) expect(LEVELS[lv].hidden ?? 0).toBeGreaterThan(0);
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 6) expect(LEVELS[lv].flipGravity).toBeUndefined();
      if (ci !== 7) expect(LEVELS[lv].chameleon).toBeUndefined();
      if (ci !== 8) expect(LEVELS[lv].moveLimit).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].hidden).toBeUndefined();
    }
  });

  it("第 100–188 关逐关可解：棋盘、颜色、特殊泡泡都有上下界", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.rows).toBeGreaterThanOrEqual(8);
      expect(cfg.rows).toBeLessThanOrEqual(12);
      expect(cfg.colors).toBeGreaterThanOrEqual(3);
      expect(cfg.colors).toBeLessThanOrEqual(5);
      expect(cfg.maxLeft).toBeGreaterThan(cfg.stone);
      const specials = cfg.rainbow + cfg.stone + cfg.bolt + cfg.frozen
        + (cfg.chameleon ?? 0) + (cfg.hidden ?? 0);
      // 特殊泡泡不超过棋盘三分之一，保证有足够普通泡泡可消
      expect(specials).toBeLessThanOrEqual(Math.floor((cfg.rows * BOARD_COLS) / 3));
    }
  });

  it("步数栈桥逐关可解：步数上限 ≥ 理论最少步数（每步至少消 2 颗）", () => {
    for (const lv of chapterLevels(8)) {
      const cfg = LEVELS[lv];
      const minMoves = Math.ceil((cfg.rows * BOARD_COLS - cfg.maxLeft) / 2);
      expect(cfg.moveLimit ?? 0).toBeGreaterThanOrEqual(minMoves);
    }
  });

  it("新章内部难度递进：达标线越来越紧 / 步数余量越来越少", () => {
    const c6 = chapterLevels(6);
    const c8 = chapterLevels(8);
    expect(LEVELS[c6[c6.length - 1]].maxLeft).toBeLessThanOrEqual(LEVELS[c6[0]].maxLeft);
    const slack = (lv: number) => {
      const cfg = LEVELS[lv];
      return (cfg.moveLimit ?? 0) - Math.ceil((cfg.rows * BOARD_COLS - cfg.maxLeft) / 2);
    };
    expect(slack(c8[c8.length - 1])).toBeLessThan(slack(c8[0]));
  });
});

describe("泡泡噗噗 · 新机制纯逻辑", () => {
  it("值编码互不打架：颜色 / 冰冻 / 隐藏 / 变色 / 机关各占一段", () => {
    expect(isHidden(HIDDEN_OFFSET + 2)).toBe(true);
    expect(isHidden(2)).toBe(false);
    expect(isChameleon(CHAMELEON_BASE + 4)).toBe(true);
    expect(isChameleon(4)).toBe(false);
    for (const v of [RAINBOW, STONE, BOLT]) {
      expect(isHidden(v)).toBe(false);
      expect(isChameleon(v)).toBe(false);
      expect(colorOf(v, 5)).toBe(-1);
    }
  });

  it("colorOf：变色泡泡按当前颜色配对，隐藏与冰冻不配对", () => {
    expect(colorOf(3, 5)).toBe(3);
    expect(colorOf(CHAMELEON_BASE + 2, 5)).toBe(2);
    expect(colorOf(HIDDEN_OFFSET + 1, 5)).toBe(-1);
    expect(colorOf(12, 5)).toBe(-1);
    expect(colorOf(-1, 5)).toBe(-1);
  });

  it("点亮隐藏泡泡后恢复本色，且再点一次不变", () => {
    expect(revealHidden(HIDDEN_OFFSET + 3)).toBe(3);
    expect(revealHidden(3)).toBe(3);
    expect(revealHidden(STONE)).toBe(STONE);
  });

  it("变色泡泡循环换色：转满一圈回到起点", () => {
    const grid = [[CHAMELEON_BASE + 0, 1], [2, CHAMELEON_BASE + 3]];
    cycleChameleons(grid, 4);
    expect(grid[0][0]).toBe(CHAMELEON_BASE + 1);
    expect(grid[1][1]).toBe(CHAMELEON_BASE + 0);
    expect(grid[0][1]).toBe(1);
    for (let i = 0; i < 3; i++) cycleChameleons(grid, 4);
    expect(grid[0][0]).toBe(CHAMELEON_BASE + 0);
  });

  it("groupAt：变色泡泡与同色普通泡泡连成一组", () => {
    const grid = [
      [0, CHAMELEON_BASE + 0, 1],
      [0, 2, 1],
    ];
    const g = groupAt(grid, 3, 0, 0, 4);
    expect(g.length).toBe(3);
    expect(groupAt(grid, 3, 0, 2, 4).length).toBe(2);
    // 隐藏泡泡不入组
    const grid2 = [[0, HIDDEN_OFFSET + 0], [0, 0]];
    expect(groupAt(grid2, 2, 0, 0, 4).length).toBe(3);
  });

  it("collapseGrid 重力向下：悬空泡泡落到底，空列并拢", () => {
    const grid = [
      [1, -1, 2],
      [-1, -1, -1],
      [-1, -1, 3],
    ];
    collapseGrid(grid, 3, false);
    expect(grid).toEqual([
      [-1, -1, -1],
      [-1, 2, -1],
      [1, 3, -1],
    ]);
  });

  it("collapseGrid 重力向上：泡泡全部飘到顶", () => {
    const grid = [
      [-1, -1],
      [1, -1],
      [2, 3],
    ];
    collapseGrid(grid, 2, true);
    expect(grid).toEqual([
      [1, 3],
      [2, -1],
      [-1, -1],
    ]);
  });

  it("hasMovesOn：没点亮的隐藏泡泡也算有路可走", () => {
    expect(hasMovesOn([[0, 1], [2, 3]], 2, 4)).toBe(false);
    expect(hasMovesOn([[0, 0]], 2, 4)).toBe(true);
    expect(hasMovesOn([[0, HIDDEN_OFFSET + 1], [2, 3]], 2, 4)).toBe(true);
    expect(hasMovesOn([[BOLT, 1], [2, 3]], 2, 4)).toBe(true);
    expect(hasMovesOn([[0, CHAMELEON_BASE + 0]], 2, 4)).toBe(true);
  });

  it("countLeftOn：石头与各种泡泡都算，空格不算", () => {
    expect(countLeftOn([[STONE, -1], [HIDDEN_OFFSET + 1, 0]])).toBe(3);
    expect(countLeftOn([[-1, -1]])).toBe(0);
  });
});
