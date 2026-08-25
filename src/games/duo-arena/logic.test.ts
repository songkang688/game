import { describe, expect, it } from "vitest";
import {
  BOMB_STUN_SECONDS,
  DOUBLE_SECONDS,
  FREEZE_SECONDS,
  MAX_ROUNDS,
  ROUND_SECONDS,
  ROUNDS_TO_WIN,
  applyTap,
  buildRoundSchedule,
  matchState,
  roundWinner,
  tapScore,
} from "./logic";

describe("计分", () => {
  it("小花 1 分、金币 2 分、炸弹扣 2 分、礼物 0 分", () => {
    expect(tapScore("bloom", false)).toBe(1);
    expect(tapScore("coin", false)).toBe(2);
    expect(tapScore("bomb", false)).toBe(-2);
    expect(tapScore("gift", false)).toBe(0);
  });

  it("双倍星光只加倍好东西", () => {
    expect(tapScore("bloom", true)).toBe(2);
    expect(tapScore("coin", true)).toBe(4);
    expect(tapScore("bomb", true)).toBe(-2);
  });

  it("分数不会低于 0", () => {
    expect(applyTap(1, "bomb", false)).toBe(0);
    expect(applyTap(0, "bomb", false)).toBe(0);
    expect(applyTap(5, "bomb", false)).toBe(3);
    expect(applyTap(3, "coin", true)).toBe(7);
  });
});

describe("出目标时间表", () => {
  it("同种子同回合的时间表一模一样（双方公平）", () => {
    expect(buildRoundSchedule(123, 1)).toEqual(buildRoundSchedule(123, 1));
    expect(buildRoundSchedule(123, 3)).toEqual(buildRoundSchedule(123, 3));
  });

  it("所有目标都在回合时间内出现", () => {
    for (const round of [1, 2, 3]) {
      const evs = buildRoundSchedule(9, round);
      expect(evs.length).toBeGreaterThan(10);
      for (const e of evs) {
        expect(e.t).toBeGreaterThan(0);
        expect(e.t).toBeLessThan(ROUND_SECONDS);
        expect(e.ttl).toBeGreaterThan(1);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThanOrEqual(1);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("时间按先后排列，主要是能得分的目标", () => {
    const evs = buildRoundSchedule(7, 2);
    for (let i = 1; i < evs.length; i++) {
      expect(evs[i].t).toBeGreaterThan(evs[i - 1].t);
    }
    const good = evs.filter((e) => e.kind === "bloom" || e.kind === "coin").length;
    expect(good / evs.length).toBeGreaterThan(0.5);
  });

  it("礼物每回合最多 3 个且都带效果", () => {
    for (const seed of [1, 22, 333, 4444]) {
      const gifts = buildRoundSchedule(seed, 2).filter((e) => e.kind === "gift");
      expect(gifts.length).toBeLessThanOrEqual(3);
      for (const g of gifts) {
        expect(["plus3", "freeze", "double"]).toContain(g.effect);
      }
    }
  });

  it("第 3 回合比第 1 回合节奏更快（目标更多）", () => {
    const r1 = buildRoundSchedule(55, 1).length;
    const r3 = buildRoundSchedule(55, 3).length;
    expect(r3).toBeGreaterThan(r1);
  });
});

describe("回合与比赛", () => {
  it("回合胜负按得分", () => {
    expect(roundWinner(5, 3)).toBe(0);
    expect(roundWinner(2, 8)).toBe(1);
    expect(roundWinner(4, 4)).toBe(-1);
  });

  it("先拿 2 个回合胜直接获胜", () => {
    expect(matchState([0, 0])).toEqual({ done: true, winner: 0 });
    expect(matchState([1, 0, 1])).toEqual({ done: true, winner: 1 });
  });

  it("三回合打完按回合胜场多者赢", () => {
    expect(matchState([0, -1, -1])).toEqual({ done: true, winner: 0 });
    expect(matchState([-1, -1, 1])).toEqual({ done: true, winner: 1 });
  });

  it("三回合全平进入决胜回合，直到分出胜负", () => {
    expect(matchState([-1, -1, -1])).toEqual({ done: false, sudden: true });
    expect(matchState([0, 1, -1])).toEqual({ done: false, sudden: true });
    expect(matchState([0, 1, -1, -1])).toEqual({ done: false, sudden: true });
    expect(matchState([0, 1, -1, 0])).toEqual({ done: true, winner: 0 });
  });

  it("常量取值合理", () => {
    expect(ROUNDS_TO_WIN).toBe(2);
    expect(MAX_ROUNDS).toBe(3);
    expect(FREEZE_SECONDS).toBeGreaterThan(0);
    expect(DOUBLE_SECONDS).toBeGreaterThan(0);
    expect(BOMB_STUN_SECONDS).toBeGreaterThan(0);
  });
});
