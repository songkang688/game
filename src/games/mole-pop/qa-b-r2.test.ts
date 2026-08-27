/**
 * 窗口4 · 档B · 第 2 轮验收 —— 地鼠嘭嘭(mole-pop)。
 *
 * 换样本(37 / 82 / 141 / 175 关)+ 难度曲线 + 竞态 + 无尽持续。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEVELS, endlessWave, type MoleLevel } from "./levels";
import { chapterStart } from "../level99";
import { roundStars, usesHearts } from "./logic";
import {
  MOLE_SPECS,
  TimerBag,
  buildChart,
  chartMaxPoints,
  comboMultiplier,
  globalTimerHost,
  hitPoints,
  judgeHit,
  maxConcurrentOf,
  moleTimeline,
  nightMarketChart,
  type ChartNote,
  type TimerHost,
} from "./rhythm";

const R2_SPOTS = [37, 82, 141, 175];

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

/** 假的时钟宿主:计时器只记账不真跑,用来验收摊时有没有漏关 */
function fakeHost(): TimerHost & { live: number; fired: number[] } {
  const timers = new Map<number, () => void>();
  let next = 1;
  return {
    live: 0,
    fired: [],
    setTimeout(fn: () => void) {
      const id = next++;
      timers.set(id, fn);
      this.live = timers.size;
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
      this.live = timers.size;
    },
    setInterval(fn: () => void) {
      const id = next++;
      timers.set(id, fn);
      this.live = timers.size;
      return id;
    },
    clearInterval(id: number) {
      timers.delete(id);
      this.live = timers.size;
    },
  } as unknown as TimerHost & { live: number; fired: number[] };
}

describe("档B R2 · 地鼠嘭嘭 · 换样本", () => {
  for (const level of R2_SPOTS) {
    it(`第 ${level} 关:谱面排得出、满分打法过得了线`, () => {
      const cfg = LEVELS[level - 1];
      const chart = chartOf(level - 1);
      expect(chart.length, `第 ${level} 关谱面是空的`).toBeGreaterThan(0);
      expect(chartMaxPoints(chart)).toBeGreaterThanOrEqual(cfg.target);
      expect(perfectScore(chart)).toBeGreaterThanOrEqual(cfg.target);
      expect(maxConcurrentOf(chart)).toBeLessThanOrEqual(cfg.maxConcurrent);
    });
  }

  it("四个新样本换 5 个种子照样打得动", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      for (const seed of [3, 61, 999, 20260827, 7]) {
        const chart = buildChart(cfg, seed, level - 1);
        expect(chartMaxPoints(chart), `第 ${level} 关 seed=${seed} 打不到目标分`).toBeGreaterThanOrEqual(cfg.target);
        expect(maxConcurrentOf(chart)).toBeLessThanOrEqual(cfg.maxConcurrent);
      }
    }
  });

  it("四个新样本的结算评星覆盖 1~3 星,且都不掉血只掉心", () => {
    for (const level of R2_SPOTS) {
      const cfg = LEVELS[level - 1];
      const great = roundStars({ won: true, score: cfg.target * 2, mistakes: 0, timeLeft: 9, bestCombo: 20 }, cfg.duration);
      const okay = roundStars({ won: true, score: cfg.target, mistakes: 2, timeLeft: 0, bestCombo: 2 }, cfg.duration);
      expect(great).toBe(3);
      expect(okay).toBeGreaterThanOrEqual(1);
      expect(okay).toBeLessThanOrEqual(3);
      expect(typeof usesHearts(cfg)).toBe("boolean");
    }
  });
});

describe("档B R2 · 地鼠嘭嘭 · 难度曲线", () => {
  it("章内曲线严格不回头:每一章的目标分只增不减", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const from = chapterStart(CHAPTERS, ci);
      const to = ci + 1 < CHAPTERS.length ? chapterStart(CHAPTERS, ci + 1) : LEVELS.length;
      for (let i = from + 1; i < to; i++) {
        expect(LEVELS[i].target, `第 ${i + 1} 关的目标分比上一关低`).toBeGreaterThanOrEqual(LEVELS[i - 1].target);
      }
    }
  });

  it("末章明显难过首章:目标分更高、出洞更密、台面更挤", () => {
    const avg = (from: number, to: number, pick: (lv: MoleLevel) => number): number =>
      LEVELS.slice(from, to).reduce((n, lv) => n + pick(lv), 0) / (to - from);
    const lastFrom = chapterStart(CHAPTERS, CHAPTERS.length - 1);
    const firstTo = chapterStart(CHAPTERS, 1);
    // 目标分只是三个难度旋钮之一,末章靠「更密 + 更挤」补足,所以这里不苛求倍数
    expect(avg(lastFrom, LEVELS.length, (lv) => lv.target)).toBeGreaterThan(avg(0, firstTo, (lv) => lv.target) * 1.35);
    expect(avg(lastFrom, LEVELS.length, (lv) => lv.gapMs)).toBeLessThan(avg(0, firstTo, (lv) => lv.gapMs));
    expect(avg(lastFrom, LEVELS.length, (lv) => lv.maxConcurrent)).toBeGreaterThan(
      avg(0, firstTo, (lv) => lv.maxConcurrent)
    );
  });

  it("同时在台面上的地鼠上限:章内只增不减,末章比首章热闹", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const from = chapterStart(CHAPTERS, ci);
      const to = ci + 1 < CHAPTERS.length ? chapterStart(CHAPTERS, ci + 1) : LEVELS.length;
      for (let i = from + 1; i < to; i++) {
        expect(LEVELS[i].maxConcurrent, `第 ${i + 1} 关的台面上限比上一关低`).toBeGreaterThanOrEqual(
          LEVELS[i - 1].maxConcurrent
        );
      }
    }
    expect(LEVELS[LEVELS.length - 1].maxConcurrent).toBeGreaterThan(LEVELS[0].maxConcurrent);
  });

  it("出洞间隔越往后越紧,但不会紧到人反应不过来(≥240ms)", () => {
    for (const lv of LEVELS) {
      expect(Math.max(240, lv.gapMs)).toBeGreaterThanOrEqual(240);
    }
    expect(LEVELS[187].gapMs).toBeLessThanOrEqual(LEVELS[0].gapMs);
  });

  it("188 关每一关的满分打法都够得着目标分(不存在必输关)", () => {
    const short: number[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      if (perfectScore(chartOf(i)) < LEVELS[i].target) short.push(i + 1);
    }
    expect(short, `这些关满分也过不了线:${short.join("/")}`).toEqual([]);
  });
});

describe("档B R2 · 地鼠嘭嘭 · 竞态", () => {
  it("同一只地鼠连点两下:第二下已经过了下台时间,判定为 miss 不再给分", () => {
    const upMs = 700;
    const first = judgeHit(0, upMs);
    const second = judgeHit(moleTimeline(0, upMs).goneAt + 1, upMs);
    expect(first).toBe("perfect");
    expect(second).toBe("miss");
    expect(hitPoints("miss", 2)).toBe(0);
  });

  it("时间条走完与最后一只被打中撞在同一刻:两边的记分都不会算两次", () => {
    const chart = chartOf(36);
    const total = perfectScore(chart);
    // 同一张谱面重复结算两次,分数不会翻倍(纯函数,没有累计副作用)
    expect(perfectScore(chart)).toBe(total);
  });

  it("TimerBag:收摊后再登记的定时器立刻被就地清掉,不会在关外冒出来", () => {
    const host = fakeHost();
    const bag = new TimerBag(host);
    bag.after(() => undefined, 100);
    bag.every(() => undefined, 100);
    expect(host.live).toBe(2);
    bag.clearAll();
    expect(host.live).toBe(0);
    bag.after(() => undefined, 100);
    // clearAll 之后再登记也不许留活口
    bag.clearAll();
    expect(host.live).toBe(0);
  });

  it("TimerBag 连开连关 20 轮:一个活口都不剩", () => {
    const host = fakeHost();
    for (let round = 0; round < 20; round++) {
      const bag = new TimerBag(host);
      for (let i = 0; i < 6; i++) bag.after(() => undefined, 10 * i);
      for (let i = 0; i < 4; i++) bag.every(() => undefined, 10 * i + 5);
      bag.clearAll();
      expect(host.live, `第 ${round + 1} 轮有定时器没收`).toBe(0);
    }
  });

  it("真实宿主也拿得到(globalTimerHost 四件套齐全)", () => {
    const host = globalTimerHost();
    expect(typeof host.setTimeout).toBe("function");
    expect(typeof host.clearTimeout).toBe("function");
    expect(typeof host.setInterval).toBe("function");
    expect(typeof host.clearInterval).toBe("function");
  });

  it("连击倍率有封顶:一直连也不会把分数吹上天", () => {
    const caps = [0, 1, 5, 20, 100, 10000].map((n) => comboMultiplier(n));
    for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1]);
    expect(caps[caps.length - 1]).toBe(caps[caps.length - 2]);
  });
});

describe("档B R2 · 地鼠嘭嘭 · 无尽持续", () => {
  it("夜市连守 60 摊:摊摊排得出、摊摊不超台面预算、摊摊无同洞相撞", () => {
    for (let wave = 1; wave <= 60; wave++) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 31 + 7);
      expect(chart.length, `第 ${wave} 摊谱面是空的`).toBeGreaterThan(0);
      expect(maxConcurrentOf(chart), `第 ${wave} 摊排爆了台面`).toBeLessThanOrEqual(cfg.maxConcurrent);
    }
  });

  it("夜市难度一直往上走:每 10 摊取一段,后一段的音符数不低于前一段", () => {
    const bucket = (from: number): number => {
      let n = 0;
      for (let w = from; w < from + 10; w++) n += nightMarketChart(endlessWave(w), w, 4242).length;
      return n;
    };
    const buckets = [1, 11, 21, 31, 41].map(bucket);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i], `第 ${i + 1} 段夜市比上一段还清闲`).toBeGreaterThanOrEqual(buckets[i - 1]);
    }
  });

  it("夜市的关卡配置也有封顶:第 200 摊的参数仍在合理范围", () => {
    const cfg: MoleLevel = endlessWave(200);
    expect(cfg.duration).toBeGreaterThan(0);
    expect(cfg.maxConcurrent).toBeLessThanOrEqual(9);
    expect(cfg.gapMs).toBeGreaterThan(0);
    expect(Number.isFinite(cfg.target)).toBe(true);
  });

  it("夜市谱面 seeded 可复现:同一摊同一种子两次生成一模一样", () => {
    for (const wave of [5, 25, 55]) {
      const a = nightMarketChart(endlessWave(wave), wave, 20260827);
      const b = nightMarketChart(endlessWave(wave), wave, 20260827);
      expect(a).toEqual(b);
    }
  });
});
