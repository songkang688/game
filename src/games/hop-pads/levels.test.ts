/**
 * 跳跳台 · 188 关切分与评星的回归。
 */
import { describe, expect, it } from "vitest";
import { assertTotal, chapterOf } from "../level99";
import { REACH_MAX, REACH_MIN } from "./physics";
import { buildPads, requiredPowerRange } from "./pads";
import {
  CATCH_LINE,
  CHAPTERS,
  CHAPTER_KINDS,
  buildLevel,
  kindsLine,
  levelPassed,
  levelSeed,
  levelStars,
  loseLine,
  winLine,
} from "./levels";
import guide from "./guide";

describe("章节切分", () => {
  it("8 章的关数之和恒等 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("章节名、图标、颜色、介绍一个都不缺", () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
    }
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(8);
  });

  it("每一章按规格引入自己的新台面", () => {
    expect(CHAPTER_KINDS[0]).toEqual(["steady"]);
    expect(CHAPTER_KINDS[3]).toContain("slider");
    expect(CHAPTER_KINDS[4]).toContain("shrink");
    expect(CHAPTER_KINDS[5]).toContain("spring");
    expect(CHAPTER_KINDS[6]).toContain("once");
    for (const k of ["steady", "slider", "shrink", "spring", "once"]) {
      expect(CHAPTER_KINDS[7]).toContain(k);
    }
    expect(kindsLine(3)).toContain("移动台");
  });
});

describe("每一关都组装得出来", () => {
  it("188 关全能组装,章号与 level99 的算法对得上", () => {
    for (let lv = 0; lv < 188; lv++) {
      const l = buildLevel(lv);
      expect(l.level).toBe(lv);
      expect(l.chapterIndex).toBe(chapterOf(CHAPTERS, lv));
      expect(l.indexInChapter).toBeGreaterThanOrEqual(0);
      expect(l.indexInChapter).toBeLessThan(CHAPTERS[l.chapterIndex].size);
      expect(l.goal).toBeGreaterThanOrEqual(5);
      expect(l.goal).toBeLessThanOrEqual(16);
      expect(l.hint).toContain("站住");
    }
  });

  it("越往后目标座数越多,同一章内不倒退", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      let prev = 0;
      let start = 0;
      for (let i = 0; i < ci; i++) start += CHAPTERS[i].size;
      for (let i = 0; i < CHAPTERS[ci].size; i++) {
        const goal = buildLevel(start + i).goal;
        expect(goal).toBeGreaterThanOrEqual(prev);
        prev = goal;
      }
    }
    expect(buildLevel(187).goal).toBeGreaterThan(buildLevel(0).goal);
  });

  it("关号越界会被夹回 0–187,不会造出第 189 关", () => {
    expect(buildLevel(-5).level).toBe(0);
    expect(buildLevel(9999).level).toBe(187);
  });

  it("每一关的 seed 都不一样,台序不会两关撞车", () => {
    const seeds = new Set<number>();
    for (let lv = 0; lv < 188; lv++) seeds.add(levelSeed(lv));
    expect(seeds.size).toBe(188);
  });

  it("训练关开着辅助圆:每章前三关都有", () => {
    expect(buildLevel(0).assist).toBe(true);
    expect(buildLevel(7).assist).toBe(true);
    expect(buildLevel(23).assist).toBe(false);
    expect(buildLevel(24).assist).toBe(true);
    expect(buildLevel(26).assist).toBe(true);
    expect(buildLevel(30).assist).toBe(false);
  });

  it("抽查若干关:每一关的台序座座都在 0.2–0.9 的力度里", () => {
    let checked = 0;
    for (let lv = 0; lv < 188; lv += 11) {
      const l = buildLevel(lv);
      const pads = buildPads(l.seed, l.difficulty, l.goal + 4);
      for (let i = 1; i < pads.length; i++) {
        const range = requiredPowerRange(pads[i - 1], pads[i], 16);
        expect(range.min, `第 ${lv + 1} 关第 ${i} 座`).toBeGreaterThanOrEqual(REACH_MIN);
        expect(range.max, `第 ${lv + 1} 关第 ${i} 座`).toBeLessThanOrEqual(REACH_MAX);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(100);
  });
});

describe("过关与评星", () => {
  it("座数够了才算过关", () => {
    const l = buildLevel(0);
    expect(levelPassed(l, { cleared: l.goal, perfects: 0, score: 10, bestCombo: 0 })).toBe(true);
    expect(levelPassed(l, { cleared: l.goal - 1, perfects: 9, score: 90, bestCombo: 9 })).toBe(false);
  });

  it("完美越多星越多,三档都取得到", () => {
    const l = buildLevel(5);
    expect(levelStars(l, { cleared: l.goal, perfects: 0, score: 1, bestCombo: 0 })).toBe(1);
    expect(levelStars(l, { cleared: l.goal, perfects: l.perfectFor2, score: 1, bestCombo: 1 })).toBe(2);
    expect(levelStars(l, { cleared: l.goal, perfects: l.perfectFor3, score: 1, bestCombo: 1 })).toBe(3);
    expect(l.perfectFor2).toBeLessThanOrEqual(l.perfectFor3);
    expect(l.perfectFor3).toBeLessThanOrEqual(l.goal);
  });

  it("圆心课整整一章都得跳跳完美才给三星", () => {
    for (let lv = 48; lv < 72; lv++) {
      const l = buildLevel(lv);
      expect(l.chapterIndex).toBe(2);
      expect(l.perfectFor3).toBe(l.goal);
      expect(levelStars(l, { cleared: l.goal, perfects: l.goal - 1, score: 1, bestCombo: 1 })).toBeLessThan(3);
    }
  });

  it("掉下去的文案是云朵接住,不是死亡,而且只鼓励", () => {
    const l = buildLevel(30);
    const line = loseLine(l, { cleared: 2, perfects: 1, score: 4, bestCombo: 1 });
    expect(line).toContain(CATCH_LINE);
    expect(line).toContain("再站住");
    for (const bad of ["死", "输惨", "笨"]) expect(line).not.toContain(bad);
  });

  it("过关的话按星级说不同的话", () => {
    const l = buildLevel(60);
    const res = { cleared: l.goal, perfects: l.goal, score: 40, bestCombo: l.goal };
    expect(winLine(l, res, 3)).toContain("满分");
    expect(winLine(l, { ...res, perfects: l.perfectFor2 }, 2)).toContain("三星");
    expect(winLine(l, { ...res, perfects: 0 }, 1)).toContain("过关");
  });
});

describe("攻略", () => {
  it("gameId 对得上,八章都写到了,而且盖满 188 关", () => {
    expect(guide.gameId).toBe("hop-pads");
    expect(guide.entries).toHaveLength(8);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
    for (const e of guide.entries) expect(e.tips.length).toBeGreaterThanOrEqual(2);
  });

  it("攻略里讲清了移动台要挑换向那一下", () => {
    const all = guide.entries.flatMap((e) => e.tips).join("");
    expect(all).toContain("落地");
    expect(all).toContain("换向");
  });
});
