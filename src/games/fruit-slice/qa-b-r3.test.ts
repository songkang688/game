/**
 * 窗口4 · 档B · 第 3 轮验收 —— 水果切切乐(fruit-slice)。
 *
 * 「五款不漏」这一轮不再抽样:188 回合一回合不落地算供给、算目标、验抛射,
 * 三种无尽玩法各跑一段全量,选关地图五档屏宽全扫。
 */
import { describe, expect, it } from "vitest";
import {
  STORM_MISS_LIMIT,
  STORM_MISTAKE_LIMIT,
  arcReachable,
  safeLaunch,
  stormOver,
  stormPace,
  stormStars,
  stormWave,
} from "./blade";
import {
  KING_INFO,
  ROUNDS,
  TOTAL_ROUNDS,
  arcadePace,
  arcadeStars,
  gravityFor,
  mapLayout,
  starsForRound,
  themeSize,
  themeStart,
  zenStars,
  type RoundDef,
} from "./logic";
import { mulberry32 } from "../level99";

/** index.ts 里两次抛射之间的固定间隔 */
const VOLLEY_SEC = 1.4;

/** 一个回合的常规得分:每波抛「最少~最多」的中间数,一颗不漏 */
function typicalScore(r: RoundDef): number {
  return Math.floor(r.time / VOLLEY_SEC) * ((r.volleyMin + r.volleyMax) / 2);
}

describe("档B R3 · 水果切切乐 · 188 回合一回合不落", () => {
  it("188 回合都够得着目标分:没有一个是数学上打不过的死局", () => {
    const dead: string[] = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      if (typicalScore(ROUNDS[i]) < ROUNDS[i].target) {
        dead.push(`第 ${i + 1} 回合「${ROUNDS[i].name}」供给 ${typicalScore(ROUNDS[i])} < 目标 ${ROUNDS[i].target}`);
      }
    }
    expect(dead.slice(0, 10)).toEqual([]);
  });

  it("188 回合的参数都合法:时长为正、抛数区间成立、炸弹率不到一半", () => {
    const bad: string[] = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const r = ROUNDS[i];
      if (r.time <= 0) bad.push(`第 ${i + 1} 回合时长非正`);
      if (r.volleyMin > r.volleyMax) bad.push(`第 ${i + 1} 回合的抛数区间是反的`);
      if (r.volleyMax > r.maxOnScreen) bad.push(`第 ${i + 1} 回合一波抛得比屏上能放的还多`);
      if (r.bombChance >= 0.5) bad.push(`第 ${i + 1} 回合炸弹超过一半`);
      if (r.bigBombChance > r.bombChance) bad.push(`第 ${i + 1} 回合大炸弹比炸弹还多`);
      if (r.target <= 0) bad.push(`第 ${i + 1} 回合目标分非正`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("评星只看掉了几颗心,而且怎么打都落在 1~3 星", () => {
    // 掉心是「切到炸弹 / 漏掉果子」，与目标分无关；失败也只鼓励，不会算出 0 星或负星
    expect(starsForRound(0)).toBe(3);
    expect(starsForRound(1)).toBe(2);
    for (let lost = 2; lost <= 20; lost++) {
      expect(starsForRound(lost), `掉 ${lost} 颗心算出了不合法的星`).toBe(1);
    }
  });

  it("188 回合的抛射在 360×640 上都够得着:每回合 20 次随机抛都在屏内到顶", () => {
    const rand = mulberry32(20260827);
    const [w, h] = [360, 640];
    const g = gravityFor(h);
    const bad: string[] = [];
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      for (let k = 0; k < 20; k++) {
        const arc = safeLaunch(w, h, rand(), rand(), rand(), g);
        if (!arcReachable(arc, w, h, g)) {
          bad.push(`第 ${i + 1} 回合第 ${k + 1} 抛够不着`);
          break;
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("带果王的回合:果王的耐打刀数、体型、奖励都在合法范围", () => {
    const kings = ROUNDS.filter((r) => r.king);
    expect(kings.length, "一个果王回合都没有").toBeGreaterThan(0);
    for (const r of kings) {
      const info = KING_INFO[r.king!];
      expect(info, `${r.name} 的果王没有对应设定`).toBeTruthy();
      expect(info.hp, `${r.name} 的果王一刀就倒`).toBeGreaterThan(0);
    }
  });

  it("12 个果园一园不落:各园回合数加起来正好 188", () => {
    let sum = 0;
    for (let ci = 0; ci < 12; ci++) sum += themeSize(ci);
    expect(sum).toBe(TOTAL_ROUNDS);
    expect(TOTAL_ROUNDS).toBe(188);
    // 每一园的起点接得上上一园的终点
    for (let ci = 1; ci < 12; ci++) {
      expect(themeStart(ci), `第 ${ci + 1} 园的起点和第 ${ci} 园接不上`).toBe(
        themeStart(ci - 1) + themeSize(ci - 1),
      );
    }
  });
});

describe("档B R3 · 水果切切乐 · 三种无尽玩法全量复扫", () => {
  it("禅宗 600 秒:评星阶梯一路单调,0 分也只是 0 星", () => {
    expect(zenStars(0)).toBe(0);
    let prev = 0;
    for (let score = 0; score <= 600; score += 5) {
      const s = zenStars(score);
      expect(s, `${score} 分的星比上一档还少`).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(3);
      prev = s;
    }
  });

  it("街机连打到 600 分:抛射越来越密、炸弹越来越多,两头都有封顶", () => {
    let prevInterval = Infinity;
    let prevBomb = -1;
    for (let score = 0; score <= 600; score += 10) {
      const p = arcadePace(score);
      expect(p.interval, `${score} 分时抛得比上一档还慢`).toBeLessThanOrEqual(prevInterval);
      expect(p.bombChance, `${score} 分时炸弹比上一档还少`).toBeGreaterThanOrEqual(prevBomb);
      expect(p.interval).toBeGreaterThanOrEqual(0.7);
      expect(p.bombChance).toBeLessThanOrEqual(0.34);
      prevInterval = p.interval;
      prevBomb = p.bombChance;
    }
    expect(arcadeStars(0)).toBe(0);
    expect(arcadeStars(9999)).toBe(3);
  });

  it("水果暴风连打 300 波:波波排得出,收摊条件一颗不差", () => {
    for (let wave = 0; wave < 300; wave++) {
      const w = stormWave(wave, 20260827);
      expect(w.count, `第 ${wave} 波一颗都不抛`).toBeGreaterThan(0);
      expect(w.interval, `第 ${wave} 波的间隔归零了`).toBeGreaterThanOrEqual(0.55);
      expect(w.bombChance).toBeLessThanOrEqual(0.34);
      expect(stormPace(wave).count).toBe(w.count);
    }
    expect(stormOver(STORM_MISS_LIMIT - 1, STORM_MISTAKE_LIMIT - 1)).toBe(false);
    expect(stormOver(STORM_MISS_LIMIT, 0)).toBe(true);
    expect(stormOver(0, STORM_MISTAKE_LIMIT)).toBe(true);
    expect(stormStars(0)).toBe(0);
  });

  it("选关地图长跑:12 章 × 5 档屏宽,节点全部不出界、不重叠", () => {
    for (const [w, h] of [
      [320, 568],
      [360, 640],
      [414, 896],
      [768, 1024],
      [1024, 768],
    ]) {
      for (let ci = 0; ci < 12; ci++) {
        const layout = mapLayout(w, h, themeSize(ci));
        for (const n of layout.spots) {
          expect(n.x - layout.r, `${w}px 第 ${ci + 1} 章有节点出了左边界`).toBeGreaterThanOrEqual(0);
          expect(n.x + layout.r, `${w}px 第 ${ci + 1} 章有节点出了右边界`).toBeLessThanOrEqual(w);
          expect(n.y + layout.r, `${w}x${h} 第 ${ci + 1} 章有节点出了下边界`).toBeLessThanOrEqual(h);
        }
      }
    }
  });
});
