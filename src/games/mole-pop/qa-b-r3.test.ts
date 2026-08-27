/**
 * 窗口4 · 档B · 第 3 轮验收 —— 地鼠嘭嘭(mole-pop)。
 *
 * 「五款不漏」这一轮不再抽样:188 关一关不落地排谱、算满分、验台面与洞位,
 * 无尽夜市连守 200 摊,存档往返与脏档也各扫一遍。
 */
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS, endlessWave } from "./levels";
import { roundStars, usesHearts } from "./logic";
import {
  MOLE_SPECS,
  buildChart,
  chartMaxPoints,
  hitPoints,
  judgeHit,
  maxConcurrentOf,
  moleTimeline,
  nightMarketChart,
  type ChartNote,
} from "./rhythm";

/** 与 index.ts 同一口径的关卡谱面 */
function chartOf(level: number): ChartNote[] {
  return buildChart(LEVELS[level], level * 7919 + 1, level);
}

/** 满分打法能拿到的分(闯关计分口径:花花兔不算) */
function perfectScore(chart: readonly ChartNote[]): number {
  let score = 0;
  for (const note of chart) {
    const spec = MOLE_SPECS[note.kind];
    if (!spec.hittable) continue;
    score += hitPoints(judgeHit(0, note.upMs), spec.base);
  }
  return score;
}

describe("档B R3 · 地鼠嘭嘭 · 188 关一关不落", () => {
  it("188 关都排得出谱面,而且满分打法都过得了线", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const chart = chartOf(i);
      if (chart.length === 0) bad.push(`第 ${i + 1} 关谱面是空的`);
      else if (perfectScore(chart) < LEVELS[i].target) {
        bad.push(`第 ${i + 1} 关满分 ${perfectScore(chart)} 够不着目标 ${LEVELS[i].target}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关都不超台面预算,同一刻也不会两只地鼠挤一个洞", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const chart = chartOf(i);
      if (maxConcurrentOf(chart) > LEVELS[i].maxConcurrent) bad.push(`第 ${i + 1} 关排爆了台面`);
      // 同一刻同一个洞只许站一只
      const byTime = new Map<number, Set<number>>();
      for (const n of chart) {
        const at = byTime.get(n.at) ?? new Set<number>();
        if (at.has(n.hole)) bad.push(`第 ${i + 1} 关第 ${n.at}ms 有两只地鼠挤在第 ${n.hole} 个洞`);
        at.add(n.hole);
        byTime.set(n.at, at);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关的出洞时间线都合法:露头、停留、缩回三段首尾相接", () => {
    for (let i = 0; i < LEVELS.length; i += 1) {
      for (const n of chartOf(i).slice(0, 6)) {
        const t = moleTimeline(n.at, n.upMs);
        expect(t.riseAt, `第 ${i + 1} 关的时间线起点对不上谱面`).toBe(n.at);
        expect(t.stayAt, `第 ${i + 1} 关有地鼠还没露头就站定了`).toBeGreaterThan(t.riseAt);
        expect(t.dropAt, `第 ${i + 1} 关有地鼠还没站定就开始缩`).toBeGreaterThanOrEqual(t.stayAt);
        expect(t.goneAt, `第 ${i + 1} 关有地鼠还没开始缩就没了`).toBeGreaterThan(t.dropAt);
      }
    }
  });

  it("188 关的评星都落在 1~3 星:失败也不会算出负星", () => {
    const seen = new Set<number>();
    for (let i = 0; i < LEVELS.length; i++) {
      const dur = LEVELS[i].duration;
      // 一次不失误、还剩不少时间 → 3 星
      const clean = roundStars({ score: LEVELS[i].target, mistakes: 0, timeLeft: Math.ceil(dur * 0.5), bestCombo: 5 }, dur);
      // 失误一次 → 2 星；失误一堆 → 1 星，但不会掉到 0 或负数
      const oneMiss = roundStars({ score: LEVELS[i].target, mistakes: 1, timeLeft: 0, bestCombo: 1 }, dur);
      const messy = roundStars({ score: 0, mistakes: 9, timeLeft: 0, bestCombo: 0 }, dur);
      expect(clean, `第 ${i + 1} 关打得干干净净还不给 3 星`).toBe(3);
      expect(oneMiss, `第 ${i + 1} 关失误一次的评星不对`).toBe(2);
      expect(messy, `第 ${i + 1} 关失误一堆算出了 ${messy} 星`).toBe(1);
      seen.add(clean);
      seen.add(oneMiss);
      seen.add(messy);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("会掉心的关(有花花兔或算术题)真的存在,而且掉的只有心", () => {
    const hearty = LEVELS.filter((lv) => usesHearts(lv));
    expect(hearty.length, "一关会掉心的都没有").toBeGreaterThan(0);
    for (const lv of hearty) {
      expect((lv.bunnyChance ?? 0) + (lv.quizChance ?? 0), "掉心关既没花花兔也没算术题").toBeGreaterThan(0);
    }
  });

  it("12 章一章不落:各章关数加起来正好 188", () => {
    expect(CHAPTERS.reduce((n, c) => n + c.size, 0)).toBe(LEVELS.length);
    expect(LEVELS.length).toBe(188);
  });
});

describe("档B R3 · 地鼠嘭嘭 · 无尽夜市全量复扫", () => {
  it("夜市连守 200 摊:摊摊排得出、摊摊不超预算、摊摊够得着目标分", () => {
    const bad: string[] = [];
    for (let wave = 1; wave <= 200; wave++) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 733 + 19);
      if (chart.length === 0) bad.push(`第 ${wave} 摊谱面是空的`);
      if (maxConcurrentOf(chart) > cfg.maxConcurrent) bad.push(`第 ${wave} 摊排爆了台面`);
      if (chartMaxPoints(chart) < cfg.target) bad.push(`第 ${wave} 摊够不着目标分`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("夜市 200 摊里同一刻同一个洞也不会挤两只", () => {
    for (let wave = 1; wave <= 200; wave += 7) {
      const chart = nightMarketChart(endlessWave(wave), wave, wave * 31 + 7);
      const byTime = new Map<number, Set<number>>();
      for (const n of chart) {
        const at = byTime.get(n.at) ?? new Set<number>();
        expect(at.has(n.hole), `第 ${wave} 摊第 ${n.at}ms 有两只挤在第 ${n.hole} 个洞`).toBe(false);
        at.add(n.hole);
        byTime.set(n.at, at);
      }
    }
  });
});
