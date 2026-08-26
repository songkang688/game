/**
 * 音符下落 · 四档假人(规格第十一节)。
 *
 * 噪声取值按规格钉死;固定谱面下地狱档要显著高于菜鸟档——这条是硬断言。
 */
import { describe, expect, it } from "vitest";
import { chartFromSeed } from "./chart";
import {
  AI_TIERS,
  BOT_RULES,
  TIER_NAMES,
  TIER_NOISE_MS,
  TIER_SLIP_RATE,
  aiRun,
  aiScore,
  perfectRun,
  runBot,
  tierLine,
  type AiTier,
} from "./ai";
import { CAMPAIGN_SOFT_RULES } from "./run";

const CHART = chartFromSeed(20260826, 1.1, 1.6, {
  count: 60,
  holdChance: 0.2,
  chordChance: 0.3,
});

/** 多跑几个 seed 取平均,免得单局运气影响结论 */
function meanScore(tier: AiTier, seeds = 12): number {
  let sum = 0;
  for (let s = 0; s < seeds; s++) sum += aiScore(CHART, tier, 100 + s * 13);
  return sum / seeds;
}

describe("档位参数", () => {
  it("噪声就是 ±80 / ±40 / ±15 / ±5 毫秒", () => {
    expect(TIER_NOISE_MS).toEqual({ rookie: 80, normal: 40, expert: 15, hell: 5 });
    expect(AI_TIERS).toEqual(["rookie", "normal", "expert", "hell"]);
  });

  it("档位名干净好懂,地狱档不会手滑漏音符", () => {
    expect(Object.values(TIER_NAMES)).toEqual(["菜鸟", "普通", "高手", "地狱"]);
    expect(TIER_SLIP_RATE.hell).toBe(0);
    expect(TIER_SLIP_RATE.rookie).toBeGreaterThan(TIER_SLIP_RATE.expert);
  });

  it("每一档的介绍都只讲手感,不损人", () => {
    for (const tier of AI_TIERS) {
      const line = tierLine(tier);
      expect(line.length).toBeGreaterThan(6);
      for (const bad of ["笨", "废", "太差", "活该"]) expect(line.includes(bad)).toBe(false);
    }
  });
});

describe("假人打谱", () => {
  it("同一个 seed 打出来的结果完全一样", () => {
    expect(aiRun(CHART, "normal", 42).score).toBe(aiRun(CHART, "normal", 42).score);
    expect(aiRun(CHART, "normal", 42).score).not.toBe(aiRun(CHART, "normal", 4242).score);
  });

  it("地狱档一下不差:全部完美、零 miss", () => {
    const hell = aiRun(CHART, "hell", 3);
    expect(hell.miss).toBe(0);
    expect(hell.perfect).toBe(CHART.notes.length);
  });

  it("菜鸟档会打出一堆良好,手感明显更抖", () => {
    const rookie = aiRun(CHART, "rookie", 3);
    expect(rookie.good).toBeGreaterThan(0);
    expect(rookie.perfect).toBeLessThan(CHART.notes.length);
  });

  it("固定谱面下,地狱档得分显著高于菜鸟档", () => {
    const hell = meanScore("hell");
    const rookie = meanScore("rookie");
    expect(hell).toBeGreaterThan(rookie * 1.3);
  });

  it("四档从菜鸟到地狱一档比一档强", () => {
    const scores = AI_TIERS.map((t) => meanScore(t));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i], `${TIER_NAMES[AI_TIERS[i]]} 应该不弱于 ${TIER_NAMES[AI_TIERS[i - 1]]}`).toBeGreaterThan(
        scores[i - 1]
      );
    }
  });

  it("假人不会因为漏几个就退场,它的容错是敞开的", () => {
    expect(BOT_RULES.maxMiss).toBe(Number.POSITIVE_INFINITY);
    const rookie = aiRun(CHART, "rookie", 11);
    expect(rookie.over).toBe(true);
    expect(rookie.notes.every((n) => n.status === "done" || n.status === "missed")).toBe(true);
  });
});

describe("完美机器人", () => {
  it("零噪声零手滑,整张谱全完美", () => {
    const state = perfectRun(CHART);
    expect(state.perfect).toBe(CHART.notes.length);
    expect(state.miss).toBe(0);
    expect(state.empty).toBe(0);
    expect(state.cleared).toBe(true);
    expect(state.maxCombo).toBe(CHART.notes.length);
  });

  it("给它加上噪声就不再是满分了", () => {
    const noisy = runBot(CHART, CAMPAIGN_SOFT_RULES, 70, 5);
    expect(noisy.score).toBeLessThan(perfectRun(CHART).score);
  });
});
