// 1.1：接住小水果 99 → 188 的新果道、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  HEAVY_FRUITS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  THEME_SETS,
} from "./levels";

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

describe("接住小水果 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "果园清晨", "淘气乌鸦", "金色午后", "大风天", "雷雨天", "夜晚萤火",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("798ab042");
  });

  it("前 6 个主题的水果/坏东西/背景一样都没换", () => {
    expect(THEME_SETS.length).toBeGreaterThanOrEqual(10);
    expect(THEME_SETS[0].fruits).toEqual(["🍎", "🍌", "🍓", "🍇", "🍑", "🍊"]);
    expect(THEME_SETS[4].bad).toBe("💧");
    expect(THEME_SETS[5].gold).toBe("✨");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.baskets).toBeUndefined();
      expect(lv.heavyChance).toBeUndefined();
      expect(lv.conveyor).toBeUndefined();
      expect(lv.combo).toBeUndefined();
    }
  });
});

describe("接住小水果 · 1.1 新果道", () => {
  it("总关数 188，末尾追加了 4 条全新果道共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["双篮果谷", "沉甸果坡", "传送果道", "连击星光坡"]);
  });

  it("新果道文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四条新果道机制各不相同：双篮 / 沉水果 / 传送带 / 连击", () => {
    for (const lv of chapterLevels(6)) expect(LEVELS[lv].baskets).toBe(2);
    for (const lv of chapterLevels(7)) expect(LEVELS[lv].heavyChance ?? 0).toBeGreaterThan(0);
    for (const lv of chapterLevels(8)) expect(LEVELS[lv].conveyor ?? 0).not.toBe(0);
    for (const lv of chapterLevels(9)) expect(LEVELS[lv].combo).toBe(true);
    // 双篮与传送带不越界；连击章允许在后段客串沉水果（混合终章）
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 6) expect(LEVELS[lv].baskets).toBeUndefined();
      if (ci !== 8) expect(LEVELS[lv].conveyor).toBeUndefined();
      if (ci !== 9) expect(LEVELS[lv].combo).toBeUndefined();
      if (ci !== 7 && ci !== 9) expect(LEVELS[lv].heavyChance).toBeUndefined();
    }
  });

  it("第 100–188 关逐关可玩：目标、节奏、概率都有上下界", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.target).toBeGreaterThanOrEqual(10);
      expect(cfg.target).toBeLessThanOrEqual(40);
      expect(cfg.spawnMs).toBeGreaterThanOrEqual(600);
      expect(cfg.speed).toBeGreaterThanOrEqual(0.9);
      expect(cfg.speed).toBeLessThanOrEqual(2);
      expect(cfg.badChance).toBeLessThanOrEqual(0.25);
      expect(cfg.badChance + cfg.goldChance + (cfg.heavyChance ?? 0)).toBeLessThan(0.5);
      expect(cfg.wind).toBeLessThanOrEqual(1.5);
      expect(Math.abs(cfg.conveyor ?? 0)).toBeLessThanOrEqual(120);
      expect(cfg.theme).toBeGreaterThanOrEqual(6);
      expect(cfg.theme).toBeLessThan(THEME_SETS.length);
    }
  });

  it("传送果道两个方向都练到（左右轮换）", () => {
    const dirs = new Set(chapterLevels(8).map((lv) => Math.sign(LEVELS[lv].conveyor ?? 0)));
    expect(dirs).toEqual(new Set([1, -1]));
  });

  it("四个新主题的水果全是原创 emoji 组合，沉水果单独成表", () => {
    for (const ts of THEME_SETS.slice(6)) {
      expect(ts.fruits.length).toBe(6);
      expect(ts.bad.length).toBeGreaterThan(0);
      expect(ts.gold.length).toBeGreaterThan(0);
      expect(ts.bg).toContain("linear-gradient");
    }
    expect(HEAVY_FRUITS.length).toBeGreaterThanOrEqual(3);
    // 沉水果不与坏东西混淆
    for (const ts of THEME_SETS.slice(6)) {
      for (const heavy of HEAVY_FRUITS) expect(ts.bad).not.toBe(heavy);
    }
  });

  it("新章内部难度递进：目标更多、掉得更快、出得更密", () => {
    for (const ci of [6, 7, 8, 9]) {
      const list = chapterLevels(ci);
      const first = LEVELS[list[0]];
      const last = LEVELS[list[list.length - 1]];
      expect(first.target).toBeLessThanOrEqual(last.target);
      expect(first.speed).toBeLessThan(last.speed);
      expect(first.spawnMs).toBeGreaterThan(last.spawnMs);
    }
  });

  it("双篮果谷的坏东西概率不高于单篮章节（双篮更难躲）", () => {
    for (const lv of chapterLevels(6)) {
      expect(LEVELS[lv].badChance).toBeLessThanOrEqual(0.2);
    }
  });
});
