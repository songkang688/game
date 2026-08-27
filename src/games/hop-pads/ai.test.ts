/**
 * 跳跳台 · 幽灵对手的回归。
 *
 * 规格第十节要:四档噪声分别是 ±25% / ±12% / ±5% / ±1.5%,
 * 而且固定 seed 下大师幽灵的得分要显著高于新手 —— 写成断言。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { REACH_MAX, REACH_MIN } from "./physics";
import {
  AI_TIERS,
  TIER_NAMES,
  TIER_NOISE,
  ghostLine,
  ghostPower,
  playGhost,
  recordPowers,
  type AiTier,
} from "./ai";
import { matchDifficulty } from "./levels";
import { SPRING_CHAIN_CAP } from "./run";

const DIFF = matchDifficulty(3);

describe("档位设定", () => {
  it("四档的噪声正好是规格写的那几个数,而且一档比一档稳", () => {
    expect(TIER_NOISE.rookie).toBeCloseTo(0.25, 10);
    expect(TIER_NOISE.normal).toBeCloseTo(0.12, 10);
    expect(TIER_NOISE.expert).toBeCloseTo(0.05, 10);
    expect(TIER_NOISE.hell).toBeCloseTo(0.015, 10);
    const seq = AI_TIERS.map((t) => TIER_NOISE[t]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThan(seq[i - 1]);
  });

  it("四档都有中文名", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "expert", "hell"]);
    for (const t of AI_TIERS) expect(TIER_NAMES[t].length).toBeGreaterThan(1);
  });

  it("档名对低龄用户不带刺,而且换字没动档位 id", () => {
    expect(Object.values(TIER_NAMES)).toEqual(["新手", "普通", "高手", "大师"]);
    expect(Object.keys(TIER_NAMES)).toEqual(["rookie", "normal", "expert", "hell"]);
    for (const t of AI_TIERS) {
      expect(TIER_NAMES[t]).not.toContain("菜鸟");
      expect(TIER_NAMES[t]).not.toContain("地狱");
    }
  });

  it("加噪声之后力度还是合法的 0–1,而且档位越高越贴着理想值", () => {
    for (const t of AI_TIERS) {
      const rand = mulberry32(7);
      let worst = 0;
      for (let i = 0; i < 200; i++) {
        const p = ghostPower(0.5, t, rand);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        worst = Math.max(worst, Math.abs(p - 0.5) / 0.5);
      }
      expect(worst).toBeLessThanOrEqual(TIER_NOISE[t] + 1e-9);
    }
  });
});

describe("录制理想力度序列", () => {
  it("录下来的每一跳都在可达区间里", () => {
    const powers = recordPowers(31337, DIFF, 40);
    expect(powers).toHaveLength(40);
    for (const p of powers) {
      expect(p).toBeGreaterThanOrEqual(REACH_MIN - 1e-9);
      expect(p).toBeLessThanOrEqual(REACH_MAX + 1e-9);
    }
  });

  it("同一条台序录两遍完全一样", () => {
    expect(recordPowers(555, DIFF, 20)).toEqual(recordPowers(555, DIFF, 20));
  });
});

/** 一档幽灵在若干条台序上的总分 */
function totalScore(tier: AiTier, seeds: number[]): number {
  return seeds.reduce((s, seed) => s + playGhost(seed, DIFF, tier, 30).score, 0);
}

describe("幽灵重放", () => {
  it("固定 seed 下,大师幽灵的得分显著高过新手", () => {
    const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
    const rookie = totalScore("rookie", seeds);
    const hell = totalScore("hell", seeds);
    expect(hell).toBeGreaterThan(rookie * 3);
  });

  it("四档的总分一档比一档高", () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808];
    const scores = AI_TIERS.map((t) => totalScore(t, seeds));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i], `${TIER_NAMES[AI_TIERS[i]]} 应该强过 ${TIER_NAMES[AI_TIERS[i - 1]]}`).toBeGreaterThan(
        scores[i - 1]
      );
    }
  });

  it("大师档几乎跳跳完美,新手经常掉下去", () => {
    const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
    const hellFalls = seeds.filter((s) => playGhost(s, DIFF, "hell", 30).fell).length;
    const rookieFalls = seeds.filter((s) => playGhost(s, DIFF, "rookie", 30).fell).length;
    expect(hellFalls).toBeLessThan(rookieFalls);
    const hell = playGhost(11, DIFF, "hell", 30);
    expect(hell.perfects / Math.max(1, hell.cleared)).toBeGreaterThan(0.8);
  });

  it("同一个 seed 重放两遍结果一致,对战才比得出高下", () => {
    expect(playGhost(909, DIFF, "expert", 25)).toEqual(playGhost(909, DIFF, "expert", 25));
  });

  it("幽灵掉下去就收手,不给它复活", () => {
    const seeds = [11, 22, 33, 44, 55, 66, 77, 88, 99, 110];
    const runs = seeds.map((s) => playGhost(s, DIFF, "rookie", 60));
    const fallen = runs.filter((g) => g.fell);
    expect(fallen.length).toBeGreaterThan(0);
    for (const g of fallen) {
      // 掉下去那一跳也记在力度序列里,但它没换来一座台
      expect(g.cleared).toBeLessThanOrEqual((g.powers.length - 1) * (1 + SPRING_CHAIN_CAP));
    }
    for (const g of runs) expect(g.powers.length).toBeLessThanOrEqual(60);
  });

  it("赢了输了都好好说话", () => {
    const g = playGhost(11, DIFF, "hell", 20);
    expect(ghostLine("hell", g, g.score + 10)).toContain("你赢了");
    expect(ghostLine("hell", g, g.score)).toContain("平手");
    const lost = ghostLine("hell", g, 0);
    expect(lost).toContain("大师");
    for (const bad of ["笨", "太差", "菜死"]) expect(lost).not.toContain(bad);
  });
});
