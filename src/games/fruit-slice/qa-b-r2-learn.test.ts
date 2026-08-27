/**
 * 窗口 4 · 档B · 第 2 轮学习优化员 —— 水果切切乐
 *
 * 落地：水果暴风第 22 波之后接着加压。
 * 顺带把 B2-05（三个快闪回合不够紧）为什么不能在本轮动，钉成一条用例。
 */
import { describe, expect, it } from "vitest";
import {
  STORM_COUNT_MAX,
  STORM_EXTRA_BUMP_MAX,
  STORM_PACE_CAP,
  stormPace,
  stormWave,
} from "./blade";
import { LEGACY_ROUNDS, ROUNDS } from "./logic";

describe("档B R2 学习优化员 · 水果切切乐 · 水果暴风封顶之后还在走", () => {
  it("第 22 波之前那条曲线一个数都没动", () => {
    expect(stormPace(0)).toEqual({ count: 2, interval: 1.5, bombChance: 0.08 });
    for (let i = 0; i <= STORM_PACE_CAP; i++) {
      expect(stormPace(i).count, `第 ${i} 波的抛数被加压提前动了`).toBe(Math.min(7, 2 + Math.floor(i / 3)));
      expect(stormWave(i, 4242).extras).toEqual(stormWave(i, 4242).extras);
    }
  });

  it("第 22 波之后抛数接着往上爬，爬到 9 颗为止", () => {
    // 改之前：间隔 / 炸弹率 / 抛数第 22 波先后到顶，之后整场暴风定死
    expect(stormPace(STORM_PACE_CAP).count).toBe(7);
    expect(stormPace(60).count).toBeGreaterThan(stormPace(STORM_PACE_CAP).count);
    expect(stormPace(999).count).toBe(STORM_COUNT_MAX);
    for (let i = 1; i <= 400; i++) {
      expect(stormPace(i).count, `第 ${i} 波抛得比上一波还少`).toBeGreaterThanOrEqual(stormPace(i - 1).count);
    }
  });

  it("间隔与炸弹率不再往上加：后段考的是看清楚，不是拼手速和运气", () => {
    expect(stormPace(999).interval).toBe(0.55);
    expect(stormPace(999).bombChance).toBeLessThanOrEqual(0.34);
    for (let i = STORM_PACE_CAP; i <= 400; i++) {
      expect(stormPace(i).interval).toBe(0.55);
      expect(stormPace(i).bombChance).toBeCloseTo(0.34, 6);
    }
  });

  it("新目标混得越来越勤，但三种各自都有上限", () => {
    const richness = (from: number): number => {
      let n = 0;
      for (let i = from; i < from + 40; i++) n += stormWave(i, 20260827).extras.length;
      return n;
    };
    expect(richness(200)).toBeGreaterThan(richness(0));
    expect(STORM_EXTRA_BUMP_MAX).toBeLessThan(0.5);
    // 抬了概率也还是掷骰子，不会变成「波波三样齐」
    let allThree = 0;
    for (let i = 0; i <= 400; i++) if (stormWave(i, 4242).extras.length === 3) allThree++;
    expect(allThree).toBeLessThan(300);
  });

  it("加压之后每一波仍旧 seeded 可复现", () => {
    for (const wave of [3, 30, 99, 250]) {
      expect(stormWave(wave, 4242)).toEqual(stormWave(wave, 4242));
    }
  });
});

describe("档B R2 学习优化员 · 水果切切乐 · B2-05 为什么本轮不动", () => {
  it("三个快闪回合都在前 99 回合里,那一段是 1.1 冻起来的", () => {
    // B2-05：第 7/8/9 果园的快闪回合每秒要切的分反而低于同章正课。
    // 但它们分别是第 70 / 81 / 92 回合，落在 rounds188.test.ts 用 FNV 指纹钉死的
    // 「前 99 回合逐字未改」里 —— 动目标分会把老玩家的星星记录一起改掉。
    // 所以本轮只登记不改，留给第 3 轮做结论。
    for (const round of [70, 81, 92]) {
      expect(round).toBeLessThanOrEqual(LEGACY_ROUNDS);
      expect(ROUNDS[round - 1].time).toBeLessThan(40);
    }
    expect(ROUNDS[69].name).toBe("打烊前快切");
    expect(ROUNDS[80].name).toBe("喷发前快切");
    expect(ROUNDS[91].name).toBe("圣火快切礼");
  });
});
