import { describe, expect, it } from "vitest";
import {
  BIG_BOMB_HEARTS,
  BOOM_RADIUS,
  COMBO_WINDOW,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  HEARTS_PER_ROUND,
  ICE_SECONDS,
  ICE_SLOW,
  ROUNDS,
  SPECIAL_CHANCE,
  ZEN_SECONDS,
  arcadePace,
  arcadeStars,
  comboBonus,
  comboLabel,
  gravityFor,
  isLevelUnlocked,
  makeLaunch,
  parseBest,
  parseProgress,
  segCircleHit,
  serializeBest,
  serializeProgress,
  starsForRound,
  totalStars,
  zenStars,
} from "./logic";

describe("fruit-slice 经典战役", () => {
  it("至少 18 回合,每回合有独特机制标记", () => {
    expect(ROUNDS.length).toBeGreaterThanOrEqual(18);
    const feats = new Set(ROUNDS.map((r) => r.feature));
    expect(feats.size).toBe(ROUNDS.length);
    for (const r of ROUNDS) expect(r.feature.length).toBeGreaterThan(0);
  });

  it("机制逐步引入:第一回合没炸弹,后面才有大炸弹和特殊水果", () => {
    expect(ROUNDS[0].bombChance).toBe(0);
    expect(ROUNDS[0].bigBombChance).toBe(0);
    expect(ROUNDS[0].specials.length).toBe(0);
    expect(ROUNDS.some((r) => r.bombChance > 0)).toBe(true);
    expect(ROUNDS.some((r) => r.bigBombChance > 0)).toBe(true);
    const allSpecials = new Set(ROUNDS.flatMap((r) => r.specials));
    expect(allSpecials.has("banana")).toBe(true);
    expect(allSpecials.has("ice")).toBe(true);
    expect(allSpecials.has("boom")).toBe(true);
  });

  it("目标分整体递增,最终回合最高", () => {
    expect(ROUNDS[ROUNDS.length - 1].target).toBeGreaterThan(ROUNDS[0].target * 3);
    for (const r of ROUNDS) {
      expect(r.target).toBeGreaterThan(0);
      expect(r.time).toBeGreaterThan(0);
      expect(r.volleyMax).toBeGreaterThanOrEqual(r.volleyMin);
    }
  });

  it("单回合星级:不掉心 3 星,掉 1 颗 2 星,通过 1 星", () => {
    expect(HEARTS_PER_ROUND).toBe(3);
    expect(starsForRound(0)).toBe(3);
    expect(starsForRound(1)).toBe(2);
    expect(starsForRound(2)).toBe(1);
  });
});

describe("fruit-slice 特殊水果与炸弹", () => {
  it("冰冻果:有时长和减速倍率", () => {
    expect(ICE_SECONDS).toBeGreaterThan(0);
    expect(ICE_SLOW).toBeGreaterThan(0);
    expect(ICE_SLOW).toBeLessThan(1);
  });

  it("爆裂果有作用半径,大炸弹掉 2 颗心", () => {
    expect(BOOM_RADIUS).toBeGreaterThan(50);
    expect(BIG_BOMB_HEARTS).toBe(2);
  });

  it("彩虹香蕉水果雨有时长和倍率,特殊水果有出现概率", () => {
    expect(FRENZY_SECONDS).toBeGreaterThan(0);
    expect(FRENZY_MULTIPLIER).toBeGreaterThan(1);
    expect(SPECIAL_CHANCE).toBeGreaterThan(0);
    expect(SPECIAL_CHANCE).toBeLessThan(0.5);
  });
});

describe("fruit-slice 切割与抛射", () => {
  it("线段切圆判定", () => {
    expect(segCircleHit(0, 0, 100, 0, 50, 5, 10)).toBe(true);
    expect(segCircleHit(0, 0, 100, 0, 50, 50, 10)).toBe(false);
    expect(segCircleHit(0, 0, 0, 0, 5, 0, 10)).toBe(true);
  });

  it("抛射从屏幕下方往上飞", () => {
    const l = makeLaunch(640, 480, 0.5, 0.5, 0.5);
    expect(l.y).toBeGreaterThan(480);
    expect(l.vy).toBeLessThan(0);
    expect(gravityFor(480)).toBeGreaterThan(0);
  });

  it("连击爆击分递增", () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(2);
    expect(comboBonus(3)).toBe(6);
    expect(comboBonus(4)).toBe(12);
    expect(comboLabel(1)).toBeNull();
    expect(comboLabel(2)).toBeTruthy();
    expect(COMBO_WINDOW).toBeGreaterThan(0);
  });
});

describe("fruit-slice 禅宗与街机", () => {
  it("禅宗:有限时,按分给星", () => {
    expect(ZEN_SECONDS).toBeGreaterThan(0);
    expect(zenStars(0)).toBe(0);
    expect(zenStars(40)).toBe(1);
    expect(zenStars(80)).toBe(2);
    expect(zenStars(130)).toBe(3);
  });

  it("街机:得分越高节奏越快、炸弹越多", () => {
    const slow = arcadePace(0);
    const fast = arcadePace(300);
    expect(fast.interval).toBeLessThan(slow.interval);
    expect(fast.bombChance).toBeGreaterThan(slow.bombChance);
    expect(arcadeStars(10)).toBe(0);
    expect(arcadeStars(40)).toBe(1);
    expect(arcadeStars(90)).toBe(2);
    expect(arcadeStars(150)).toBe(3);
  });
});

describe("fruit-slice 进度与最好成绩", () => {
  it("进度序列化往返一致,坏档当新档", () => {
    const stars = new Array(ROUNDS.length).fill(0);
    stars[0] = 3;
    stars[1] = 1;
    const restored = parseProgress(serializeProgress(stars), ROUNDS.length);
    expect(restored[0]).toBe(3);
    expect(restored[1]).toBe(1);
    expect(restored[2]).toBe(0);
    expect(parseProgress(null, 3)).toEqual([0, 0, 0]);
    expect(parseProgress("bad", 3)).toEqual([0, 0, 0]);
  });

  it("第一回合默认解锁,通关才解锁下一回合", () => {
    const stars = new Array(ROUNDS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 2;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(totalStars(stars)).toBe(2);
  });

  it("最好成绩可以保存和恢复", () => {
    const best = parseBest(serializeBest({ zen: 88, arcade: 120 }));
    expect(best.zen).toBe(88);
    expect(best.arcade).toBe(120);
    expect(parseBest(null)).toEqual({ zen: 0, arcade: 0 });
    expect(parseBest("oops")).toEqual({ zen: 0, arcade: 0 });
  });
});
