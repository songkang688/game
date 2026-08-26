import { describe, expect, it } from "vitest";
import { assertTotal, TOTAL_LEVELS } from "../level99";
import {
  BUILD_COLS,
  CHAPTER_BOSSES,
  LANES,
  MONSTER_INFO,
  TOWER_KINDS,
  TOWER_UNLOCK_CHAPTER,
} from "./logic";
import {
  CHAPTERS,
  CHAPTER_STARTS,
  COOP_TARGET_WAVES,
  HOME_HP,
  LEVELS,
  TOTAL,
  VERSUS_SECONDS,
  buildCoopWave,
  buildEndlessWave,
  chapterOfLevel,
  endlessBoss,
  endlessBudget,
  endlessLevelIndex,
  endlessRoster,
  indexInChapter,
  isBossLevel,
  levelBudget,
  levelMonsterCount,
  rosterAtChapter,
  unlockAtLevel,
  waveCount,
} from "./levels";

describe("章节切分", () => {
  it("八个主题章节,关卡数之和正好 188", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(TOTAL).toBe(188);
    expect(TOTAL).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "monster-crisis")).toBe(true);
  });

  it("每个章节都有名字、图标、粉彩色和一句主题介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji).toBeTruthy();
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("关号能算回所属章节与章内序号", () => {
    expect(chapterOfLevel(0)).toBe(0);
    expect(chapterOfLevel(TOTAL - 1)).toBe(CHAPTERS.length - 1);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = CHAPTER_STARTS[ci];
      expect(chapterOfLevel(start)).toBe(ci);
      expect(indexInChapter(start)).toBe(0);
      expect(chapterOfLevel(start + CHAPTERS[ci].size - 1)).toBe(ci);
      expect(indexInChapter(start + CHAPTERS[ci].size - 1)).toBe(CHAPTERS[ci].size - 1);
    }
  });

  it("每章最后一关是大怪关,一共八只大怪", () => {
    const bossLevels = [];
    for (let i = 0; i < TOTAL; i++) if (isBossLevel(i)) bossLevels.push(i);
    expect(bossLevels.length).toBe(8);
    expect(bossLevels[bossLevels.length - 1]).toBe(TOTAL - 1);
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const last = CHAPTER_STARTS[ci] + CHAPTERS[ci].size - 1;
      expect(LEVELS[last].boss).toBe(CHAPTER_BOSSES[ci]);
    }
  });
});

describe("出场阵容与解锁", () => {
  it("名单只增不减,第一章就两种,最后一章八种全上", () => {
    expect(rosterAtChapter(0)).toEqual(["doodle", "cotton"]);
    for (let ci = 1; ci < 8; ci++) {
      const prev = rosterAtChapter(ci - 1);
      const cur = rosterAtChapter(ci);
      expect(cur.length).toBeGreaterThanOrEqual(prev.length);
      expect(prev.every((k) => cur.includes(k))).toBe(true);
    }
    expect(rosterAtChapter(7).length).toBe(8);
  });

  it("名单里全是普通小怪物,大怪只从章节最后一关登场", () => {
    expect(rosterAtChapter(7).every((k) => !MONSTER_INFO[k].boss)).toBe(true);
    for (let i = 0; i < TOTAL; i++) {
      const bosses = LEVELS[i].waves.flatMap((w) => w.spawns.filter((s) => MONSTER_INFO[s.kind].boss));
      expect(bosses.length).toBe(isBossLevel(i) ? 1 : 0);
    }
  });

  it("新建筑正好在对应章节的第一关解锁", () => {
    for (const kind of TOWER_KINDS) {
      const ci = TOWER_UNLOCK_CHAPTER[kind];
      if (ci === 0) continue;
      expect(unlockAtLevel(CHAPTER_STARTS[ci])).toBe(kind);
    }
    expect(unlockAtLevel(0)).toBeUndefined();
    expect(unlockAtLevel(5)).toBeUndefined();
  });
});

describe("难度曲线", () => {
  it("同一章里一关比一关重(大怪关另算)", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = CHAPTER_STARTS[ci];
      for (let k = 1; k < CHAPTERS[ci].size - 1; k++) {
        expect(levelBudget(start + k)).toBeGreaterThanOrEqual(levelBudget(start + k - 1));
      }
    }
  });

  it("章节之间是往上走的", () => {
    for (let ci = 1; ci < CHAPTERS.length; ci++) {
      expect(levelBudget(CHAPTER_STARTS[ci])).toBeGreaterThan(levelBudget(CHAPTER_STARTS[ci - 1]));
    }
  });

  it("大怪关的杂兵会少一批,好让人专心对付大怪", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const last = CHAPTER_STARTS[ci] + CHAPTERS[ci].size - 1;
      expect(levelBudget(last)).toBeLessThan(levelBudget(last - 1));
    }
  });

  it("波数从 2 波涨到 5 波", () => {
    expect(waveCount(0)).toBe(2);
    expect(waveCount(TOTAL - 1)).toBe(5);
    for (let i = 1; i < TOTAL; i++) {
      expect(waveCount(i)).toBeGreaterThanOrEqual(waveCount(i - 1));
    }
  });

  it("怪的只数从个位数一路涨到三十几只", () => {
    expect(levelMonsterCount(0)).toBeGreaterThanOrEqual(4);
    expect(levelMonsterCount(0)).toBeLessThanOrEqual(8);
    expect(levelMonsterCount(TOTAL - 2)).toBeGreaterThan(20);
  });
});

describe("188 关关卡数据", () => {
  it("每一关的波次、出怪时间、车道都是合法的", () => {
    for (let i = 0; i < TOTAL; i++) {
      const def = LEVELS[i];
      expect(def.chapter).toBe(chapterOfLevel(i));
      expect(def.homeHp).toBe(HOME_HP);
      expect(def.startPaint).toBeGreaterThan(0);
      expect(def.waves.length).toBe(waveCount(i));
      for (const wave of def.waves) {
        expect(wave.spawns.length).toBeGreaterThan(0);
        let prev = -1;
        for (const s of wave.spawns) {
          expect(s.time).toBeGreaterThanOrEqual(0);
          expect(s.time).toBeGreaterThanOrEqual(prev);
          prev = s.time;
          expect(s.lane).toBeGreaterThanOrEqual(0);
          expect(s.lane).toBeLessThan(LANES);
          expect(MONSTER_INFO[s.kind]).toBeTruthy();
        }
      }
    }
  });

  it("每一关只会派出这一章已经登场过的小怪物", () => {
    for (let i = 0; i < TOTAL; i++) {
      const roster = new Set(rosterAtChapter(chapterOfLevel(i)));
      for (const wave of LEVELS[i].waves) {
        for (const s of wave.spawns) {
          if (MONSTER_INFO[s.kind].boss) continue;
          expect(roster.has(s.kind)).toBe(true);
        }
      }
    }
  });

  it("花坛只占右半区,而且一条道上最多两格", () => {
    for (let i = 0; i < TOTAL; i++) {
      const perLane = new Array<number>(LANES).fill(0);
      for (const cell of LEVELS[i].blocked) {
        expect(cell.col).toBeGreaterThanOrEqual(5);
        expect(cell.col).toBeLessThan(BUILD_COLS);
        expect(cell.lane).toBeGreaterThanOrEqual(0);
        expect(cell.lane).toBeLessThan(LANES);
        perLane[cell.lane]++;
      }
      expect(Math.max(...perLane)).toBeLessThanOrEqual(2);
      // 左边五列永远干净,不会出现「无处可摆」的死局
      expect(LEVELS[i].blocked.every((c) => c.col >= 5)).toBe(true);
    }
  });

  it("每一关都用得上五条道,不会全挤在一条", () => {
    for (let i = 0; i < TOTAL; i++) {
      const lanes = new Set(LEVELS[i].waves.flatMap((w) => w.spawns.map((s) => s.lane)));
      expect(lanes.size).toBeGreaterThanOrEqual(2);
    }
    const lastLanes = new Set(LEVELS[TOTAL - 2].waves.flatMap((w) => w.spawns.map((s) => s.lane)));
    expect(lastLanes.size).toBe(LANES);
  });
});

describe("无尽 / 合作 / 对战的波次", () => {
  it("无尽名单越往后越多", () => {
    expect(endlessRoster(1)).toEqual(["doodle", "cotton"]);
    expect(endlessRoster(13).length).toBe(8);
    for (let w = 2; w <= 20; w++) {
      expect(endlessRoster(w).length).toBeGreaterThanOrEqual(endlessRoster(w - 1).length);
    }
  });

  it("无尽每 8 波来一只大怪", () => {
    expect(endlessBoss(1)).toBeNull();
    expect(endlessBoss(7)).toBeNull();
    expect(endlessBoss(8)).toBe(CHAPTER_BOSSES[0]);
    expect(endlessBoss(16)).toBe(CHAPTER_BOSSES[1]);
    expect(endlessBoss(200)).toBe(CHAPTER_BOSSES[CHAPTER_BOSSES.length - 1]);
  });

  it("无尽预算一波比一波高", () => {
    for (let w = 2; w <= 30; w++) {
      expect(endlessBudget(w)).toBeGreaterThan(endlessBudget(w - 1));
    }
  });

  it("等效关号跟着波数往上爬,但不会越界", () => {
    expect(endlessLevelIndex(1)).toBe(0);
    expect(endlessLevelIndex(5)).toBeGreaterThan(endlessLevelIndex(2));
    expect(endlessLevelIndex(999)).toBe(TOTAL - 1);
  });

  it("合作模式的每一波都比同号的无尽波更热闹", () => {
    for (let w = 1; w <= 8; w++) {
      expect(buildCoopWave(w).spawns.length).toBeGreaterThanOrEqual(buildEndlessWave(w).spawns.length);
    }
    expect(COOP_TARGET_WAVES).toBeGreaterThan(5);
    expect(VERSUS_SECONDS).toBeGreaterThan(30);
  });

  it("同一波生成两次结果完全一样(存档 / 回放才对得上)", () => {
    expect(buildEndlessWave(6)).toEqual(buildEndlessWave(6));
    expect(buildCoopWave(6)).toEqual(buildCoopWave(6));
    expect(buildEndlessWave(6)).not.toEqual(buildEndlessWave(7));
  });
});
