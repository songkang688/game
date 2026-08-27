/**
 * 钓鱼小达人 · 无尽「钓到天黑」单测。
 *
 * 时间推移必须真的改变鱼群:同一个深度、同一串随机数,
 * 清晨抽出来的和夜里抽出来的必须是两副样子,而且方向是可预期的
 * ——越晚,传说鱼越多;越早,浅滩的常见鱼越多。
 */
import { describe, expect, it } from "vitest";
import {
  DAY_PHASES,
  PHASE_INFO,
  endlessLine,
  phaseAt,
  phaseBias,
  phaseProgress,
  phaseWeightAt,
  pickFishAtPhase,
  tierOdds,
  untilNightMs,
  weightRank,
} from "./daylight";
import { ENDLESS_MS, FISH, RARITY_TIERS, tierIndexOf } from "./logic";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 抽 n 条,数一数各档占比 */
function sample(depth: number, phase: (typeof DAY_PHASES)[number], n = 3000): number[] {
  const rand = rng(2026);
  const count = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    count[tierIndexOf(pickFishAtPhase(depth, rand, phase).rarity)] += 1;
  }
  return count.map((c) => c / n);
}

describe("一天四段", () => {
  it("晨 → 昼 → 黄昏 → 夜,四段等长,首尾都夹得住", () => {
    expect(DAY_PHASES).toEqual(["dawn", "day", "dusk", "night"]);
    expect(phaseAt(0)).toBe("dawn");
    expect(phaseAt(ENDLESS_MS * 0.2)).toBe("dawn");
    expect(phaseAt(ENDLESS_MS * 0.3)).toBe("day");
    expect(phaseAt(ENDLESS_MS * 0.6)).toBe("dusk");
    expect(phaseAt(ENDLESS_MS * 0.9)).toBe("night");
    expect(phaseAt(ENDLESS_MS)).toBe("night");
    expect(phaseAt(ENDLESS_MS * 99)).toBe("night");
    expect(phaseAt(-500)).toBe("dawn");
    expect(phaseAt(Number.NaN)).toBe("dawn");
  });

  it("每一段都有名字、天色、水色和一句提示", () => {
    for (const key of DAY_PHASES) {
      const info = PHASE_INFO[key];
      expect(info.key).toBe(key);
      expect(info.name.length).toBeGreaterThan(1);
      expect(info.emoji.length).toBeGreaterThan(0);
      expect(info.sky).toMatch(/^#[0-9a-f]{6}$/i);
      expect(info.tint.startsWith("rgba(")).toBe(true);
      expect(info.tip.length).toBeGreaterThan(8);
    }
    // 越晚运气越好(稀有鱼更愿意上浮)
    const lucks = DAY_PHASES.map((k) => PHASE_INFO[k].luck);
    for (let i = 1; i < lucks.length; i++) expect(lucks[i]).toBeGreaterThan(lucks[i - 1]);
  });

  it("段内进度 0..1 来回走,天黑倒计时会走到 0", () => {
    expect(phaseProgress(0)).toBe(0);
    expect(phaseProgress(ENDLESS_MS / 8)).toBeCloseTo(0.5, 6);
    expect(phaseProgress(ENDLESS_MS * 5)).toBeGreaterThanOrEqual(0);
    expect(untilNightMs(0)).toBeCloseTo(ENDLESS_MS * 0.75, 6);
    expect(untilNightMs(ENDLESS_MS * 0.75)).toBe(0);
    expect(untilNightMs(ENDLESS_MS)).toBe(0);
  });
});

describe("时段改变鱼群", () => {
  it("每条鱼在每个时段的偏好都大于 0,不会有鱼被时段判死刑", () => {
    for (const fish of FISH) {
      for (const phase of DAY_PHASES) {
        expect(phaseBias(fish, phase), `${fish.id} @ ${phase}`).toBeGreaterThan(0);
        expect(phaseWeightAt(fish, 25, phase, 0), `${fish.id} @ ${phase}`).toBeGreaterThan(0);
      }
    }
  });

  it("清晨偏爱浅滩的鱼,夜里偏爱海沟的鱼", () => {
    const shallow = FISH.find((f) => f.layer === 0)!;
    const deep = FISH.find((f) => f.layer === 4)!;
    expect(phaseBias(shallow, "dawn")).toBeGreaterThan(phaseBias(shallow, "night"));
    expect(phaseBias(deep, "night")).toBeGreaterThan(phaseBias(deep, "dawn"));
  });

  it("四档概率和恒为 1,夜里传说档明显比清晨高", () => {
    for (const phase of DAY_PHASES) {
      const odds = tierOdds(40, phase);
      expect(odds.length).toBe(RARITY_TIERS.length);
      expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    }
    const dawn = tierOdds(40, "dawn");
    const night = tierOdds(40, "night");
    const last = RARITY_TIERS.length - 1;
    expect(night[last]).toBeGreaterThan(dawn[last]);
    expect(dawn[0]).toBeGreaterThan(night[0]);
  });

  it("真抽三千条:天黑以后传说鱼变多、常见鱼变少", () => {
    const dawn = sample(40, "dawn");
    const night = sample(40, "night");
    const last = RARITY_TIERS.length - 1;
    expect(night[last]).toBeGreaterThan(dawn[last]);
    expect(night[0]).toBeLessThanOrEqual(dawn[0]);
  });

  it("浅水抽出来的还是浅水鱼,时段改不了「钩子在哪一层」这件事", () => {
    const rand = rng(7);
    let shallow = 0;
    for (let i = 0; i < 500; i++) {
      if (pickFishAtPhase(4, rand, "night").layer <= 1) shallow++;
    }
    expect(shallow).toBeGreaterThan(400);
  });

  it("抽签可复现:同一串随机数、同一时段,抽出同一条鱼", () => {
    expect(pickFishAtPhase(20, rng(11), "dusk").id).toBe(pickFishAtPhase(20, rng(11), "dusk").id);
    // 换个时段就未必是同一条了(至少不该是同一串权重)
    expect(tierOdds(20, "dawn")).not.toEqual(tierOdds(20, "night"));
  });

  it("极端随机值也抽得到鱼", () => {
    for (const phase of DAY_PHASES) {
      expect(pickFishAtPhase(30, () => 0, phase)).toBeTruthy();
      expect(pickFishAtPhase(30, () => 1, phase)).toBeTruthy();
      expect(pickFishAtPhase(30, () => -3, phase)).toBeTruthy();
    }
  });
});

describe("按总重量结算", () => {
  it("称号一档比一档高,而且互不重复", () => {
    const ranks = [0, 5, 15, 30, 45, 80].map(weightRank);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(weightRank(0)).toBe("初次下竿");
    expect(weightRank(999)).toBe("满桶而归");
    expect(weightRank(Number.NaN)).toBe("初次下竿");
    expect(weightRank(-9)).toBe("初次下竿");
  });

  it("结算的话只鼓励,一句批评都没有", () => {
    const lines = [endlessLine(0, 0), endlessLine(2, 1), endlessLine(15, 6), endlessLine(50, 12)];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      for (const bad of ["笨", "失败", "太差", "不行"]) expect(line).not.toContain(bad);
    }
    expect(lines[0]).toContain("下一局");
  });
});
