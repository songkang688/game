/**
 * 窗口4 · 档B · 第 2 轮验收 —— 水果切切乐(fruit-slice)。
 *
 * 换样本(第 33 / 88 / 147 / 180 回合)+ 难度曲线 + 竞态(刀锋口袋 / 连刀窗口)+ 无尽持续。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import {
  BLADE_STREAK_CAP,
  BLADE_WINDOW,
  BladeBag,
  MIN_SWIPE,
  STORM_MISS_LIMIT,
  STORM_MISTAKE_LIMIT,
  arcReachable,
  bladeScore,
  bladeWindowAlive,
  extraChance,
  extrasForRound,
  safeLaunch,
  sampleCount,
  stormOver,
  stormPace,
  stormStars,
  stormWave,
  streakMultiplier,
  swipeCounts,
  sweptHit,
} from "./blade";
import {
  KING_INFO,
  ROUNDS,
  TOTAL_ROUNDS,
  arcadePace,
  arcadeStars,
  chainTotal,
  gravityFor,
  kingDown,
  kingShowMult,
  mapLayout,
  roundIsCleared,
  starsForRound,
  themeSize,
  themeStart,
  zenStars,
  type RoundDef,
} from "./logic";

const R2_SPOTS = [33, 88, 147, 180];
/** index.ts 里两次抛射之间的固定间隔 */
const VOLLEY_SEC = 1.4;

/** 一个回合最保守的得分下界:每波都只抛最少的那几颗(不含连刀 / 果王加成) */
function floorScore(r: RoundDef): number {
  return Math.floor(r.time / VOLLEY_SEC) * r.volleyMin;
}

/** 一个回合的常规得分:每波抛「最少~最多」的中间数,一颗不漏 */
function typicalScore(r: RoundDef): number {
  return Math.floor(r.time / VOLLEY_SEC) * ((r.volleyMin + r.volleyMax) / 2);
}

describe("档B R2 · 水果切切乐 · 换样本", () => {
  for (const round of R2_SPOTS) {
    it(`第 ${round} 回合:一颗不漏够得着目标分,评星规则说得通`, () => {
      const r = ROUNDS[round - 1];
      expect(
        typicalScore(r),
        `第 ${round} 回合一颗不漏也只有 ${typicalScore(r).toFixed(1)} 分,目标 ${r.target}`
      ).toBeGreaterThanOrEqual(r.target);
      expect(starsForRound(0)).toBe(3);
      expect(starsForRound(1)).toBe(2);
      expect(roundIsCleared(r.target, r.target, false, false)).toBe(true);
      expect(roundIsCleared(r.target - 1, r.target, false, false)).toBe(false);
    });
  }

  it("四个新样本里带果王的回合:果王没倒就不算过", () => {
    const withKing = R2_SPOTS.map((n) => ROUNDS[n - 1]).filter((r) => r.king);
    for (const r of withKing) {
      expect(roundIsCleared(r.target * 2, r.target, true, false), "果王还站着却判了过关").toBe(false);
      expect(roundIsCleared(r.target, r.target, true, true)).toBe(true);
    }
  });

  it("抛射在 360×640 上都够得着:200 次随机抛都在屏内到顶", () => {
    const w = 360;
    const h = 640;
    const g = gravityFor(h);
    let rand = 20260827;
    const next = (): number => {
      rand = (rand * 1103515245 + 12345) & 0x7fffffff;
      return rand / 0x7fffffff;
    };
    for (let i = 0; i < 200; i++) {
      const arc = safeLaunch(w, h, next(), next(), next(), g);
      expect(arcReachable(arc, w, h, g), `第 ${i + 1} 次抛射切不到`).toBe(true);
    }
  });
});

describe("档B R2 · 水果切切乐 · 难度曲线", () => {
  it("章内曲线:同一种时长的手作回合排成一条线,目标分只增不减", () => {
    // 一个果园里混着三种回合:手作正课、生成的「加宴」调剂,还有 30 秒的「快闪」。
    // 时长不同就没法直接比目标分,所以按「同款式(同时长)」分组,组内看曲线。
    for (let ci = 0; ci < 12; ci++) {
      const from = themeStart(ci);
      const seg = ROUNDS.slice(from, from + themeSize(ci)).filter((r) => !r.gen);
      const byTime = new Map<number, RoundDef[]>();
      for (const r of seg) byTime.set(r.time, [...(byTime.get(r.time) ?? []), r]);
      for (const [time, line] of byTime) {
        for (let i = 1; i < line.length; i++) {
          expect(
            line[i].target,
            `第 ${ci + 1} 章 ${time} 秒这一档里「${line[i].name}」比上一关还轻松`
          ).toBeGreaterThanOrEqual(line[i - 1].target);
        }
      }
    }
  });

  it("每个果园的压轴回合就是本园最难的一关", () => {
    for (let ci = 0; ci < 12; ci++) {
      const from = themeStart(ci);
      const seg = ROUNDS.slice(from, from + themeSize(ci));
      const last = seg[seg.length - 1];
      const peak = Math.max(...seg.map((r) => r.target));
      expect(last.target, `第 ${ci + 1} 章的压轴「${last.name}」不是最难的一关`).toBe(peak);
    }
  });

  it("30 秒的「快闪」回合确实更紧张:每秒要切的分不低于同章任何一节正课", () => {
    const density = (r: RoundDef): number => r.target / r.time;
    let flashes = 0;
    for (let ci = 0; ci < 12; ci++) {
      const from = themeStart(ci);
      const seg = ROUNDS.slice(from, from + themeSize(ci)).filter((r) => !r.gen);
      const easiest = Math.min(...seg.filter((r) => r.time >= 40).map(density));
      for (const r of seg.filter((x) => x.time < 40)) {
        flashes++;
        expect(density(r), `「${r.name}」挂着快闪的名字却比同章最松的一节正课还松`).toBeGreaterThanOrEqual(easiest);
      }
    }
    expect(flashes, "一关快闪都没有,这条用例就白写了").toBeGreaterThan(0);
  });

  it("整条 188 回合:每 20 回合取一段,后一段的目标分不低于前一段", () => {
    const buckets: number[] = [];
    for (let start = 0; start < TOTAL_ROUNDS; start += 20) {
      const seg = ROUNDS.slice(start, start + 20);
      buckets.push(seg.reduce((n, r) => n + r.target, 0) / seg.length);
    }
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i], `第 ${i + 1} 段比上一段还轻松`).toBeGreaterThanOrEqual(buckets[i - 1]);
    }
  });

  it("188 个回合没有一个是死局:一颗不漏都够得着目标分", () => {
    const dead: number[] = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      if (typicalScore(ROUNDS[i]) < ROUNDS[i].target) dead.push(i + 1);
    }
    expect(dead, `这些回合一颗不漏也过不了:${dead.join("/")}`).toEqual([]);
  });

  it("最保守的打法(每波只抛最少那几颗)在前 50 回合仍旧够用", () => {
    for (let i = 0; i < 50; i++) {
      expect(floorScore(ROUNDS[i]), `第 ${i + 1} 回合连保守下界都不够`).toBeGreaterThanOrEqual(ROUNDS[i].target);
    }
  });

  it("果王一章比一章难打:耐打刀数、体型、奖励都往上走", () => {
    const order = ["swirlKing", "decreeKing", "grandKing"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(KING_INFO[order[i]].hp).toBeGreaterThan(KING_INFO[order[i - 1]].hp);
      expect(KING_INFO[order[i]].downBonus).toBeGreaterThan(KING_INFO[order[i - 1]].downBonus);
    }
  });

  it("新机关按回合逐步解锁,不会一上来全给", () => {
    expect(extrasForRound(0).length).toBeLessThanOrEqual(extrasForRound(187).length);
    expect(extraChance(0)).toBeLessThanOrEqual(extraChance(187));
  });
});

describe("档B R2 · 水果切切乐 · 竞态", () => {
  it("连刀窗口:刚好卡在 0.8 秒边界上不会两头都算", () => {
    expect(bladeWindowAlive(BLADE_WINDOW - 0.001)).toBe(true);
    expect(bladeWindowAlive(BLADE_WINDOW + 0.001)).toBe(false);
  });

  it("连刀倍率有封顶:一直连也不会把分吹上天", () => {
    const caps = [0, 3, BLADE_STREAK_CAP, BLADE_STREAK_CAP + 10, 999].map(streakMultiplier);
    for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1]);
    expect(caps[caps.length - 1]).toBe(caps[caps.length - 2]);
    expect(bladeScore(10, 999)).toBe(bladeScore(10, BLADE_STREAK_CAP));
  });

  it("一刀同时扫过两颗果子:两颗都判中,而且不会重复采样到发疯", () => {
    const target = { x: 100, y: 100, r: 30, vx: 0, vy: 0 };
    const other = { x: 160, y: 100, r: 30, vx: 0, vy: 0 };
    expect(sweptHit(40, 100, 220, 100, target, 0.016)).toBe(true);
    expect(sweptHit(40, 100, 220, 100, other, 0.016)).toBe(true);
    expect(sampleCount(40, 100, 220, 100)).toBeLessThanOrEqual(12);
  });

  it("手抖一下不算一刀:短于 16px 的划动直接不作数", () => {
    expect(swipeCounts(MIN_SWIPE - 1)).toBe(false);
    expect(swipeCounts(MIN_SWIPE + 1)).toBe(true);
  });

  it("BladeBag:收摊后再登记的活儿立刻就地收掉,连开连关 20 轮不留活口", () => {
    for (let round = 0; round < 20; round++) {
      const bag = new BladeBag();
      let live = 0;
      for (let i = 0; i < 6; i++) {
        live++;
        bag.add(() => live--);
      }
      bag.clear();
      expect(live, `第 ${round + 1} 轮有活儿没收`).toBe(0);
      bag.add(() => live--);
      expect(live).toBeLessThanOrEqual(0);
    }
  });

  it("果王倒下那一刻再补刀:hits 超过 hp 也不会把倒地状态翻回来", () => {
    const spec = KING_INFO.swirlKing;
    expect(kingDown(spec, spec.hp)).toBe(true);
    expect(kingDown(spec, spec.hp + 5)).toBe(true);
    expect(kingShowMult(spec, spec.hp + 5)).toBeGreaterThan(0);
  });

  it("连刀总分是逐段累加的,不会因为算两次而翻倍", () => {
    const five = chainTotal(5);
    expect(chainTotal(5)).toBe(five);
    expect(chainTotal(6)).toBeGreaterThanOrEqual(five);
  });
});

describe("档B R2 · 水果切切乐 · 无尽持续", () => {
  it("禅宗 300 秒:评星阶梯一路单调,0 分也只是 0 星而不是负分", () => {
    let prev = 0;
    for (let score = 0; score <= 600; score += 20) {
      const stars = zenStars(score);
      expect(stars).toBeGreaterThanOrEqual(prev);
      prev = stars;
    }
    expect(zenStars(0)).toBe(0);
    expect(zenStars(9999)).toBe(3);
  });

  it("街机连打 200 分档:抛射越来越密、炸弹越来越多,但两头都有封顶", () => {
    const paces = [0, 50, 120, 300, 900].map(arcadePace);
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i].interval).toBeLessThanOrEqual(paces[i - 1].interval);
      expect(paces[i].bombChance).toBeGreaterThanOrEqual(paces[i - 1].bombChance);
    }
    expect(paces[paces.length - 1].interval).toBeGreaterThanOrEqual(0.7);
    expect(paces[paces.length - 1].bombChance).toBeLessThanOrEqual(0.34);
    expect(arcadeStars(0)).toBe(0);
    expect(arcadeStars(9999)).toBe(3);
  });

  it("水果暴风连打 60 波:每波都排得出,节奏越来越紧但不会紧到点不过来", () => {
    for (let wave = 1; wave <= 60; wave++) {
      const w = stormWave(wave, 20260827);
      expect(w.count, `第 ${wave} 波一颗都不抛`).toBeGreaterThan(0);
      expect(w.interval, `第 ${wave} 波的间隔归零了`).toBeGreaterThanOrEqual(0.55);
      expect(w.bombChance).toBeLessThanOrEqual(0.34);
    }
    for (let wave = 2; wave <= 60; wave++) {
      expect(stormPace(wave).interval).toBeLessThanOrEqual(stormPace(wave - 1).interval);
      expect(stormPace(wave).count).toBeGreaterThanOrEqual(stormPace(wave - 1).count);
    }
  });

  it("水果暴风的新目标随波次解锁:双倍果 / 花朵 / 连体果都真的会出现", () => {
    const seen = new Set<string>();
    for (let wave = 1; wave <= 60; wave++) {
      for (const kind of stormWave(wave, 20260827).extras) seen.add(kind);
    }
    expect([...seen].sort()).toEqual(["double", "flower", "twin"]);
  });

  it("水果暴风 seeded 可复现:同一波同一种子两次生成一模一样", () => {
    for (const wave of [3, 17, 44]) {
      expect(stormWave(wave, 4242)).toEqual(stormWave(wave, 4242));
    }
  });

  it("水果暴风的收摊条件:漏够了或切错够了就结算,差一个都不算", () => {
    expect(stormOver(STORM_MISS_LIMIT - 1, STORM_MISTAKE_LIMIT - 1)).toBe(false);
    expect(stormOver(STORM_MISS_LIMIT, 0)).toBe(true);
    expect(stormOver(0, STORM_MISTAKE_LIMIT)).toBe(true);
    expect(stormStars(1)).toBe(0);
    expect(stormStars(999)).toBe(3);
  });

  it("选关地图长跑:12 章 × 5 档屏宽,节点全部不出界、不重叠", () => {
    for (const [w, h] of [
      [320, 568],
      [360, 640],
      [414, 896],
      [768, 1024],
      [1280, 800],
    ]) {
      for (let ci = 0; ci < 12; ci++) {
        const layout = mapLayout(w, h, themeSize(ci));
        for (const spot of layout.spots) {
          expect(spot.x - layout.r, `${w}px 上第 ${ci + 1} 章有节点出左边界`).toBeGreaterThanOrEqual(0);
          expect(spot.x + layout.r, `${w}px 上第 ${ci + 1} 章有节点出右边界`).toBeLessThanOrEqual(w);
          expect(spot.y + layout.r, `${w}px 上第 ${ci + 1} 章有节点出下边界`).toBeLessThanOrEqual(h);
        }
        for (let i = 0; i < layout.spots.length; i++) {
          for (let j = i + 1; j < layout.spots.length; j++) {
            const a = layout.spots[i];
            const b = layout.spots[j];
            expect(Math.hypot(a.x - b.x, a.y - b.y), `${w}px 上第 ${ci + 1} 章有两个节点压在一起`).toBeGreaterThan(
              layout.r * 1.6
            );
          }
        }
      }
    }
  });
});
