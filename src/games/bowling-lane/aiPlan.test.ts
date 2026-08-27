/**
 * 1.2 本窗验收 · 第 1 轮学习优化员落地之二:三档电脑差的不只是手,还有脑子。
 *
 * 改动之前三档共用同一套打算(满架瞄口袋、补中一律走专家级的 `spareAimX`),
 * 差别只有 `AI_WOBBLE` 一个手抖幅度。这一批用例盯住两件事:
 *  1. 「打算」真的按档位分层了 —— 新手瞄重心、熟练取中点、冠军用专家解;
 *  2. 分层之后**分瓶**这道分水岭真的把三档拉开了,而且教学主线(满架瞄口袋)一个字没动。
 */
import { describe, expect, it } from "vitest";

import {
  AI_LABEL,
  PACE_FLAT,
  PACE_FULL,
  PACE_SPARE,
  PIN_GAP,
  PIN_R,
  PLAN_SKILL,
  POCKET_AIM,
  aiShot,
  centroidAimX,
  pinSpot,
  planPower,
  planSpareX,
  simulateShot,
  spareAimX,
  spareMissBy,
  splitRack,
  type AiLevel,
} from "./logic";
import { PINS, scoreGame, turnState } from "./scoring";

const TIERS: AiLevel[] = [1, 2, 3];
const FULL = (): boolean[] => new Array<boolean>(PINS).fill(true);

/** 几组经典分瓶(1 基瓶号) */
const SPLITS: number[][] = [
  [3, 7],
  [4, 6],
  [2, 7],
  [7, 10],
  [6, 7, 10],
];

/** 离这个落点最近的那一瓶有多远 */
function nearestPinGap(standing: readonly boolean[], x: number): number {
  let best = Infinity;
  for (let i = 0; i < PINS; i++) {
    if (!standing[i]) continue;
    best = Math.min(best, Math.abs(pinSpot(i).x - x));
  }
  return best;
}

// ---------------------------------------------------------------------------
// 一、打算按档位分层
// ---------------------------------------------------------------------------

describe("电脑的打算 · 三档分层", () => {
  it("三档的两条成熟度都是严格单调的,而且首尾正好是 0 与 1", () => {
    expect(PLAN_SKILL[1].spareSense).toBe(0);
    expect(PLAN_SKILL[3].spareSense).toBe(1);
    expect(PLAN_SKILL[2].spareSense).toBeGreaterThan(PLAN_SKILL[1].spareSense);
    expect(PLAN_SKILL[3].spareSense).toBeGreaterThan(PLAN_SKILL[2].spareSense);
    expect(PLAN_SKILL[1].paceSense).toBe(0);
    expect(PLAN_SKILL[3].paceSense).toBe(1);
    expect(PLAN_SKILL[2].paceSense).toBeGreaterThan(PLAN_SKILL[1].paceSense);
    expect(PLAN_SKILL[3].paceSense).toBeGreaterThan(PLAN_SKILL[2].paceSense);
  });

  it("天真的落点就是重心:3-7 分瓶的重心正好落在两瓶中间那片空气上", () => {
    const rack = splitRack([3, 7]);
    const x = centroidAimX(rack);
    // 离最近那一瓶远得连球边都蹭不上 —— 这正是新手会犯的错
    expect(nearestPinGap(rack, x)).toBeGreaterThan(PIN_R * 2);
    // 专家解则一定压在某个瓶身上
    expect(nearestPinGap(rack, spareAimX(rack))).toBeLessThanOrEqual(PIN_GAP / 2 + 1e-9);
  });

  it("一个瓶都不剩也不会算出 NaN,落点退回球道正中", () => {
    const empty = new Array<boolean>(PINS).fill(false);
    expect(Number.isFinite(centroidAimX(empty))).toBe(true);
    for (const skill of TIERS) expect(Number.isFinite(planSpareX(empty, skill))).toBe(true);
  });

  it("新手瞄重心、冠军用专家解、熟练正好在两者中间", () => {
    for (const combo of SPLITS) {
      const rack = splitRack(combo);
      const naive = centroidAimX(rack);
      const expert = spareAimX(rack);
      expect(planSpareX(rack, 1)).toBeCloseTo(naive, 10);
      expect(planSpareX(rack, 3)).toBeCloseTo(expert, 10);
      expect(planSpareX(rack, 2)).toBeCloseTo((naive + expert) / 2, 10);
    }
  });

  it("离「够得着那一瓶」差多远:档位越高差得越少,新手在分瓶上差出小半个瓶距以上", () => {
    let widest = 0;
    for (const combo of SPLITS) {
      const rack = splitRack(combo);
      const miss = TIERS.map((s) => spareMissBy(rack, s));
      expect(miss[0]).toBeGreaterThanOrEqual(miss[1]);
      expect(miss[1]).toBeGreaterThanOrEqual(miss[2]);
      expect(miss[2]).toBeCloseTo(0, 10);
      widest = Math.max(widest, miss[0]);
    }
    expect(widest).toBeGreaterThan(PIN_GAP / 3);
  });

  it("只剩一瓶的时候谁都不会瞄歪——分层只在「有缝可穿」的场面上起作用", () => {
    for (let i = 0; i < PINS; i++) {
      const one = new Array<boolean>(PINS).fill(false);
      one[i] = true;
      for (const skill of TIERS) expect(spareMissBy(one, skill)).toBeCloseTo(0, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// 二、力度按剩瓶数走
// ---------------------------------------------------------------------------

describe("电脑的打算 · 力度", () => {
  it("满架要速度、残局要控制,三档常数本身就是这个次序", () => {
    expect(PACE_FULL).toBeGreaterThan(PACE_FLAT);
    expect(PACE_FLAT).toBeGreaterThan(PACE_SPARE);
  });

  it("冠军按剩瓶数换力度:满架最猛,只剩一瓶最轻", () => {
    const one = new Array<boolean>(PINS).fill(false);
    one[0] = true;
    expect(planPower(FULL(), 3)).toBeCloseTo(PACE_FULL, 10);
    expect(planPower(one, 3)).toBeCloseTo(PACE_SPARE, 10);
    expect(planPower(FULL(), 3)).toBeGreaterThan(planPower(one, 3));
  });

  it("新手永远那一个力度:满架和单瓶用的劲一模一样", () => {
    const one = new Array<boolean>(PINS).fill(false);
    one[6] = true;
    expect(planPower(FULL(), 1)).toBeCloseTo(PACE_FLAT, 10);
    expect(planPower(one, 1)).toBeCloseTo(PACE_FLAT, 10);
  });

  it("熟练档调一半:数值夹在新手与冠军之间", () => {
    const one = new Array<boolean>(PINS).fill(false);
    one[3] = true;
    const lo = planPower(one, 1);
    const mid = planPower(one, 2);
    const hi = planPower(one, 3);
    expect(mid).toBeLessThan(lo);
    expect(mid).toBeGreaterThan(hi);
  });

  it("任何场面下力度都还在合法区间里,空架也不会崩", () => {
    const empty = new Array<boolean>(PINS).fill(false);
    for (const skill of TIERS) {
      for (const rack of [FULL(), empty, splitRack([7, 10])]) {
        const p = planPower(rack, skill);
        expect(p).toBeGreaterThanOrEqual(0.25);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 三、教学主线没被改掉
// ---------------------------------------------------------------------------

describe("电脑的打算 · 满架仍然瞄口袋", () => {
  it("三档满架时投出来的落点都还是围着口袋抖,方向没被改成头瓶", () => {
    for (const skill of TIERS) {
      let sum = 0;
      for (let t = 0; t < 40; t++) sum += aiShot(FULL(), skill, t).aim;
      // 40 球的平均落点仍然贴着口袋(高斯噪声均值 0)
      expect(Math.abs(sum / 40 - POCKET_AIM)).toBeLessThan(0.12);
    }
  });

  it("还是纯函数:同样的场面与回合号投出同样的一球", () => {
    const rack = splitRack([3, 7]);
    for (const skill of TIERS) {
      expect(aiShot(rack, skill, 9)).toEqual(aiShot(rack, skill, 9));
    }
  });

  it("三档还是原来那三个名字,一个都没改", () => {
    expect(TIERS.map((s) => AI_LABEL[s])).toEqual(["新手球童", "熟练球手", "冠军球手"]);
  });
});

// ---------------------------------------------------------------------------
// 四、真的滚一次瓶:分层之后档位差拉开了
// ---------------------------------------------------------------------------

/** 这一档在这一组分瓶上「至少碰到一瓶」的比例(%) */
function splitTouchRate(skill: AiLevel): number {
  let hit = 0;
  let tries = 0;
  for (const combo of SPLITS) {
    for (let turn = 0; turn < 20; turn++) {
      const standing = splitRack(combo);
      const res = simulateShot({ standing }, aiShot(standing, skill, turn));
      tries++;
      if (res.count > 0) hit++;
    }
  }
  return (hit / tries) * 100;
}

/** 照 index.ts 的对局循环打完十格,返回总分 */
function playGame(skill: AiLevel, seed: number): number {
  const rolls: number[] = [];
  let standing = FULL();
  let guard = 0;
  while (guard++ < 80) {
    const st = turnState(rolls, 10);
    if (st.over) break;
    if (st.freshRack) standing = FULL();
    const res = simulateShot(
      { standing: standing.slice(), oil: 0.4 },
      aiShot(standing, skill, seed + st.frame * 3 + st.ball)
    );
    rolls.push(res.count);
    standing = res.standing;
  }
  return scoreGame(rolls, 10).total;
}

describe("电脑的打算 · 真的滚一次瓶", () => {
  it("分瓶是分水岭:新手常常整个穿过去,冠军基本都碰得到", () => {
    const novice = splitTouchRate(1);
    const steady = splitTouchRate(2);
    const champ = splitTouchRate(3);
    expect(champ).toBeGreaterThan(steady);
    expect(steady).toBeGreaterThan(novice);
    // 冠军的专家解几乎不会瞄空
    expect(champ).toBeGreaterThanOrEqual(90);
    // 新手真的会整球穿缝而过 —— 这就是「新手球童」该有的样子
    expect(novice).toBeLessThan(60);
    // 一档到三档拉开一大截
    expect(champ - novice).toBeGreaterThan(35);
  });

  it("十格总分:三档严格单调,冠军比新手高出五成以上", () => {
    const avg = (skill: AiLevel): number => {
      let sum = 0;
      for (let s = 0; s < 20; s++) sum += playGame(skill, s * 7);
      return sum / 20;
    };
    const novice = avg(1);
    const steady = avg(2);
    const champ = avg(3);
    expect(steady).toBeGreaterThan(novice);
    expect(champ).toBeGreaterThan(steady);
    expect(champ).toBeGreaterThan(novice * 1.5);
  });
});
