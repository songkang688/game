import { describe, expect, it } from "vitest";
import {
  BUG_INFO,
  BugKind,
  HANDMADE_PER_THEME,
  LANES,
  LEVELS,
  LEVELS_PER_THEME,
  PLANT_INFO,
  PLANT_KINDS,
  SCENE_ORDER,
  SCENE_STYLE,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  canPlantOnCell,
  clearSpeechLine,
  isLevelUnlocked,
  isThemeUnlocked,
  levelBugCount,
  levelIndicesOfTheme,
  levelWaveSignature,
  parseProgress,
  passiveDewInterval,
  plantsUnlockedAt,
  projectileCanHit,
  retrySpeechLine,
  serializeProgress,
  shovelRefund,
  starsForLevel,
  themeCleared,
  themeOfLevel,
  themeStars,
  totalStars,
} from "./logic";

describe("sprout-defense 99 关九大花园战役", () => {
  it("正好 99 关,9 章 × 11 关", () => {
    expect(LEVELS.length).toBe(99);
    expect(SCENE_ORDER.length).toBeGreaterThanOrEqual(6);
    expect(SCENE_ORDER.length * LEVELS_PER_THEME).toBe(99);
  });

  it("关卡按章节分组,场景一致", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(idxs.length).toBe(LEVELS_PER_THEME);
      for (const i of idxs) {
        expect(LEVELS[i].scene).toBe(SCENE_ORDER[ci]);
        expect(themeOfLevel(i)).toBe(SCENE_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写布局,生成关不超过 3 关", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const defs = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = defs.filter((d) => !d.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      expect(defs.length - hand.length).toBeLessThanOrEqual(3);
      const layouts = new Set(hand.map((d) => levelWaveSignature(d)));
      expect(layouts.size).toBe(hand.length);
    }
  });

  it("生成关的波次模板互不重复(全局查重)", () => {
    const genDefs = LEVELS.filter((d) => d.gen);
    expect(genDefs.length).toBe(SCENE_ORDER.length * 3);
    const sigs = new Set(genDefs.map((d) => levelWaveSignature(d)));
    expect(sigs.size).toBe(genDefs.length);
  });

  it("每关都有独特机制标记(feature),互不相同", () => {
    const features = LEVELS.map((l) => l.feature);
    expect(features.every((f) => f.length > 0)).toBe(true);
    expect(new Set(features).size).toBe(LEVELS.length);
  });

  it("九大场景配色/修正互不相同,虫虫主力阵容互不相同", () => {
    const styles = new Set(SCENE_ORDER.map((s) => SCENE_STYLE[s].laneA + SCENE_STYLE[s].accent));
    expect(styles.size).toBe(SCENE_ORDER.length);
    const combos = new Set(
      SCENE_ORDER.map((s) => [...SCENE_STYLE[s].palette].sort().join(",")),
    );
    expect(combos.size).toBe(SCENE_ORDER.length);
  });

  it("战役至少 9 种虫,至少 7 种植物", () => {
    const kinds = new Set<BugKind>();
    for (const def of LEVELS) {
      for (const wave of def.waves) for (const e of wave) kinds.add(e.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(9);
    expect(PLANT_KINDS.length).toBeGreaterThanOrEqual(7);
  });

  it("有夜场景、水路关和旗帜大波", () => {
    expect(SCENE_ORDER.some((s) => SCENE_STYLE[s].dark)).toBe(true);
    const waterLevels = LEVELS.filter((l) => l.waterLanes.length > 0);
    expect(waterLevels.length).toBeGreaterThanOrEqual(10);
    expect(LEVELS.some((l) => l.flagWaves.length > 0)).toBe(true);
    expect(LEVELS.some((l) => l.flagWaves.length >= 2)).toBe(true);
  });

  it("每章末关都有 BOSS,终章 BOSS 是虫虫女王", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      const last = LEVELS[idxs[idxs.length - 1]];
      expect(last.waves.some((w) => w.some((e) => BUG_INFO[e.kind].boss))).toBe(true);
    }
    const finale = LEVELS[LEVELS.length - 1];
    expect(finale.waves.some((w) => w.some((e) => e.kind === "queen"))).toBe(true);
  });

  it("每关虫子够多,时间表确定且递增", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(levelBugCount(LEVELS[i])).toBeGreaterThanOrEqual(6);
      const sched = buildLevelSchedule(i);
      expect(sched.length).toBe(levelBugCount(LEVELS[i]));
      for (let k = 1; k < sched.length; k++) {
        expect(sched[k].time).toBeGreaterThanOrEqual(sched[k - 1].time);
      }
      for (const s of sched) {
        expect(s.lane).toBeGreaterThanOrEqual(0);
        expect(s.lane).toBeLessThan(LANES);
      }
    }
  });

  it("植物按关卡逐步解锁", () => {
    const first = plantsUnlockedAt(0, LEVELS);
    expect(first).toEqual(["sparkle", "bubble", "nut"]);
    const all = plantsUnlockedAt(LEVELS.length - 1, LEVELS);
    expect(all).toContain("star");
    expect(all).toContain("ice");
    expect(all).toContain("boom");
    expect(all).toContain("lily");
  });
});

describe("sprout-defense 机制", () => {
  it("水格要先铺荷叶才能种植物", () => {
    expect(canPlantOnCell("bubble", true, false, false)).toBe(false);
    expect(canPlantOnCell("lily", true, false, false)).toBe(true);
    expect(canPlantOnCell("lily", true, true, false)).toBe(false);
    expect(canPlantOnCell("bubble", true, true, false)).toBe(true);
    expect(canPlantOnCell("bubble", false, false, false)).toBe(true);
    expect(canPlantOnCell("bubble", false, false, true)).toBe(false);
    expect(canPlantOnCell("lily", false, false, false)).toBe(false);
  });

  it("夜晚/洞穴露珠攒得比白天慢,沙滩更快", () => {
    expect(passiveDewInterval("night")).toBeGreaterThan(passiveDewInterval("day"));
    expect(passiveDewInterval("cave")).toBeGreaterThan(passiveDewInterval("day"));
    expect(passiveDewInterval("beach")).toBeLessThan(passiveDewInterval("day"));
    expect(passiveDewInterval("pool")).toBe(passiveDewInterval("day"));
  });

  it("场景速度修正:秋天/雷雨更快,冬天更慢", () => {
    expect(SCENE_STYLE.autumn.speedMult).toBeGreaterThan(1);
    expect(SCENE_STYLE.storm.speedMult).toBeGreaterThan(1);
    expect(SCENE_STYLE.winter.speedMult).toBeLessThan(1);
    expect(SCENE_STYLE.day.speedMult).toBe(1);
  });

  it("泡泡打不到飞虫,星星和冰冰都可以", () => {
    expect(projectileCanHit("bubble", true)).toBe(false);
    expect(projectileCanHit("bubble", false)).toBe(true);
    expect(projectileCanHit("star", true)).toBe(true);
    expect(projectileCanHit("ice", true)).toBe(true);
  });

  it("护甲先掉再掉血,敲碎护甲有标记", () => {
    const bug = { hp: 3, armor: 2 };
    const r1 = applyDamage(bug, 1);
    expect(r1).toEqual({ hp: 3, armor: 1, brokeArmor: false });
    const r2 = applyDamage(r1, 2);
    expect(r2.hp).toBe(2);
    expect(r2.armor).toBe(0);
    expect(r2.brokeArmor).toBe(true);
  });

  it("桶桶虫比壳壳虫更硬,女王比大虫王更凶,风风虫最快", () => {
    expect(BUG_INFO.bucket.armor).toBeGreaterThan(BUG_INFO.armor.armor);
    expect(BUG_INFO.bossbug.boss).toBe(true);
    expect(BUG_INFO.queen.boss).toBe(true);
    expect(BUG_INFO.queen.hp).toBeGreaterThan(BUG_INFO.bossbug.hp);
    expect(BUG_INFO.digger.jumps).toBe(true);
    const fastest = Math.max(...Object.values(BUG_INFO).map((b) => b.speed));
    expect(BUG_INFO.racer.speed).toBe(fastest);
    expect(bugHp("walker", 90)).toBeGreaterThan(bugHp("walker", 0));
  });

  it("命中与啃食判定", () => {
    expect(bubbleHitsBug(3.0, 3.2)).toBe(true);
    expect(bubbleHitsBug(3.0, 3.5)).toBe(false);
    expect(bugReachesPlant(2.5, 2)).toBe(true);
    expect(bugReachesPlant(3.5, 2)).toBe(false);
  });

  it("买得起才行,铲子退半价", () => {
    expect(canAfford(2, "bubble")).toBe(true);
    expect(canAfford(1, "bubble")).toBe(false);
    expect(shovelRefund("star")).toBe(2);
    expect(shovelRefund("sparkle")).toBe(1);
    expect(PLANT_INFO.boom.cost).toBeGreaterThan(PLANT_INFO.bubble.cost);
  });
});

describe("sprout-defense 3 星与进度", () => {
  it("三星条件:损失 ≤1 棵 3 星,≤4 棵 2 星,守住 1 星", () => {
    expect(starsForLevel(0)).toBe(3);
    expect(starsForLevel(1)).toBe(3);
    expect(starsForLevel(2)).toBe(2);
    expect(starsForLevel(4)).toBe(2);
    expect(starsForLevel(5)).toBe(1);
  });

  it("进度存档回环与解锁规则", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 2;
    const parsed = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(parsed[0]).toBe(2);
    expect(parseProgress("oops", LEVELS.length)).toEqual(new Array(LEVELS.length).fill(0));
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(isLevelUnlocked(stars, 2)).toBe(false);
    expect(totalStars([1, 2, 3])).toBe(6);
  });

  it("章节解锁与章内统计", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME; i++) stars[i] = 3;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
    expect(themeStars(stars, 0)).toBe(LEVELS_PER_THEME * 3);
    expect(themeCleared(stars, 0)).toBe(LEVELS_PER_THEME);
  });
});

describe("结算面板朗读文案", () => {
  it("几乎无伤夸完美防守,其余报星数", () => {
    expect(clearSpeechLine("小小菜园", 3, 0)).toBe("小小菜园守住啦!得到 3 颗星,植物几乎无伤,完美防守!");
    expect(clearSpeechLine("小小菜园", 2, 3)).toBe("小小菜园守住啦!得到 2 颗星,真棒!");
  });

  it("失败朗读温柔安抚,BOSS 关带悄悄提示", () => {
    expect(retrySpeechLine(null)).toBe("虫虫溜进小屋啦。没关系,就在这一关重新布阵!");
    expect(retrySpeechLine("冰冰花冻住女王,星星芽集火!")).toBe(
      "虫虫溜进小屋啦。没关系,就在这一关重新布阵!悄悄告诉你:冰冰花冻住女王,星星芽集火!"
    );
  });
});
