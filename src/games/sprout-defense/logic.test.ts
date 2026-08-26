import { describe, expect, it } from "vitest";
import {
  BUG_INFO,
  BugKind,
  CLASSIC_LEVEL_COUNT,
  CLASSIC_THEME_COUNT,
  DEW_CAP_PER_PRODUCER,
  HANDMADE_PER_THEME,
  LANES,
  LEVELS,
  LEVELS_PER_THEME,
  MAMA_SPLIT_KIND,
  MOON_DEW_EVERY,
  NIGHT_DEW_SLOW,
  PLANT_INFO,
  PLANT_KINDS,
  QUEENX_RAGE_FRAC,
  QUEENX_RAGE_SPEED,
  SCENE_ORDER,
  SCENE_STYLE,
  SPARKLE_DEW_EVERY,
  THEME_SIZES,
  TOTAL_LEVELS,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugNightSpeedMult,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  canPlantOnCell,
  clampDew,
  clearSpeechLine,
  cyclePhase,
  effectiveDewCap,
  isLevelUnlocked,
  isThemeUnlocked,
  levelBugCount,
  levelIndicesOfTheme,
  levelWaveSignature,
  moleRevealed,
  moonActive,
  parseProgress,
  passiveDewInterval,
  passiveDewIntervalAt,
  plantsUnlockedAt,
  projectileCanHit,
  queenxSpeedMult,
  retrySpeechLine,
  serializeProgress,
  shovelRefund,
  starsForLevel,
  themeCleared,
  themeIndexOfLevel,
  themeOffset,
  themeOfLevel,
  themeSize,
  themeStars,
  totalStars,
} from "./logic";
import { simulateLevel } from "./sim";

/** FNV-1a 哈希:前 99 关回归指纹用。 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

describe("sprout-defense 99 关九大花园战役", () => {
  it("经典战役正好 99 关,9 章 × 11 关(1.1 只在末尾追加)", () => {
    expect(CLASSIC_LEVEL_COUNT).toBe(99);
    expect(CLASSIC_THEME_COUNT * LEVELS_PER_THEME).toBe(99);
    expect(LEVELS.length).toBeGreaterThanOrEqual(99);
    for (let i = 0; i < CLASSIC_LEVEL_COUNT; i++) {
      expect(SCENE_ORDER.indexOf(LEVELS[i].scene)).toBeLessThan(CLASSIC_THEME_COUNT);
    }
  });

  it("关卡按章节分组,场景一致", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(idxs.length).toBe(themeSize(ci));
      for (const i of idxs) {
        expect(LEVELS[i].scene).toBe(SCENE_ORDER[ci]);
        expect(themeOfLevel(i)).toBe(SCENE_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写布局;经典章生成关不超过 3 关", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const defs = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = defs.filter((d) => !d.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      if (ci < CLASSIC_THEME_COUNT) {
        expect(defs.length - hand.length).toBeLessThanOrEqual(3);
      }
      const layouts = new Set(hand.map((d) => levelWaveSignature(d)));
      expect(layouts.size).toBe(hand.length);
    }
  });

  it("生成关的波次模板互不重复(全局查重)", () => {
    const genDefs = LEVELS.filter((d) => d.gen);
    expect(genDefs.length).toBe(LEVELS.length - SCENE_ORDER.length * HANDMADE_PER_THEME);
    const sigs = new Set(genDefs.map((d) => levelWaveSignature(d)));
    expect(sigs.size).toBe(genDefs.length);
  });

  it("每关都有独特机制标记(feature),互不相同", () => {
    const features = LEVELS.map((l) => l.feature);
    expect(features.every((f) => f.length > 0)).toBe(true);
    expect(new Set(features).size).toBe(LEVELS.length);
  });

  it("十三大场景配色/修正互不相同,虫虫主力阵容互不相同", () => {
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

  it("每章末关都有 BOSS,第九章 BOSS 是虫虫女王,1.1 终章是进化体", () => {
    for (let ci = 0; ci < SCENE_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      const last = LEVELS[idxs[idxs.length - 1]];
      expect(last.waves.some((w) => w.some((e) => BUG_INFO[e.kind].boss))).toBe(true);
    }
    const classicFinale = LEVELS[CLASSIC_LEVEL_COUNT - 1];
    expect(classicFinale.waves.some((w) => w.some((e) => e.kind === "queen"))).toBe(true);
    const finale = LEVELS[LEVELS.length - 1];
    expect(finale.waves.some((w) => w.some((e) => e.kind === "queenx"))).toBe(true);
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

/* ============ 1.1:188 关十三章 + 新植物/新虫/昼夜/地下虫/露珠上限/进化体 ============ */

describe("sprout-defense 1.1 · 188 关十三大花园", () => {
  it("章节和 === 188:13 章长度相加正好 188 关", () => {
    expect(TOTAL_LEVELS).toBe(188);
    expect(LEVELS.length).toBe(188);
    expect(SCENE_ORDER.length).toBe(13);
    expect(THEME_SIZES.length).toBe(13);
    expect(THEME_SIZES.reduce((s, n) => s + n, 0)).toBe(188);
  });

  it("前 99 关一字不动:关卡数据回归指纹保持不变", () => {
    expect(fnv1a(JSON.stringify(LEVELS.slice(0, CLASSIC_LEVEL_COUNT)))).toBe("30106773");
  });

  it("前 99 关不带 1.1 新机制:无昼夜、无露珠上限、不出新虫新植物", () => {
    const newBugs = new Set<BugKind>(["mole", "moth", "mama", "queenx"]);
    for (let i = 0; i < CLASSIC_LEVEL_COUNT; i++) {
      const def = LEVELS[i];
      expect(def.cycle).toBeUndefined();
      expect(def.dewCap).toBeUndefined();
      expect(def.unlockPlant === "scout" || def.unlockPlant === "moon").toBe(false);
      for (const wave of def.waves) {
        for (const e of wave) expect(newBugs.has(e.kind)).toBe(false);
      }
    }
  });

  it("新 4 章:月光花田/地底根须园/糖霜花圃/虫巢王庭,22/22/22/23 关", () => {
    expect(SCENE_ORDER.slice(9)).toEqual(["moonfield", "burrow", "candy", "hive"]);
    expect(THEME_SIZES.slice(9)).toEqual([22, 22, 22, 23]);
    expect(SCENE_STYLE.moonfield.name).toBe("月光花田");
    expect(SCENE_STYLE.burrow.name).toBe("地底根须园");
    expect(SCENE_STYLE.candy.name).toBe("糖霜花圃");
    expect(SCENE_STYLE.hive.name).toBe("虫巢王庭");
  });

  it("变长章节索引:偏移/长度/关卡→章节互相吻合", () => {
    expect(themeOffset(0)).toBe(0);
    expect(themeOffset(9)).toBe(99);
    expect(themeOffset(12)).toBe(165);
    expect(themeSize(0)).toBe(11);
    expect(themeSize(12)).toBe(23);
    expect(themeIndexOfLevel(0)).toBe(0);
    expect(themeIndexOfLevel(98)).toBe(8);
    expect(themeIndexOfLevel(99)).toBe(9);
    expect(themeIndexOfLevel(120)).toBe(9);
    expect(themeIndexOfLevel(121)).toBe(10);
    expect(themeIndexOfLevel(187)).toBe(12);
  });

  it("新植物:第 100 关解锁月月菇,地底章开章解锁望望草", () => {
    expect(PLANT_KINDS).toContain("scout");
    expect(PLANT_KINDS).toContain("moon");
    expect(LEVELS[99].unlockPlant).toBe("moon");
    expect(LEVELS[121].unlockPlant).toBe("scout");
    const before = plantsUnlockedAt(98, LEVELS);
    expect(before).not.toContain("scout");
    expect(before).not.toContain("moon");
    const all = plantsUnlockedAt(LEVELS.length - 1, LEVELS);
    for (const k of PLANT_KINDS) expect(all).toContain(k);
  });

  it("地地虫只在望望草解锁后登场(不会出现打不到的死局)", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const hasMole = LEVELS[i].waves.some((w) => w.some((e) => BUG_INFO[e.kind].underground));
      if (hasMole) expect(i).toBeGreaterThanOrEqual(121);
    }
  });

  it("昼夜循环:开局白天,到点变黑夜,循环往复", () => {
    expect(cyclePhase(3, undefined)).toBe("day");
    const cycle = { day: 10, night: 5 };
    expect(cyclePhase(0, cycle)).toBe("day");
    expect(cyclePhase(9.9, cycle)).toBe("day");
    expect(cyclePhase(10.1, cycle)).toBe("night");
    expect(cyclePhase(14.9, cycle)).toBe("night");
    expect(cyclePhase(15.1, cycle)).toBe("day");
    expect(cyclePhase(25.1, cycle)).toBe("night");
  });

  it("昼夜循环关只在新章出现且数量充足,昼/夜时长都为正", () => {
    const cyc = LEVELS.map((d, i) => (d.cycle ? i : -1)).filter((i) => i >= 0);
    expect(cyc.length).toBeGreaterThanOrEqual(20);
    for (const i of cyc) {
      expect(i).toBeGreaterThanOrEqual(CLASSIC_LEVEL_COUNT);
      expect(LEVELS[i].cycle!.day).toBeGreaterThan(0);
      expect(LEVELS[i].cycle!.night).toBeGreaterThan(0);
    }
  });

  it("黑夜露珠攒得慢,月月菇只在月光时段产露且比闪光芽勤快", () => {
    expect(NIGHT_DEW_SLOW).toBeGreaterThan(1);
    expect(passiveDewIntervalAt("moonfield", true)).toBeCloseTo(
      passiveDewIntervalAt("moonfield", false) * NIGHT_DEW_SLOW,
    );
    expect(MOON_DEW_EVERY).toBeLessThan(SPARKLE_DEW_EVERY);
    expect(moonActive(true, true, false)).toBe(true); // 循环关黑夜:工作
    expect(moonActive(true, false, true)).toBe(false); // 循环关白天:睡觉
    expect(moonActive(false, false, true)).toBe(true); // 无循环的暗场景:整关工作
    expect(moonActive(false, false, false)).toBe(false); // 无循环的亮场景:不工作
  });

  it("扑扑蛾会飞、夜里加速;其他虫不受黑夜影响", () => {
    expect(BUG_INFO.moth.flying).toBe(true);
    expect(BUG_INFO.moth.nightMult).toBeGreaterThan(1);
    expect(bugNightSpeedMult("moth", true)).toBe(BUG_INFO.moth.nightMult);
    expect(bugNightSpeedMult("moth", false)).toBe(1);
    expect(bugNightSpeedMult("walker", true)).toBe(1);
    expect(bugNightSpeedMult("queenx", true)).toBe(1);
  });

  it("地地虫现形规则:有望望草才现形,普通虫不受影响", () => {
    expect(BUG_INFO.mole.underground).toBe(true);
    expect(moleRevealed("mole", false)).toBe(false);
    expect(moleRevealed("mole", true)).toBe(true);
    expect(moleRevealed("walker", false)).toBe(true);
    expect(moleRevealed("moth", false)).toBe(true);
  });

  it("露珠罐上限:产露植物每棵加大罐口,溢出的露珠拿不到", () => {
    expect(effectiveDewCap(undefined, 3)).toBe(Infinity);
    expect(effectiveDewCap(10, 0)).toBe(10);
    expect(effectiveDewCap(10, 2)).toBe(10 + 2 * DEW_CAP_PER_PRODUCER);
    expect(clampDew(15, 12)).toBe(12);
    expect(clampDew(9, 12)).toBe(9);
    expect(clampDew(5, Infinity)).toBe(5);
  });

  it("露珠上限关只在新章出现且数量充足", () => {
    const caps = LEVELS.map((d, i) => (d.dewCap !== undefined ? i : -1)).filter((i) => i >= 0);
    expect(caps.length).toBeGreaterThanOrEqual(20);
    for (const i of caps) {
      expect(i).toBeGreaterThanOrEqual(CLASSIC_LEVEL_COUNT);
      expect(LEVELS[i].dewCap!).toBeGreaterThanOrEqual(8);
    }
  });

  it("分分虫:带甲、被打倒会蹦出两只爬爬虫宝宝", () => {
    expect(BUG_INFO.mama.splits).toBe(2);
    expect(BUG_INFO.mama.armor).toBeGreaterThan(0);
    expect(MAMA_SPLIT_KIND).toBe("walker");
    expect(BUG_INFO[MAMA_SPLIT_KIND].splits ?? 0).toBe(0); // 宝宝不会再分裂
  });

  it("女王进化体:比女王更凶,半血狂暴提速", () => {
    expect(BUG_INFO.queenx.boss).toBe(true);
    expect(BUG_INFO.queenx.hp).toBeGreaterThan(BUG_INFO.queen.hp);
    expect(BUG_INFO.queenx.armor).toBeGreaterThan(BUG_INFO.queen.armor);
    expect(queenxSpeedMult("queenx", 1)).toBe(1);
    expect(queenxSpeedMult("queenx", QUEENX_RAGE_FRAC)).toBe(QUEENX_RAGE_SPEED);
    expect(queenxSpeedMult("queenx", 0.2)).toBe(QUEENX_RAGE_SPEED);
    expect(queenxSpeedMult("queen", 0.2)).toBe(1);
  });

  it("三种新虫都大量登场,进化体只在终章压轴", () => {
    const count = (k: BugKind) =>
      LEVELS.filter((d) => d.waves.some((w) => w.some((e) => e.kind === k))).length;
    expect(count("moth")).toBeGreaterThanOrEqual(20);
    expect(count("mole")).toBeGreaterThanOrEqual(20);
    expect(count("mama")).toBeGreaterThanOrEqual(20);
    expect(count("queenx")).toBe(1);
    expect(LEVELS[187].waves.some((w) => w.some((e) => e.kind === "queenx"))).toBe(true);
  });

  it("新章章末都是 BOSS 关,feature 带 BOSS 标记", () => {
    for (const i of [120, 142, 164, 187]) {
      expect(LEVELS[i].waves.some((w) => w.some((e) => BUG_INFO[e.kind].boss))).toBe(true);
      expect(LEVELS[i].feature).toContain("BOSS");
    }
  });

  it("100+ 关血量曲线回落缓坡:新机制扛难度,不堆血条", () => {
    // 前 99 关公式一字不动
    expect(bugHp("walker", 50)).toBe(BUG_INFO.walker.hp + Math.floor(50 / 8));
    expect(bugHp("walker", 98)).toBe(BUG_INFO.walker.hp + 12);
    // 新章开头回落到温和档,然后缓慢爬坡、只增不减
    expect(bugHp("walker", 99)).toBeLessThan(bugHp("walker", 98));
    expect(bugHp("walker", 99)).toBeGreaterThan(bugHp("walker", 0));
    for (let i = 100; i < 188; i++) {
      expect(bugHp("walker", i)).toBeGreaterThanOrEqual(bugHp("walker", i - 1));
    }
    expect(bugHp("walker", 187)).toBeLessThanOrEqual(bugHp("walker", 98));
  });

  it("章节解锁沿用变长偏移:打通上一章末关才开新章", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 9)).toBe(false);
    for (let i = 0; i < 99; i++) stars[i] = 1;
    expect(isThemeUnlocked(stars, 9)).toBe(true);
    expect(isThemeUnlocked(stars, 10)).toBe(false);
    for (let i = 99; i <= 120; i++) stars[i] = 1;
    expect(isThemeUnlocked(stars, 10)).toBe(true);
    expect(isThemeUnlocked(stars, 11)).toBe(false);
  });

  it("新章也有旗帜大波和水路关", () => {
    const news = LEVELS.slice(99);
    expect(news.filter((d) => d.flagWaves.length > 0).length).toBeGreaterThanOrEqual(30);
    expect(news.filter((d) => d.waterLanes.length > 0).length).toBeGreaterThanOrEqual(4);
  });

  it("全部关卡文案不夹带商标或官方角色名", () => {
    const banned = ["植物大战", "僵尸", "保卫萝卜", "王国保卫", "Kingdom", "PvZ", "Zombie"];
    for (const def of LEVELS) {
      for (const word of banned) {
        expect(def.name.includes(word)).toBe(false);
        expect(def.hint.includes(word)).toBe(false);
      }
    }
  });
});

describe("sprout-defense 1.1 · 固定策略模拟可通关", () => {
  it("第 100–188 关资源曲线不是死局:固定策略全部能赢", () => {
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateLevel(i);
      expect(r.win, `第 ${i + 1} 关 ${LEVELS[i].name} 应能用固定策略通关`).toBe(true);
    }
  }, 180000);

  it("经典关抽查:第 1/34/67/97 关(阳光/迷雾/冰霜/雷雨)固定策略也能赢(回归)", () => {
    for (const i of [0, 33, 66, 96]) {
      expect(simulateLevel(i).win, `第 ${i + 1} 关`).toBe(true);
    }
  }, 60000);

  it("四个新章 BOSS 关能赢也能输:不种植物必输,正常打必赢", () => {
    for (const i of [120, 142, 164, 187]) {
      const win = simulateLevel(i);
      expect(win.win, `BOSS 关 ${i + 1} 正常打`).toBe(true);
      const lose = simulateLevel(i, { build: false });
      expect(lose.win, `BOSS 关 ${i + 1} 摆烂`).toBe(false);
      expect(lose.breachKind).not.toBeNull();
      expect(lose.breachLane).toBeGreaterThanOrEqual(0);
    }
  }, 90000);

  it("模拟器结果字段完整:摆烂局不种不花不杀", () => {
    const r = simulateLevel(187, { build: false });
    expect(r.plantsBuilt).toBe(0);
    expect(r.dewSpent).toBe(0);
    expect(r.bugsKilled).toBe(0);
    expect(r.time).toBeGreaterThan(0);
  });
});
