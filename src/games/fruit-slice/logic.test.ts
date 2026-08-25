import { describe, expect, it } from "vitest";
import {
  BIG_BOMB_HEARTS,
  BOOM_RADIUS,
  COMBO_WINDOW,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  HANDMADE_PER_THEME,
  HEARTS_PER_ROUND,
  ICE_SECONDS,
  ICE_SLOW,
  LEVELS_PER_THEME,
  ORCHARD_ORDER,
  ORCHARD_STYLE,
  PROGRESS_KEY,
  ROUNDS,
  RoundDef,
  SPECIAL_CHANCE,
  ZEN_SECONDS,
  arcadePace,
  arcadeStars,
  comboBonus,
  comboLabel,
  gravityFor,
  isLevelUnlocked,
  isThemeUnlocked,
  levelIndicesOfTheme,
  makeLaunch,
  parseBest,
  parseProgress,
  segCircleHit,
  serializeBest,
  serializeProgress,
  starsForRound,
  themeCleared,
  themeOfLevel,
  themeStars,
  totalStars,
  zenStars,
} from "./logic";

/** 回合"模板签名":目标/限时/炸弹概率/同屏/抛射节奏/特殊水果的完整组合。 */
function signature(r: RoundDef): string {
  return [
    r.target,
    r.time,
    r.bombChance,
    r.bigBombChance,
    r.maxOnScreen,
    `${r.volleyMin}-${r.volleyMax}`,
    [...r.specials].sort().join(","),
  ].join("|");
}

describe("fruit-slice 99 回合九大果园结构", () => {
  it("经典战役恰好 99 回合 = 9 果园 × 11 回合", () => {
    expect(ROUNDS.length).toBe(99);
    expect(ORCHARD_ORDER.length).toBe(9);
    expect(LEVELS_PER_THEME).toBe(11);
    expect(ORCHARD_ORDER.length * LEVELS_PER_THEME).toBe(99);
  });

  it("每个回合的果园与所在章节一致", () => {
    for (let i = 0; i < ROUNDS.length; i++) {
      expect(ROUNDS[i].orchard).toBe(themeOfLevel(i));
      expect(ROUNDS[i].orchard).toBe(ORCHARD_ORDER[Math.floor(i / LEVELS_PER_THEME)]);
    }
  });

  it("每章 8 回合手写 + 3 回合生成", () => {
    expect(HANDMADE_PER_THEME).toBe(8);
    for (let ci = 0; ci < ORCHARD_ORDER.length; ci++) {
      const rounds = levelIndicesOfTheme(ci).map((i) => ROUNDS[i]);
      expect(rounds.length).toBe(LEVELS_PER_THEME);
      expect(rounds.filter((r) => !r.gen).length).toBe(HANDMADE_PER_THEME);
      expect(rounds.filter((r) => r.gen).length).toBe(LEVELS_PER_THEME - HANDMADE_PER_THEME);
    }
  });

  it("全部 99 回合的模板签名互不重复(手写独特,生成不撞模板)", () => {
    const sigs = new Set(ROUNDS.map(signature));
    expect(sigs.size).toBe(ROUNDS.length);
  });

  it("每个回合有全战役唯一的机制标记和名字", () => {
    const feats = new Set(ROUNDS.map((r) => r.feature));
    expect(feats.size).toBe(ROUNDS.length);
    const names = new Set(ROUNDS.map((r) => r.name));
    expect(names.size).toBe(ROUNDS.length);
    for (const r of ROUNDS) {
      expect(r.feature.length).toBeGreaterThan(0);
      expect(r.hint.length).toBeGreaterThan(0);
    }
  });

  it("回合参数都在合理范围", () => {
    for (const r of ROUNDS) {
      expect(r.target).toBeGreaterThan(0);
      expect(r.time).toBeGreaterThanOrEqual(25);
      expect(r.time).toBeLessThanOrEqual(60);
      expect(r.bombChance).toBeGreaterThanOrEqual(0);
      expect(r.bombChance).toBeLessThan(0.4);
      expect(r.bigBombChance).toBeGreaterThanOrEqual(0);
      expect(r.bigBombChance).toBeLessThan(0.2);
      expect(r.maxOnScreen).toBeGreaterThanOrEqual(6);
      expect(r.volleyMax).toBeGreaterThanOrEqual(r.volleyMin);
      expect(r.volleyMin).toBeGreaterThanOrEqual(1);
    }
  });

  it("难度随章节爬升:每章平均目标分递增,最终回合是全战役最高", () => {
    const avg: number[] = [];
    for (let ci = 0; ci < ORCHARD_ORDER.length; ci++) {
      const rounds = levelIndicesOfTheme(ci).map((i) => ROUNDS[i]);
      avg.push(rounds.reduce((s, r) => s + r.target, 0) / rounds.length);
    }
    for (let ci = 1; ci < avg.length; ci++) expect(avg[ci]).toBeGreaterThan(avg[ci - 1]);
    const maxTarget = Math.max(...ROUNDS.map((r) => r.target));
    expect(ROUNDS[ROUNDS.length - 1].target).toBe(maxTarget);
  });

  it("机制逐步引入:开局零炸弹,前两章无大炸弹,后面章节大炸弹登场", () => {
    expect(ROUNDS[0].bombChance).toBe(0);
    expect(ROUNDS[0].bigBombChance).toBe(0);
    expect(ROUNDS[0].specials.length).toBe(0);
    for (const i of [...levelIndicesOfTheme(0), ...levelIndicesOfTheme(1)]) {
      expect(ROUNDS[i].bigBombChance).toBe(0);
    }
    for (let ci = 2; ci < ORCHARD_ORDER.length; ci++) {
      const rounds = levelIndicesOfTheme(ci).map((i) => ROUNDS[i]);
      expect(rounds.some((r) => r.bigBombChance > 0)).toBe(true);
    }
  });

  it("三种特殊水果都会在战役里出现,且每回合只用本果园的特殊水果", () => {
    const all = new Set(ROUNDS.flatMap((r) => r.specials));
    expect(all.has("banana")).toBe(true);
    expect(all.has("ice")).toBe(true);
    expect(all.has("boom")).toBe(true);
    for (const r of ROUNDS) {
      const palette = new Set(ORCHARD_STYLE[r.orchard].specials);
      for (const sp of r.specials) expect(palette.has(sp)).toBe(true);
    }
  });
});

describe("fruit-slice 九大果园风格", () => {
  it("九个果园的名字、表情和背景色互不相同", () => {
    const names = new Set(ORCHARD_ORDER.map((o) => ORCHARD_STYLE[o].name));
    const emojis = new Set(ORCHARD_ORDER.map((o) => ORCHARD_STYLE[o].emoji));
    const tops = new Set(ORCHARD_ORDER.map((o) => ORCHARD_STYLE[o].bgTop));
    expect(names.size).toBe(9);
    expect(emojis.size).toBe(9);
    expect(tops.size).toBe(9);
    for (const o of ORCHARD_ORDER) expect(ORCHARD_STYLE[o].blurb.length).toBeGreaterThan(0);
  });

  it("物理手感各异:有侧风(左右)、低重力、高重力、小果和大瓜", () => {
    const styles = ORCHARD_ORDER.map((o) => ORCHARD_STYLE[o]);
    expect(styles.some((s) => s.wind > 0)).toBe(true);
    expect(styles.some((s) => s.wind < 0)).toBe(true);
    expect(styles.some((s) => s.gravityMult < 1)).toBe(true);
    expect(styles.some((s) => s.gravityMult > 1)).toBe(true);
    expect(styles.some((s) => s.fruitScale < 1)).toBe(true);
    expect(styles.some((s) => s.fruitScale > 1)).toBe(true);
    for (const s of styles) {
      expect(s.gravityMult).toBeGreaterThan(0.5);
      expect(s.gravityMult).toBeLessThan(1.5);
      expect(s.fruitScale).toBeGreaterThan(0.7);
      expect(s.fruitScale).toBeLessThan(1.4);
      expect(Math.abs(s.wind)).toBeLessThanOrEqual(80);
      expect(s.specials.length).toBeGreaterThan(0);
    }
  });
});

describe("fruit-slice 章节解锁与回放", () => {
  it("第一章默认解锁,通关上一章最后一回合才解锁下一章", () => {
    const stars = new Array(ROUNDS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME - 1; i++) stars[i] = 1;
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    stars[LEVELS_PER_THEME - 1] = 2;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
  });

  it("章节星数与通关数统计正确", () => {
    const stars = new Array(ROUNDS.length).fill(0);
    stars[0] = 3;
    stars[1] = 2;
    stars[LEVELS_PER_THEME] = 1;
    expect(themeStars(stars, 0)).toBe(5);
    expect(themeCleared(stars, 0)).toBe(2);
    expect(themeStars(stars, 1)).toBe(1);
    expect(themeCleared(stars, 1)).toBe(1);
    expect(themeStars(stars, 2)).toBe(0);
  });

  it("回合逐个解锁;存档 key 已升级避免旧档冲突", () => {
    const stars = new Array(ROUNDS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 2;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(PROGRESS_KEY).toContain("v2");
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
    expect(totalStars(restored)).toBe(4);
  });

  it("最好成绩可以保存和恢复", () => {
    const best = parseBest(serializeBest({ zen: 88, arcade: 120 }));
    expect(best.zen).toBe(88);
    expect(best.arcade).toBe(120);
    expect(parseBest(null)).toEqual({ zen: 0, arcade: 0 });
    expect(parseBest("oops")).toEqual({ zen: 0, arcade: 0 });
  });
});
