/**
 * 音符下落 · 一次演奏的状态机(规格第六节:判定、连击、点空、长按、生命)。
 *
 * 这份测试全部走真正的 `tapLane` / `releaseLane` / `advanceTo`,
 * 界面上会发生什么,这里就断言什么。
 */
import { describe, expect, it } from "vitest";
import { chartFromSeed, type Chart, type Note } from "./chart";
import { CAMPAIGN_MAX_MISS, GOOD_MS, MISS_LINE, PERFECT_MS } from "./judge";
import {
  CAMPAIGN_SOFT_RULES,
  CAMPAIGN_STRICT_RULES,
  ENDLESS_RULES,
  accuracy,
  advanceTo,
  createRun,
  finishRun,
  hitEmpty,
  pendingCount,
  perfectRate,
  releaseLane,
  tapLane,
  type RunRules,
} from "./run";

/** 手搓一张小谱,时间点自己说了算 */
function tinyChart(notes: Note[], durationMs = 6000): Chart {
  return {
    seed: 1,
    speed: 1,
    minGap: 300,
    maxConcurrent: 2,
    lanes: [0, 1, 2, 3],
    notes,
    durationMs,
  };
}

const SOFT: RunRules = CAMPAIGN_SOFT_RULES;
const STRICT: RunRules = CAMPAIGN_STRICT_RULES;

describe("点一下:判定与连击", () => {
  it("踩在线上是完美,偏 60ms 是良好", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }, { lane: 1, time: 2000, hold: 0 }]), SOFT);
    tapLane(run, 0, 1000);
    tapLane(run, 1, 2060);
    expect(run.perfect).toBe(1);
    expect(run.good).toBe(1);
    expect(run.combo).toBe(2);
    expect(run.score).toBeGreaterThan(0);
  });

  it("超过良好窗口没点就 miss,连击断在这里", () => {
    const run = createRun(
      tinyChart([
        { lane: 0, time: 1000, hold: 0 },
        { lane: 0, time: 2000, hold: 0 },
        { lane: 0, time: 3000, hold: 0 },
      ]),
      SOFT
    );
    tapLane(run, 0, 1000);
    expect(run.combo).toBe(1);
    advanceTo(run, 2000 + GOOD_MS + 1);
    expect(run.miss).toBe(1);
    expect(run.combo).toBe(0);
    tapLane(run, 0, 3000);
    expect(run.combo).toBe(1);
    expect(run.maxCombo).toBe(1);
  });

  it("刚好卡在 100ms 上还救得回来,101ms 就来不及了", () => {
    const a = createRun(tinyChart([{ lane: 2, time: 1000, hold: 0 }]), SOFT);
    tapLane(a, 2, 1000 + GOOD_MS);
    expect(a.good).toBe(1);
    expect(a.miss).toBe(0);

    const b = createRun(tinyChart([{ lane: 2, time: 1000, hold: 0 }]), SOFT);
    advanceTo(b, 1000 + GOOD_MS + 1);
    expect(b.miss).toBe(1);
  });

  it("完美窗口的边界也照 45ms 走", () => {
    const run = createRun(
      tinyChart([
        { lane: 0, time: 1000, hold: 0 },
        { lane: 1, time: 2000, hold: 0 },
      ]),
      SOFT
    );
    tapLane(run, 0, 1000 + PERFECT_MS);
    tapLane(run, 1, 2000 + PERFECT_MS + 1);
    expect(run.perfect).toBe(1);
    expect(run.good).toBe(1);
  });

  it("miss 的提示只有那一句", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }]), SOFT);
    advanceTo(run, 1200);
    expect(run.message).toBe(MISS_LINE);
  });
});

describe("点空白格:两种开关", () => {
  it("第 1–2 章:只断连击,还能接着打", () => {
    const run = createRun(
      tinyChart([
        { lane: 0, time: 1000, hold: 0 },
        { lane: 0, time: 2000, hold: 0 },
      ]),
      SOFT
    );
    tapLane(run, 0, 1000);
    expect(run.combo).toBe(1);
    tapLane(run, 3, 1400);
    expect(run.empty).toBe(1);
    expect(run.combo).toBe(0);
    expect(run.over).toBe(false);
    tapLane(run, 0, 2000);
    expect(run.combo).toBe(1);
  });

  it("第 3 章起:点空即结束,而且不算漏音符", () => {
    const run = createRun(
      tinyChart([
        { lane: 0, time: 1000, hold: 0 },
        { lane: 0, time: 2000, hold: 0 },
      ]),
      STRICT
    );
    tapLane(run, 0, 1000);
    tapLane(run, 2, 1400);
    expect(run.over).toBe(true);
    expect(run.cleared).toBe(false);
    expect(run.ended).toBe("empty");
    expect(run.miss).toBe(0);
    expect(run.message).toContain("空白格");
  });

  it("hitEmpty 直接调也是同一套规矩", () => {
    const soft = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }]), SOFT);
    hitEmpty(soft, 1);
    expect(soft.over).toBe(false);
    const strict = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }]), STRICT);
    hitEmpty(strict, 1);
    expect(strict.over).toBe(true);
  });

  it("已经结束之后再乱点,什么都不会再变", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }]), STRICT);
    tapLane(run, 3, 500);
    const snapshot = { score: run.score, empty: run.empty, miss: run.miss };
    expect(tapLane(run, 0, 1000)).toBeNull();
    expect(releaseLane(run, 0, 1100)).toBeNull();
    expect({ score: run.score, empty: run.empty, miss: run.miss }).toEqual(snapshot);
  });
});

describe("长按条", () => {
  const chart = (): Chart => tinyChart([{ lane: 1, time: 1000, hold: 600 }]);

  it("按住到尾才落账:按下的时候还没加分", () => {
    const run = createRun(chart(), SOFT);
    tapLane(run, 1, 1000);
    expect(run.score).toBe(0);
    expect(run.combo).toBe(0);
    expect(pendingCount(run)).toBe(1);
    releaseLane(run, 1, 1600);
    expect(run.perfect).toBe(1);
    expect(run.combo).toBe(1);
    expect(run.score).toBeGreaterThan(0);
  });

  it("中途松手判 miss", () => {
    const run = createRun(chart(), SOFT);
    tapLane(run, 1, 1000);
    releaseLane(run, 1, 1200);
    expect(run.miss).toBe(1);
    expect(run.combo).toBe(0);
    expect(run.message).toBe(MISS_LINE);
    expect(run.perfect).toBe(0);
  });

  it("一直按着不松,到了尾端自动算完成", () => {
    const run = createRun(chart(), SOFT);
    tapLane(run, 1, 1000);
    advanceTo(run, 1700);
    expect(run.perfect).toBe(1);
    expect(run.miss).toBe(0);
  });

  it("头就没接住的长按条照样是 miss", () => {
    const run = createRun(chart(), SOFT);
    advanceTo(run, 1000 + GOOD_MS + 1);
    expect(run.miss).toBe(1);
    expect(releaseLane(run, 1, 1600)).toBeNull();
  });
});

describe("生命与收尾", () => {
  it("闯关漏满 3 个还能撑住,第 4 个才收工", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 4; i++) notes.push({ lane: 0, time: 1000 + i * 500, hold: 0 });
    const run = createRun(tinyChart(notes), SOFT);
    advanceTo(run, 1000 + 2 * 500 + GOOD_MS + 1);
    expect(run.miss).toBe(CAMPAIGN_MAX_MISS);
    expect(run.over).toBe(false);
    advanceTo(run, 1000 + 3 * 500 + GOOD_MS + 1);
    expect(run.miss).toBe(4);
    expect(run.over).toBe(true);
    expect(run.cleared).toBe(false);
    expect(run.ended).toBe("miss");
  });

  it("无尽 0 容错:漏一个就结束", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }, { lane: 0, time: 2000, hold: 0 }]), ENDLESS_RULES);
    advanceTo(run, 1200);
    expect(run.over).toBe(true);
    expect(run.ended).toBe("miss");
  });

  it("整张谱走完且没超容错就算过关", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }, { lane: 1, time: 1500, hold: 0 }], 3000), SOFT);
    tapLane(run, 0, 1000);
    tapLane(run, 1, 1500);
    expect(run.over).toBe(false);
    advanceTo(run, 3000);
    expect(run.cleared).toBe(true);
    expect(run.ended).toBe("cleared");
    expect(accuracy(run)).toBe(1);
    expect(perfectRate(run)).toBe(1);
  });

  it("finishRun 会把剩下的音符结算掉,不会卡在半路", () => {
    const run = createRun(tinyChart([{ lane: 0, time: 1000, hold: 0 }, { lane: 1, time: 9000, hold: 0 }], 12000), SOFT);
    tapLane(run, 0, 1000);
    finishRun(run);
    expect(run.over).toBe(true);
    expect(pendingCount(run)).toBe(0);
    expect(run.miss).toBe(1);
  });
});

describe("拿真谱面跑一遍", () => {
  it("完美地点完一张真谱:零 miss、连击一路到底", () => {
    const chart = chartFromSeed(2024, 1, 1.5, { count: 24, holdChance: 0.25, chordChance: 0.3 });
    const run = createRun(chart, SOFT);
    // 按时间顺序喂事件:长按条的松手可能排在后面几个音符之后
    const events: Array<{ t: number; lane: number; down: boolean }> = [];
    for (const note of chart.notes) {
      events.push({ t: note.time, lane: note.lane, down: true });
      if (note.hold > 0) events.push({ t: note.time + note.hold, lane: note.lane, down: false });
    }
    events.sort((a, b) => a.t - b.t);
    for (const ev of events) {
      if (ev.down) tapLane(run, ev.lane, ev.t);
      else releaseLane(run, ev.lane, ev.t);
    }
    finishRun(run);
    expect(run.miss).toBe(0);
    expect(run.perfect).toBe(chart.notes.length);
    expect(run.maxCombo).toBe(chart.notes.length);
    expect(run.cleared).toBe(true);
  });
});
