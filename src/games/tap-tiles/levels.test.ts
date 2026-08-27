/**
 * 音符下落 · 188 关关卡表(规格第九、十四节)。
 *
 * 最要紧的一条:完美机器人得能把 188 关一关不落地打完,
 * 顺便每一关的谱面都要过 `validateChart` 的三条约束。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { perfectRun } from "./ai";
import { BOSS_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT, concurrentAt, validateChart } from "./chart";
import { CAMPAIGN_MAX_MISS, speedAt } from "./judge";
import {
  CHAPTERS,
  buildLevel,
  endlessWave,
  levelBrief,
  levelChart,
  levelRules,
  levelStars,
  loseLine,
  matchChart,
  winLine,
} from "./levels";
import { createRun, type RunState } from "./run";

const ALL_LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i));

describe("章节切分", () => {
  it("八章,关数之和恒等于 188", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS)).toBe(true);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(6);
    }
  });

  it("每一关都落在自己那一章里,seed 各不相同", () => {
    const seeds = new Set<number>();
    for (const lv of ALL_LEVELS) {
      expect(lv.chapter).toBe(chapterOf(CHAPTERS, lv.level));
      seeds.add(lv.seed);
    }
    expect(seeds.size).toBe(TOTAL_LEVELS);
  });
});

describe("机制逐章引入", () => {
  it("第 1 章只有一条轨,第 2 章两条", () => {
    for (const lv of ALL_LEVELS.filter((l) => l.chapter === 0)) expect(lv.lanes).toHaveLength(1);
    for (const lv of ALL_LEVELS.filter((l) => l.chapter === 1)) expect(lv.lanes).toHaveLength(2);
  });

  it("前两章点空只断连击,第 3 章起点空即结束", () => {
    for (const lv of ALL_LEVELS) {
      expect(lv.emptyRule, `第 ${lv.level + 1} 关`).toBe(lv.chapter <= 1 ? "combo" : "end");
      expect(levelRules(lv).maxMiss).toBe(CAMPAIGN_MAX_MISS);
    }
  });

  it("长按条从第 4 章才出现,之前一根都没有", () => {
    for (const lv of ALL_LEVELS) {
      if (lv.chapter < 3) expect(lv.holdChance, `第 ${lv.level + 1} 关`).toBe(0);
      else expect(lv.holdChance).toBeGreaterThan(0);
    }
    const early = levelChart(buildLevel(10));
    expect(early.notes.every((n) => n.hold === 0)).toBe(true);
    const late = levelChart(buildLevel(80));
    expect(late.notes.some((n) => n.hold > 0)).toBe(true);
  });

  it("第 7 章是双人分轨,别的章不是", () => {
    for (const lv of ALL_LEVELS) expect(lv.split).toBe(lv.chapter === 6);
  });

  it("三押只出现在标了 boss 的压轴关,而且关卡数据里写明了", () => {
    const bosses = ALL_LEVELS.filter((l) => l.boss);
    expect(bosses.length).toBe(2);
    for (const lv of ALL_LEVELS) {
      expect(lv.maxConcurrent, `第 ${lv.level + 1} 关`).toBeLessThanOrEqual(
        lv.boss ? BOSS_MAX_CONCURRENT : DEFAULT_MAX_CONCURRENT
      );
      if (lv.boss) expect(lv.maxConcurrent).toBe(BOSS_MAX_CONCURRENT);
    }
    const chart = levelChart(bosses[bosses.length - 1]);
    expect(Math.max(...chart.notes.map((n) => concurrentAt(chart.notes, n.time)))).toBe(BOSS_MAX_CONCURRENT);
  });

  it("速度与音符数一路往上走", () => {
    for (const lv of ALL_LEVELS) expect(lv.speed).toBe(speedAt(lv.level));
    expect(ALL_LEVELS[0].speed).toBeLessThan(ALL_LEVELS[187].speed);
    expect(ALL_LEVELS[0].count).toBeLessThan(ALL_LEVELS[187].count);
  });
});

describe("188 关谱面", () => {
  const charts = ALL_LEVELS.map((lv) => levelChart(lv));

  it("每一关的谱面都过三条约束", () => {
    for (const [i, chart] of charts.entries()) {
      const check = validateChart(chart);
      expect(check.errors.slice(0, 2), `第 ${i + 1} 关`).toEqual([]);
    }
  });

  it("每一关都真的有音符,而且只用本关声明的轨道", () => {
    for (const [i, chart] of charts.entries()) {
      expect(chart.notes.length, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(14);
      const lanes = new Set(chart.notes.map((n) => n.lane));
      for (const lane of lanes) expect(ALL_LEVELS[i].lanes).toContain(lane);
    }
  });

  it("完美机器人能把 188 关全部打完:零 miss、全部完美", () => {
    for (const [i, chart] of charts.entries()) {
      const state: RunState = perfectRun(chart, levelRules(ALL_LEVELS[i]));
      expect(state.miss, `第 ${i + 1} 关漏了音符`).toBe(0);
      expect(state.empty, `第 ${i + 1} 关点到了空白`).toBe(0);
      expect(state.cleared, `第 ${i + 1} 关没打完`).toBe(true);
      expect(state.perfect, `第 ${i + 1} 关不是全完美`).toBe(chart.notes.length);
    }
  });

  it("完美机器人在每一关都能拿三星", () => {
    for (const [i, chart] of charts.entries()) {
      expect(levelStars(perfectRun(chart, levelRules(ALL_LEVELS[i]))), `第 ${i + 1} 关`).toBe(3);
    }
  });
});

describe("评星与文案", () => {
  function fakeState(miss: number, empty: number, perfect: number, total: number): RunState {
    const state = createRun(levelChart(buildLevel(0)), levelRules(buildLevel(0)));
    state.notes = state.notes.slice(0, total);
    state.miss = miss;
    state.empty = empty;
    state.perfect = perfect;
    return state;
  }

  it("零失误又大多完美给 3 星,漏一个 2 星,再多 1 星", () => {
    expect(levelStars(fakeState(0, 0, 20, 20))).toBe(3);
    expect(levelStars(fakeState(0, 0, 10, 20))).toBe(2);
    expect(levelStars(fakeState(1, 0, 18, 20))).toBe(2);
    expect(levelStars(fakeState(2, 0, 18, 20))).toBe(1);
    expect(levelStars(fakeState(0, 1, 20, 20))).toBe(1);
  });

  it("过关和没过关的话都只鼓励", () => {
    for (const line of [winLine(1, 12), winLine(2, 30), winLine(3, 44), loseLine("miss"), loseLine("empty")]) {
      expect(line.length).toBeGreaterThan(6);
      for (const bad of ["笨", "废", "太差", "活该", "真菜"]) expect(line.includes(bad)).toBe(false);
    }
    expect(loseLine("empty")).toContain("空白格");
  });

  it("关卡简介把轨数、音符数和速度都说清楚了", () => {
    const brief = levelBrief(buildLevel(187));
    expect(brief).toContain("轨");
    expect(brief).toContain("音符");
    expect(brief).toContain("速度");
  });
});

describe("无尽与对战的谱面", () => {
  it("无尽一段比一段快,一段比一段多", () => {
    const waves = [0, 1, 2, 5, 9, 14].map((w) => endlessWave(w));
    for (let i = 1; i < waves.length; i++) {
      expect(waves[i].speed).toBeGreaterThanOrEqual(waves[i - 1].speed);
      expect(waves[i].notes.length).toBeGreaterThanOrEqual(waves[i - 1].notes.length);
    }
    for (const w of waves) expect(validateChart(w).ok).toBe(true);
  });

  it("对战谱同一 round 两边拿到的完全一样,而且完美机器人打得完", () => {
    expect(matchChart(3).notes).toEqual(matchChart(3).notes);
    expect(matchChart(3).notes).not.toEqual(matchChart(4).notes);
    for (const r of [1, 4, 9]) {
      const chart = matchChart(r);
      expect(validateChart(chart).ok).toBe(true);
      expect(perfectRun(chart).miss).toBe(0);
    }
  });
});
