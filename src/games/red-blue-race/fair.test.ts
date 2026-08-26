import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { LEVELS, TRACK_LEN } from "./levels";
import {
  FALSE_START_MAX_SETBACK_MS,
  FALSE_START_SETBACK_MS,
  HANDICAP_DEFAULT_ON,
  HANDICAP_MAX,
  START_DELAY_MAX_MS,
  START_DELAY_MIN_MS,
  buildDuelTrack,
  buildMirroredLanes,
  cloneLane,
  falseStartSetbackMs,
  falseStartVerdict,
  handicapBoost,
  handicapLabel,
  lanesMirrored,
  leadHint,
  startDelayMs
} from "./fair";

describe("红蓝赛跑 · 两条赛道完全镜像", () => {
  it("同一张机关表分给两条道，种类、位置、长度一个不差", () => {
    const table = [
      { type: "hurdle" as const, pos: 20, len: 4 },
      { type: "item" as const, pos: 44, len: 4 },
      { type: "puddle" as const, pos: 70, len: 4 }
    ];
    const { red, blue } = buildMirroredLanes(table);
    expect(lanesMirrored(red, blue)).toBe(true);
    expect(red).toEqual(blue);
  });

  it("两条道各拿一份副本：擦掉红道的一个，蓝道那个还在", () => {
    const { red, blue } = buildMirroredLanes([{ type: "hurdle", pos: 30, len: 4 }]);
    expect(red[0]).not.toBe(blue[0]);
    red[0].pos = 99;
    expect(blue[0].pos).toBe(30);
    expect(lanesMirrored(red, blue)).toBe(false);
  });

  it("镜像断言真的拦得住不对称：数量、位置、种类、长度差一点都算不镜像", () => {
    const base = [{ type: "hurdle" as const, pos: 30, len: 4 }];
    expect(lanesMirrored(base, [])).toBe(false);
    expect(lanesMirrored(base, [{ type: "hurdle", pos: 31, len: 4 }])).toBe(false);
    expect(lanesMirrored(base, [{ type: "puddle", pos: 30, len: 4 }])).toBe(false);
    expect(lanesMirrored(base, [{ type: "hurdle", pos: 30, len: 5 }])).toBe(false);
    expect(lanesMirrored(base, cloneLane(base))).toBe(true);
  });

  it("188 关一关不落：每一关摊给两条道都是完全镜像的", () => {
    const bad: number[] = [];
    for (const [i, lv] of LEVELS.entries()) {
      const { red, blue } = buildMirroredLanes(lv.obstacles);
      if (!lanesMirrored(red, blue) || red.length !== lv.obstacles.length) bad.push(i + 1);
    }
    expect(bad).toEqual([]);
  });

  it("对战场的赛道也是两条道共用一张表，机关不挤在一起", () => {
    for (let seed = 0; seed < 12; seed++) {
      const { red, blue } = buildDuelTrack(mulberry32(seed * 97 + 3), 5);
      expect(lanesMirrored(red, blue)).toBe(true);
      expect(red.length).toBeGreaterThan(0);
      for (const ob of red) {
        expect(ob.pos).toBeGreaterThanOrEqual(18);
        expect(ob.pos + ob.len).toBeLessThanOrEqual(TRACK_LEN);
      }
      for (let i = 1; i < red.length; i++) {
        expect(red[i].pos - red[i - 1].pos).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it("同一个 seed 排出来的赛道每次都一样", () => {
    const a = buildDuelTrack(mulberry32(4242), 5).red;
    const b = buildDuelTrack(mulberry32(4242), 5).red;
    expect(a).toEqual(b);
  });
});

describe("红蓝赛跑 · 起跑随机延迟", () => {
  it("延迟落在 700–2100ms，两端取到边界值", () => {
    expect(startDelayMs(() => 0)).toBe(START_DELAY_MIN_MS);
    expect(startDelayMs(() => 1)).toBe(START_DELAY_MAX_MS);
    expect(startDelayMs(() => 0.5)).toBe((START_DELAY_MIN_MS + START_DELAY_MAX_MS) / 2);
  });

  it("脏随机数不会让口令永远不响", () => {
    for (const r of [Number.NaN, -3, 7]) {
      const d = startDelayMs(() => r);
      expect(d).toBeGreaterThanOrEqual(START_DELAY_MIN_MS);
      expect(d).toBeLessThanOrEqual(START_DELAY_MAX_MS);
    }
  });

  it("真随机源下每次都在区间内，而且不是同一个数", () => {
    const rand = mulberry32(2026);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const d = startDelayMs(rand);
      expect(d).toBeGreaterThanOrEqual(START_DELAY_MIN_MS);
      expect(d).toBeLessThanOrEqual(START_DELAY_MAX_MS);
      seen.add(d);
    }
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("红蓝赛跑 · 抢跑回退半秒，不判负", () => {
  it("每抢一次回退 0.5 秒，累计封顶 1.5 秒", () => {
    expect(falseStartSetbackMs(0)).toBe(0);
    expect(falseStartSetbackMs(1)).toBe(FALSE_START_SETBACK_MS);
    expect(falseStartSetbackMs(2)).toBe(FALSE_START_SETBACK_MS * 2);
    expect(falseStartSetbackMs(3)).toBe(FALSE_START_MAX_SETBACK_MS);
    expect(falseStartSetbackMs(20)).toBe(FALSE_START_MAX_SETBACK_MS);
    expect(falseStartSetbackMs(Number.NaN)).toBe(0);
  });

  it("抢多少次都不判负，只回退", () => {
    for (let n = 0; n <= 10; n++) {
      const v = falseStartVerdict(n);
      expect(v.disqualified).toBe(false);
      expect(v.setbackMs).toBeLessThanOrEqual(FALSE_START_MAX_SETBACK_MS);
    }
  });

  it("提示语说清楚要等多久，而且明说不算输", () => {
    expect(falseStartVerdict(1).message).toContain("0.5");
    expect(falseStartVerdict(1).message).toContain("不算输");
    expect(falseStartVerdict(0).message).not.toContain("输");
  });
});

describe("红蓝赛跑 · 让分开关", () => {
  it("默认关着，关着就是一点都不改", () => {
    expect(HANDICAP_DEFAULT_ON).toBe(false);
    expect(handicapBoost(false, 10, 60)).toBe(1);
    expect(handicapBoost(false, 60, 10)).toBe(1);
  });

  it("只帮落后的一方，领先方既不加速也不被拖慢", () => {
    expect(handicapBoost(true, 60, 10)).toBe(1);
    expect(handicapBoost(true, 30, 30)).toBe(1);
    expect(handicapBoost(true, 20, 30)).toBeGreaterThan(1);
  });

  it("助推封顶 8%，差距再大也不会超", () => {
    expect(handicapBoost(true, 0, 25)).toBeCloseTo(1 + HANDICAP_MAX, 10);
    expect(handicapBoost(true, 0, 99)).toBeCloseTo(1 + HANDICAP_MAX, 10);
    for (let gap = 0; gap <= 100; gap += 5) {
      const boost = handicapBoost(true, 0, gap);
      expect(boost).toBeGreaterThanOrEqual(1);
      expect(boost).toBeLessThanOrEqual(1 + HANDICAP_MAX);
    }
  });

  it("差得越多助推越大，落在 8% 以内单调不减", () => {
    let prev = 0;
    for (let gap = 0; gap <= 30; gap += 2) {
      const boost = handicapBoost(true, 0, gap);
      expect(boost).toBeGreaterThanOrEqual(prev);
      prev = boost;
    }
    expect(handicapBoost(true, Number.NaN, 40)).toBeGreaterThan(1);
    expect(handicapBoost(true, 10, 20, 0)).toBeGreaterThan(1);
  });

  it("HUD 上的芯片文字说得清是开是关，也写明封顶几个百分点", () => {
    expect(handicapLabel(false)).toContain("关");
    expect(handicapLabel(true)).toContain("开");
    expect(handicapLabel(true)).toContain("8%");
  });
});

describe("红蓝赛跑 · 领先落后提示只给方法", () => {
  it("落后时也只讲怎么追，不出现难听话", () => {
    const shaming = ["笨", "慢死", "废", "菜", "没用", "输定"];
    for (const gap of [-40, -12, -3, 0, 3, 12, 40]) {
      const hint = leadHint(gap);
      expect(hint.length).toBeGreaterThan(0);
      for (const w of shaming) expect(hint).not.toContain(w);
    }
    expect(leadHint(Number.NaN)).toBe(leadHint(0));
  });

  it("领先和落后给的是不一样的话", () => {
    expect(leadHint(30)).not.toBe(leadHint(-30));
    expect(leadHint(-30)).toContain("追");
  });
});
