/**
 * 音符下落 · 谱面生成与三条约束(规格第六节)。
 *
 * 规格要求「对 ≥ 50 个随机谱断言这三条」:同一时刻最多 2 轨、相邻音符最小间隔、
 * 长按条不与同轨其他块重叠。这里一次跑 60 张谱,三条一条不落。
 */
import { describe, expect, it } from "vitest";
import {
  ALL_LANES,
  BOSS_MAX_CONCURRENT,
  DEFAULT_MAX_CONCURRENT,
  GAP_BASE,
  LANE_COUNT,
  MIN_GAP_FLOOR,
  chartFromSeed,
  chordCount,
  concurrentAt,
  holdCount,
  minGapMs,
  validateChart,
  type Chart,
} from "./chart";

/** 60 张参数各不相同的随机谱 */
function randomCharts(n = 60): Chart[] {
  const out: Chart[] = [];
  for (let i = 0; i < n; i++) {
    const speed = 1 + (i % 9) * 0.25;
    const density = 0.6 + (i % 7) * 0.15;
    const boss = i % 11 === 0;
    out.push(
      chartFromSeed(1000 + i * 37, density, speed, {
        lanes: i % 4 === 3 ? [0, 2] : ALL_LANES,
        count: 12 + (i % 20),
        holdChance: (i % 5) * 0.12,
        chordChance: (i % 6) * 0.1,
        maxConcurrent: boss ? BOSS_MAX_CONCURRENT : DEFAULT_MAX_CONCURRENT,
      })
    );
  }
  return out;
}

const CHARTS = randomCharts();

describe("最小间隔换算", () => {
  it("速度越快间隔越短,但不会低于下限", () => {
    expect(minGapMs(1)).toBe(GAP_BASE);
    expect(minGapMs(2)).toBeLessThan(minGapMs(1));
    expect(minGapMs(9)).toBe(MIN_GAP_FLOOR);
    expect(minGapMs(0)).toBe(GAP_BASE);
  });
});

describe("谱面三条约束 · 60 张随机谱", () => {
  it("先确认这批谱本身有料:音符、长按条、双押都不缺", () => {
    expect(CHARTS.length).toBeGreaterThanOrEqual(50);
    expect(CHARTS.every((c) => c.notes.length >= 10)).toBe(true);
    expect(CHARTS.reduce((s, c) => s + holdCount(c), 0)).toBeGreaterThan(0);
    expect(CHARTS.reduce((s, c) => s + chordCount(c), 0)).toBeGreaterThan(0);
  });

  it("约束一:同一时刻有块的轨道数不超过上限", () => {
    for (const chart of CHARTS) {
      for (const n of chart.notes) {
        expect(concurrentAt(chart.notes, n.time), `seed ${chart.seed} 的 ${n.time}ms`).toBeLessThanOrEqual(
          chart.maxConcurrent
        );
      }
      expect(chart.maxConcurrent).toBeLessThanOrEqual(BOSS_MAX_CONCURRENT);
    }
  });

  it("约束二:相邻两个时刻的间隔都 ≥ minGap", () => {
    for (const chart of CHARTS) {
      const times = [...new Set(chart.notes.map((n) => n.time))].sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1], `seed ${chart.seed}`).toBeGreaterThanOrEqual(chart.minGap);
      }
    }
  });

  it("约束三:长按条不与同轨的任何块重叠", () => {
    for (const chart of CHARTS) {
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        const own = chart.notes.filter((n) => n.lane === lane).sort((a, b) => a.time - b.time);
        for (let i = 1; i < own.length; i++) {
          expect(own[i].time, `seed ${chart.seed} 第 ${lane} 轨`).toBeGreaterThan(
            own[i - 1].time + own[i - 1].hold
          );
        }
      }
    }
  });

  it("validateChart 对这 60 张谱一张都挑不出毛病", () => {
    for (const chart of CHARTS) {
      const check = validateChart(chart);
      expect(check.errors.slice(0, 3), `seed ${chart.seed}`).toEqual([]);
      expect(check.ok).toBe(true);
    }
  });
});

describe("chartFromSeed 本身", () => {
  it("同一个 seed 生成的谱一模一样", () => {
    const a = chartFromSeed(4321, 1, 1.4, { count: 30, holdChance: 0.3, chordChance: 0.3 });
    const b = chartFromSeed(4321, 1, 1.4, { count: 30, holdChance: 0.3, chordChance: 0.3 });
    expect(a.notes).toEqual(b.notes);
    expect(chartFromSeed(4322, 1, 1.4, { count: 30 }).notes).not.toEqual(a.notes);
  });

  it("音符按时间排好序,数量与轨道都听参数的", () => {
    const chart = chartFromSeed(77, 1.1, 1.6, { count: 25, lanes: [1, 3], chordChance: 0.4 });
    expect(chart.notes).toHaveLength(25);
    expect(chart.lanes).toEqual([1, 3]);
    expect(new Set(chart.notes.map((n) => n.lane))).toEqual(new Set([1, 3]));
    for (let i = 1; i < chart.notes.length; i++) {
      expect(chart.notes[i].time).toBeGreaterThanOrEqual(chart.notes[i - 1].time);
    }
    expect(chart.durationMs).toBeGreaterThan(chart.notes[chart.notes.length - 1].time);
  });

  it("Boss 关放开到三押,普通谱最多两押", () => {
    const boss = chartFromSeed(555, 1.4, 2, { count: 60, chordChance: 0.9, maxConcurrent: 3 });
    const plain = chartFromSeed(555, 1.4, 2, { count: 60, chordChance: 0.9 });
    const widest = (c: Chart): number => Math.max(...c.notes.map((n) => concurrentAt(c.notes, n.time)));
    expect(widest(boss)).toBe(3);
    expect(widest(plain)).toBe(DEFAULT_MAX_CONCURRENT);
  });

  it("单轨谱不会冒出别的轨,也不会自己叠住自己", () => {
    const chart = chartFromSeed(9, 0.9, 1, { count: 20, lanes: [2], holdChance: 0.5 });
    expect(chart.notes.every((n) => n.lane === 2)).toBe(true);
    expect(validateChart(chart).ok).toBe(true);
  });
});

describe("validateChart 真的会红", () => {
  it("同一时刻挤了三条轨会被抓出来", () => {
    const chart = chartFromSeed(1, 1, 1, { count: 4, lanes: ALL_LANES });
    const t = chart.notes[0].time;
    chart.notes.push({ lane: 1, time: t, hold: 0 }, { lane: 2, time: t, hold: 0 });
    const check = validateChart(chart);
    expect(check.ok).toBe(false);
    expect(check.errors.join()).toContain("超过上限");
  });

  it("挨得太近会被抓出来", () => {
    const chart = chartFromSeed(2, 1, 1, { count: 4, lanes: [0, 1] });
    chart.notes.push({ lane: 1, time: chart.notes[0].time + 10, hold: 0 });
    expect(validateChart(chart).errors.join()).toContain("比最小间隔还密");
  });

  it("同轨长按条压住后面的块会被抓出来", () => {
    const chart = chartFromSeed(3, 1, 1, { count: 4, lanes: [0] });
    chart.notes[0] = { lane: 0, time: chart.notes[0].time, hold: 5000 };
    expect(validateChart(chart).errors.join()).toContain("叠上了");
  });
});
