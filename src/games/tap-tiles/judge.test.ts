/**
 * 音符下落 · 判定窗口、连击分、长按条、速度表(规格第六、七、十四节)。
 *
 * 判定窗口的三档边界(44 / 45 / 46ms 这种)必须一个不落地钉住:
 * 这几行数字一改,整款游戏的手感就变了。
 */
import { describe, expect, it } from "vitest";
import {
  APPROACH_BASE_MS,
  CAMPAIGN_MAX_MISS,
  ENDLESS_MAX_MISS,
  ENDLESS_SPEED_MAX,
  GOOD_MS,
  GOOD_SCORE,
  HOLD_TAIL_MS,
  MAX_MULTIPLIER,
  MISS_LINE,
  PERFECT_MS,
  PERFECT_SCORE,
  SPEED_MAX,
  approachMs,
  comboMultiplier,
  endlessSpeedAt,
  holdTrack,
  judge,
  scoreCombo,
  speedAt,
} from "./judge";

describe("判定窗口", () => {
  it("窗口取值就是 45ms / 100ms", () => {
    expect(PERFECT_MS).toBe(45);
    expect(GOOD_MS).toBe(100);
  });

  it("44 / 45 / 46ms:45 还是完美,46 就掉到良好", () => {
    expect(judge(44)).toBe("perfect");
    expect(judge(45)).toBe("perfect");
    expect(judge(46)).toBe("good");
  });

  it("99 / 100 / 101ms:100 还是良好,101 就是 miss", () => {
    expect(judge(99)).toBe("good");
    expect(judge(100)).toBe("good");
    expect(judge(101)).toBe("miss");
  });

  it("点早点晚一视同仁,负偏差走同一套边界", () => {
    expect(judge(-45)).toBe("perfect");
    expect(judge(-46)).toBe("good");
    expect(judge(-100)).toBe("good");
    expect(judge(-101)).toBe("miss");
    expect(judge(0)).toBe("perfect");
  });

  it("偏差不是有限数就当 miss,不会把 NaN 判成完美", () => {
    expect(judge(Number.NaN)).toBe("miss");
    expect(judge(Number.POSITIVE_INFINITY)).toBe("miss");
  });
});

describe("连击与分数", () => {
  it("倍率每 10 连涨半倍,最高 4 倍", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(9)).toBe(1);
    expect(comboMultiplier(10)).toBe(1.5);
    expect(comboMultiplier(20)).toBe(2);
    expect(comboMultiplier(999)).toBe(MAX_MULTIPLIER);
  });

  it("完美比良好值钱,miss 一分没有", () => {
    expect(scoreCombo("perfect", 1)).toBe(PERFECT_SCORE);
    expect(scoreCombo("good", 1)).toBe(GOOD_SCORE);
    expect(scoreCombo("miss", 40)).toBe(0);
    expect(scoreCombo("perfect", 20)).toBe(PERFECT_SCORE * 2);
  });

  it("连击越高同一个完美拿的分越多", () => {
    expect(scoreCombo("perfect", 30)).toBeGreaterThan(scoreCombo("perfect", 3));
  });
});

describe("长按条", () => {
  const note = { time: 1000, hold: 600 };

  it("头没接住直接 miss,不用看松手", () => {
    const r = holdTrack(note, 1101, 1600);
    expect(r.judgement).toBe("miss");
    expect(r.complete).toBe(false);
    expect(r.reason).toBe("head");
  });

  it("中途松手判 miss", () => {
    const r = holdTrack(note, 1000, 1300);
    expect(r.complete).toBe(false);
    expect(r.judgement).toBe("miss");
    expect(r.reason).toBe("early");
  });

  it("按到尾算完成,判定档跟按下的那一刻走", () => {
    expect(holdTrack(note, 1000, 1600)).toEqual({ judgement: "perfect", complete: true, reason: "" });
    expect(holdTrack(note, 1060, 1700)).toEqual({ judgement: "good", complete: true, reason: "" });
  });

  it("尾端有 100ms 的宽容,再早一毫秒就不算完成", () => {
    expect(HOLD_TAIL_MS).toBe(100);
    expect(holdTrack(note, 1000, 1600 - HOLD_TAIL_MS).complete).toBe(true);
    expect(holdTrack(note, 1000, 1600 - HOLD_TAIL_MS - 1).complete).toBe(false);
  });
});

describe("速度表", () => {
  it("闯关速度随关卡单调递增,并且封在上限", () => {
    for (let lv = 1; lv < 188; lv++) {
      expect(speedAt(lv), `第 ${lv + 1} 关`).toBeGreaterThanOrEqual(speedAt(lv - 1));
    }
    expect(speedAt(0)).toBeLessThan(speedAt(187));
    expect(speedAt(187)).toBeLessThanOrEqual(SPEED_MAX);
    expect(speedAt(9999)).toBe(SPEED_MAX);
  });

  it("无尽速度随时间单调递增,到顶封住", () => {
    let prev = 0;
    for (let s = 0; s <= 400; s += 4) {
      const v = endlessSpeedAt(s * 1000);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(endlessSpeedAt(0)).toBeLessThan(endlessSpeedAt(60_000));
    expect(endlessSpeedAt(10_000_000)).toBe(ENDLESS_SPEED_MAX);
  });

  it("速度越快,音符从顶上落到判定线的时间越短", () => {
    expect(approachMs(1)).toBe(APPROACH_BASE_MS);
    expect(approachMs(2)).toBeLessThan(approachMs(1));
    expect(approachMs(0)).toBe(APPROACH_BASE_MS);
  });
});

describe("生命与文案", () => {
  it("闯关允许漏 3 个,无尽 0 容错", () => {
    expect(CAMPAIGN_MAX_MISS).toBe(3);
    expect(ENDLESS_MAX_MISS).toBe(0);
  });

  it("miss 只说这一句,一个批评的字都没有", () => {
    expect(MISS_LINE).toBe("这个音符溜走啦");
    for (const bad of ["笨", "差", "失败", "菜"]) expect(MISS_LINE.includes(bad)).toBe(false);
  });
});
