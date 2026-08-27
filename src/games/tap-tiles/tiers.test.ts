/**
 * 音符下落 · 同谱对战的档位分层（QA 第 2 轮 · 包 B · R2B-4）。
 *
 * 测试员实测：对战头几局里 `普通 / 高手 / 大师` 三档成绩**完全一样**，
 * 第 1 局三档都是 4200（满分也是 4200）、第 3 局都是 5150，要到第 6 局谱面变密才分得开。
 * 根子在时间噪声：普通档 ±40ms 整个落在 ±45ms 的完美窗口里，短谱又几乎抽不到手滑。
 *
 * 这里守住三件事：四档在**每一局**都严格分得开、最高档仍旧一下不差（B-2 的平局前提不能塌）、
 * 中间两档的失手是确定性的（同一张谱同一档，偏的永远是同样那几个音符）。
 */
import { describe, expect, it } from "vitest";
import {
  AI_TIERS,
  LOOSE_OFFSET_MS,
  TIER_LOOSE_EVERY,
  aiRun,
  looseOffsetFor,
  perfectRun,
  type AiTier,
} from "./ai";
import { GOOD_MS, PERFECT_MS } from "./judge";
import { matchChart } from "./levels";

/** 对战里假人用的种子就是 chart.seed + 5，和 index.ts 的 mountVersus 保持一致 */
function versusScore(round: number, tier: AiTier): number {
  const chart = matchChart(round);
  return aiRun(chart, tier, chart.seed + 5).score;
}

describe("对战档位的分层", () => {
  it("从第 1 局起，四档就一档比一档高（不再是三档同分）", () => {
    for (let round = 1; round <= 8; round++) {
      const scores = AI_TIERS.map((t) => versusScore(round, t));
      for (let i = 1; i < scores.length; i++) {
        expect(
          scores[i],
          `第 ${round} 局：${AI_TIERS[i]} ${scores[i]} 应该高过 ${AI_TIERS[i - 1]} ${scores[i - 1]}`
        ).toBeGreaterThan(scores[i - 1]);
      }
    }
  });

  it("第 1 局这张谱上，普通与高手都不再是满分，只有最高档才是", () => {
    const chart = matchChart(1);
    const full = perfectRun(chart).score;
    expect(versusScore(1, "hell")).toBe(full);
    expect(versusScore(1, "expert")).toBeLessThan(full);
    expect(versusScore(1, "normal")).toBeLessThan(versusScore(1, "expert"));
  });

  it("最高档仍旧一下不差：零 miss、零良好，满分玩家最好也只能打平", () => {
    for (let round = 1; round <= 8; round++) {
      const chart = matchChart(round);
      const hell = aiRun(chart, "hell", chart.seed + 5);
      expect(hell.miss, `第 ${round} 局`).toBe(0);
      expect(hell.good, `第 ${round} 局`).toBe(0);
      expect(hell.perfect, `第 ${round} 局`).toBe(chart.notes.length);
    }
  });

  it("中间两档掉的是「良好」不是「miss」：连击不断，只少拿分", () => {
    const chart = matchChart(1);
    for (const tier of ["normal", "expert"] as AiTier[]) {
      const run = aiRun(chart, tier, chart.seed + 5);
      expect(run.good, `${tier} 应该打出几个良好`).toBeGreaterThan(0);
      expect(run.miss, `${tier} 不该漏音符`).toBe(0);
      expect(run.maxCombo).toBe(chart.notes.length);
    }
  });

  it("失手是确定性的：同一张谱同一档，跑两遍一模一样", () => {
    const chart = matchChart(3);
    for (const tier of AI_TIERS) {
      const a = aiRun(chart, tier, chart.seed + 5);
      const b = aiRun(chart, tier, chart.seed + 5);
      expect(a.score).toBe(b.score);
      expect(a.good).toBe(b.good);
    }
  });

  it("档位越高，故意打偏的间隔越疏，最高档一次都不偏", () => {
    expect(TIER_LOOSE_EVERY.rookie).toBeLessThan(TIER_LOOSE_EVERY.normal);
    expect(TIER_LOOSE_EVERY.normal).toBeLessThan(TIER_LOOSE_EVERY.expert);
    expect(TIER_LOOSE_EVERY.hell).toBe(0);
  });
});

describe("故意打偏的偏移量", () => {
  it("偏出完美窗口、仍在良好窗口里", () => {
    expect(LOOSE_OFFSET_MS).toBeGreaterThan(PERFECT_MS);
    expect(LOOSE_OFFSET_MS).toBeLessThan(GOOD_MS);
  });

  it("同轨下一个块挤过来的时候宁可打准，也不偏到隔壁块的窗口上去", () => {
    const tight = [
      { lane: 0, time: 1000, hold: 0 },
      { lane: 0, time: 1060, hold: 0 },
    ];
    expect(looseOffsetFor(tight, 0)).toBe(0);
    const roomy = [
      { lane: 0, time: 1000, hold: 0 },
      { lane: 0, time: 1400, hold: 0 },
    ];
    expect(looseOffsetFor(roomy, 0)).toBe(LOOSE_OFFSET_MS);
  });

  it("真谱面上每一次打偏都落在良好窗口里，一次都不会判到隔壁块", () => {
    for (let round = 1; round <= 8; round++) {
      const chart = matchChart(round);
      for (let i = 0; i < chart.notes.length; i++) {
        const off = looseOffsetFor(chart.notes, i);
        if (off === 0) continue;
        expect(off, `第 ${round} 局第 ${i} 个音符`).toBeGreaterThan(PERFECT_MS);
        expect(off, `第 ${round} 局第 ${i} 个音符`).toBeLessThanOrEqual(GOOD_MS);
      }
    }
  });
});
