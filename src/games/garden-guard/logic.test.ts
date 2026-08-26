import { describe, expect, it } from "vitest";
import {
  BARRICADE_SMASH_REWARD,
  CLASSIC_LEVEL_COUNT,
  CLASSIC_THEME_COUNT,
  FROST_DURATION,
  GRID_COLS,
  GRID_ROWS,
  HANDMADE_PER_THEME,
  LEVELS,
  LEVELS_PER_THEME,
  MAX_TOWER_LEVEL,
  MONSTER_INFO,
  MonsterKind,
  THEME_ORDER,
  THEME_SIZES,
  THEME_STYLE,
  TOTAL_LEVELS,
  TOWER_INFO,
  TOWER_KINDS,
  WEATHER_INFO,
  applyHit,
  barricadeMap,
  effectiveRange,
  frostSlowFactor,
  mistPoisonDamage,
  themeIndexOfLevel,
  themeOffset,
  themeSize,
  towerCanHitAir,
  weatherRangeMult,
  weatherSpeedMult,
  buildWaypoints,
  canPlace,
  clearSpeechLine,
  combineSlow,
  comboPetalBonus,
  dewSlowFactor,
  isLevelUnlocked,
  isThemeUnlocked,
  levelIndicesOfTheme,
  levelMonsterCount,
  levelWaveSignature,
  monsterArmor,
  monsterHp,
  monsterReward,
  parseProgress,
  pathCellSet,
  pathLength,
  pathsCellSet,
  pickTarget,
  pointAlongPath,
  retrySpeechLine,
  sellRefund,
  serializeProgress,
  starsForLevel,
  sunnyInterval,
  boomSplash,
  themeCleared,
  themeOfLevel,
  themeStars,
  totalStars,
  towerCooldown,
  towerDamage,
  towerInvested,
  towerRange,
  towersUnlockedAt,
  upgradeCost,
  waveMonsterCount,
  waveSpawnTimes,
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

describe("garden-guard 路径", () => {
  it("拐点转换为格子中心", () => {
    const pts = buildWaypoints([
      [0, 1],
      [3, 1],
    ]);
    expect(pts).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 3.5, y: 1.5 },
    ]);
  });

  it("沿路径取点:起点、中途、终点", () => {
    const pts = buildWaypoints([
      [0, 0],
      [4, 0],
      [4, 2],
    ]);
    expect(pointAlongPath(pts, 0)).toEqual({ x: 0.5, y: 0.5, done: false });
    const mid = pointAlongPath(pts, 5);
    expect(mid.x).toBeCloseTo(4.5);
    expect(mid.y).toBeCloseTo(1.5);
    expect(mid.done).toBe(false);
    expect(pointAlongPath(pts, 99).done).toBe(true);
  });

  it("路径格子集合包含拐角与中间格;多路取并集", () => {
    const cells = pathCellSet([
      [0, 1],
      [2, 1],
      [2, 3],
    ]);
    expect(cells.has("0,1")).toBe(true);
    expect(cells.has("1,1")).toBe(true);
    expect(cells.has("2,2")).toBe(true);
    expect(cells.has("0,0")).toBe(false);
    const both = pathsCellSet([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 5],
        [1, 5],
      ],
    ]);
    expect(both.has("0,0")).toBe(true);
    expect(both.has("0,5")).toBe(true);
  });
});

describe("garden-guard 99 关九大主题战役", () => {
  it("经典战役正好 99 关,9 章 × 11 关(1.1 只在末尾追加)", () => {
    expect(CLASSIC_LEVEL_COUNT).toBe(99);
    expect(CLASSIC_THEME_COUNT * LEVELS_PER_THEME).toBe(99);
    expect(LEVELS.length).toBeGreaterThanOrEqual(99);
    for (let i = 0; i < CLASSIC_LEVEL_COUNT; i++) {
      expect(THEME_ORDER.indexOf(LEVELS[i].theme)).toBeLessThan(CLASSIC_THEME_COUNT);
    }
  });

  it("关卡按章节分组,每章关数与主题一致", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(idxs.length).toBe(themeSize(ci));
      for (const i of idxs) {
        expect(LEVELS[i].theme).toBe(THEME_ORDER[ci]);
        expect(themeOfLevel(i)).toBe(THEME_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写布局;经典章生成关不超过 3 关", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const defs = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = defs.filter((d) => !d.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      if (ci < CLASSIC_THEME_COUNT) {
        expect(defs.length - hand.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("每章手写关的布局(路径+波次)互不相同", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const hand = levelIndicesOfTheme(ci)
        .map((i) => LEVELS[i])
        .filter((d) => !d.gen);
      const layouts = new Set(
        hand.map((d) => JSON.stringify(d.paths) + "|" + levelWaveSignature(d)),
      );
      expect(layouts.size).toBe(hand.length);
    }
  });

  it("生成关的波次模板互不重复(全局查重)", () => {
    const genDefs = LEVELS.filter((d) => d.gen);
    expect(genDefs.length).toBe(LEVELS.length - THEME_ORDER.length * HANDMADE_PER_THEME);
    const sigs = new Set(genDefs.map((d) => levelWaveSignature(d)));
    expect(sigs.size).toBe(genDefs.length);
  });

  it("每关都有独特机制标记(feature),且互不相同", () => {
    const features = LEVELS.map((l) => l.feature);
    expect(features.every((f) => f.length > 0)).toBe(true);
    expect(new Set(features).size).toBe(LEVELS.length);
  });

  it("战役至少引入 8 种不同的怪物", () => {
    const kinds = new Set<MonsterKind>();
    for (const def of LEVELS) {
      for (const wave of def.waves) for (const e of wave) kinds.add(e.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(8);
  });

  it("九章配色互不相同,每章都有自己的 BOSS 关", () => {
    const palettes = new Set(THEME_ORDER.map((t) => THEME_STYLE[t].bgA + THEME_STYLE[t].accent));
    expect(palettes.size).toBe(THEME_ORDER.length);
    const bossKinds = new Set<MonsterKind>();
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const defs = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const bossLevels = defs.filter((l) =>
        l.waves.some((w) => w.some((e) => MONSTER_INFO[e.kind].boss)),
      );
      expect(bossLevels.length).toBeGreaterThanOrEqual(1);
      // 章末一定是 BOSS 关
      const last = defs[defs.length - 1];
      const lastBoss = last.waves.flat().find((e) => MONSTER_INFO[e.kind].boss);
      expect(lastBoss).toBeDefined();
      expect(lastBoss!.kind).toBe(THEME_STYLE[THEME_ORDER[ci]].boss);
      bossKinds.add(lastBoss!.kind);
    }
    // 九个 BOSS 互不相同
    expect(bossKinds.size).toBe(THEME_ORDER.length);
  });

  it("每章怪物主力阵容组合互不相同", () => {
    const combos = new Set(
      THEME_ORDER.map((t) => [...THEME_STYLE[t].palette].sort().join(",")),
    );
    expect(combos.size).toBe(THEME_ORDER.length);
  });

  it("BOSS 技能组合各有特色(冲刺/隐身/回血/召唤/暴走/分裂)", () => {
    const sigs = THEME_ORDER.map((t) => {
      const s = MONSTER_INFO[THEME_STYLE[t].boss];
      return [s.dashes, s.sneaks, s.heals, s.summons, s.enrages, s.splits]
        .map((v) => (v ? "1" : "0"))
        .join("");
    });
    expect(new Set(sigs).size).toBeGreaterThanOrEqual(7);
  });

  it("有双路(绕路)关卡", () => {
    expect(LEVELS.filter((l) => l.paths.length >= 2).length).toBeGreaterThanOrEqual(6);
  });

  it("所有路径都在棋盘内且够长", () => {
    for (const def of LEVELS) {
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      for (const path of def.paths) {
        for (const [c, r] of path) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(GRID_COLS);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(GRID_ROWS);
        }
        expect(pathLength(buildWaypoints(path))).toBeGreaterThan(5);
      }
    }
  });

  it("出场时间表数量与波定义一致且时间递增", () => {
    const wave = LEVELS[1].waves[0];
    const times = waveSpawnTimes(wave);
    expect(times.length).toBe(waveMonsterCount(wave));
    for (let i = 1; i < times.length; i++) {
      expect(times[i].time).toBeGreaterThanOrEqual(times[i - 1].time);
    }
  });

  it("每关都有足够多的怪,不会一下就打完", () => {
    for (const def of LEVELS) {
      expect(levelMonsterCount(def)).toBeGreaterThanOrEqual(6);
    }
  });

  it("怪物血量/护甲/奖励随关卡上涨", () => {
    expect(monsterHp("softy", 50)).toBeGreaterThan(monsterHp("softy", 0));
    expect(monsterHp("softy", 98)).toBeGreaterThan(monsterHp("softy", 50));
    expect(monsterArmor("shieldy", 40)).toBeGreaterThan(monsterArmor("shieldy", 0));
    expect(monsterArmor("softy", 40)).toBe(0);
    expect(monsterReward("softy", 98)).toBeGreaterThan(monsterReward("softy", 0));
  });
});

describe("garden-guard 塔", () => {
  it("五种塔各有分工", () => {
    expect(TOWER_KINDS.length).toBeGreaterThanOrEqual(5);
    expect(TOWER_INFO.bubble.dmg).toBeGreaterThan(TOWER_INFO.needle.dmg);
    expect(TOWER_INFO.needle.cd).toBeLessThan(TOWER_INFO.bubble.cd);
    expect(TOWER_INFO.dew.slow).toBeDefined();
    expect(TOWER_INFO.sunny.produce).toBeDefined();
    expect(TOWER_INFO.boom.splash).toBeDefined();
  });

  it("新塔按关卡顺序解锁", () => {
    const first = towersUnlockedAt(0, LEVELS);
    expect(first).toEqual(["bubble", "needle", "dew"]);
    const all = towersUnlockedAt(LEVELS.length - 1, LEVELS);
    expect(all).toContain("sunny");
    expect(all).toContain("boom");
  });

  it("升级让塔更强", () => {
    expect(towerDamage("bubble", 2)).toBeGreaterThan(towerDamage("bubble", 1));
    expect(towerRange("needle", 3)).toBeGreaterThan(towerRange("needle", 1));
    expect(towerCooldown("needle", 3)).toBeLessThan(towerCooldown("needle", 1));
    expect(dewSlowFactor(3)).toBeLessThan(dewSlowFactor(1));
    expect(sunnyInterval(3)).toBeLessThan(sunnyInterval(1));
    expect(boomSplash(3)).toBeGreaterThan(boomSplash(1));
  });

  it("升级费用递增,卖塔退六成", () => {
    expect(upgradeCost("bubble", 2)).toBeGreaterThan(upgradeCost("bubble", 1));
    expect(towerInvested("bubble", 2)).toBe(
      TOWER_INFO.bubble.cost + upgradeCost("bubble", 1),
    );
    const invested = towerInvested("needle", MAX_TOWER_LEVEL);
    expect(sellRefund("needle", MAX_TOWER_LEVEL)).toBe(Math.floor(invested * 0.6));
  });

  it("减速光环叠加取最狠但有下限", () => {
    expect(combineSlow([])).toBe(1);
    expect(combineSlow([0.55, 0.47])).toBeCloseTo(0.47);
    expect(combineSlow([0.1, 0.2])).toBeCloseTo(0.35);
  });
});

describe("garden-guard 怪物机制", () => {
  it("护甲先掉、敲碎护甲有标记", () => {
    const r1 = applyHit(5, 2, 3);
    expect(r1.armor).toBe(0);
    expect(r1.hp).toBe(4);
    expect(r1.brokeArmor).toBe(true);
    const r2 = applyHit(5, 0, 2);
    expect(r2.hp).toBe(3);
    expect(r2.brokeArmor).toBe(false);
  });

  it("隐身怪不会被索敌", () => {
    const monsters = [
      { x: 1, y: 1, dist: 5, hp: 3, hidden: true },
      { x: 1, y: 1.2, dist: 2, hp: 3, hidden: false },
    ];
    expect(pickTarget(monsters, 1, 1, 2)).toBe(1);
  });

  it("路上、占用、出界都不能放塔", () => {
    const blocked = new Set(["1,1"]);
    const occupied = new Set(["2,2"]);
    expect(canPlace(0, 0, blocked, occupied)).toBe(true);
    expect(canPlace(1, 1, blocked, occupied)).toBe(false);
    expect(canPlace(2, 2, blocked, occupied)).toBe(false);
    expect(canPlace(-1, 0, blocked, occupied)).toBe(false);
    expect(canPlace(GRID_COLS, 0, blocked, occupied)).toBe(false);
    expect(canPlace(0, GRID_ROWS, blocked, occupied)).toBe(false);
  });
});

describe("garden-guard 3 星与进度", () => {
  it("三星条件:不掉心 3 星,掉 1 心 2 星,守住 1 星", () => {
    expect(starsForLevel(0)).toBe(3);
    expect(starsForLevel(1)).toBe(2);
    expect(starsForLevel(2)).toBe(1);
    expect(starsForLevel(4)).toBe(1);
  });

  it("连击每 5 只奖励花瓣", () => {
    expect(comboPetalBonus(4)).toBe(0);
    expect(comboPetalBonus(5)).toBe(2);
    expect(comboPetalBonus(10)).toBe(2);
  });

  it("进度存档:序列化/解析回环,坏档兜底", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    stars[1] = 2;
    const parsed = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(parsed[0]).toBe(3);
    expect(parsed[1]).toBe(2);
    expect(parsed.length).toBe(LEVELS.length);
    expect(parseProgress("not json", LEVELS.length)).toEqual(
      new Array(LEVELS.length).fill(0),
    );
    expect(parseProgress(JSON.stringify([99, -3]), LEVELS.length)[0]).toBe(3);
  });

  it("解锁规则:第一关永远解锁,通关才开下一关", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 1;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(isLevelUnlocked(stars, 2)).toBe(false);
    expect(totalStars([3, 2, 1])).toBe(6);
  });

  it("章节解锁:第一章永远开放,后一章要打通前一章末关", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME; i++) stars[i] = 2;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
    expect(themeStars(stars, 0)).toBe(LEVELS_PER_THEME * 2);
    expect(themeCleared(stars, 0)).toBe(LEVELS_PER_THEME);
    expect(themeCleared(stars, 1)).toBe(0);
  });
});

describe("结算面板朗读文案", () => {
  it("三星过关夸完美守卫,其余报星数", () => {
    expect(clearSpeechLine("新手花圃", 3)).toBe("新手花圃通过!三颗星,一颗心都没掉,完美守卫!");
    expect(clearSpeechLine("新手花圃", 2)).toBe("新手花圃通过!得到 2 颗星,真棒!");
  });

  it("失败朗读温柔安抚,BOSS 关带悄悄提示", () => {
    expect(retrySpeechLine(null)).toBe("哎呀,花朵蔫了。没关系,就在这一关再来一次!");
    expect(retrySpeechLine("露珠塔能拖住它!")).toBe(
      "哎呀,花朵蔫了。没关系,就在这一关再来一次!悄悄告诉你:露珠塔能拖住它!"
    );
  });
});

/* ================= 1.1:188 关十三章 + 新塔/飞怪/路障/天气 ================= */

describe("garden-guard 1.1 · 188 关十三章", () => {
  it("章节和 === 188:13 章长度相加正好 188 关", () => {
    expect(TOTAL_LEVELS).toBe(188);
    expect(LEVELS.length).toBe(188);
    expect(THEME_ORDER.length).toBe(13);
    expect(THEME_SIZES.length).toBe(13);
    expect(THEME_SIZES.reduce((s, n) => s + n, 0)).toBe(188);
  });

  it("前 99 关一字不动:关卡数据回归指纹保持不变", () => {
    expect(fnv1a(JSON.stringify(LEVELS.slice(0, CLASSIC_LEVEL_COUNT)))).toBe("7c76e1eb");
  });

  it("前 99 关不带 1.1 新机制:无天气、无路障、不出新怪新塔", () => {
    for (let i = 0; i < CLASSIC_LEVEL_COUNT; i++) {
      const def = LEVELS[i];
      expect(def.weather).toBeUndefined();
      expect(def.barricades).toBeUndefined();
      for (const wave of def.waves) {
        for (const e of wave) {
          expect(MONSTER_INFO[e.kind].flies ?? false).toBe(false);
        }
      }
    }
    const classicTowers = new Set(LEVELS.slice(0, CLASSIC_LEVEL_COUNT).map((d) => d.unlockTower));
    expect(classicTowers.has("frost")).toBe(false);
    expect(classicTowers.has("mist")).toBe(false);
  });

  it("新 4 章:夜露温室/齿轮花房/云端苗圃/星辉花冠,22/22/22/23 关", () => {
    expect(THEME_ORDER.slice(9)).toEqual(["dewhouse", "gearhouse", "cloudfarm", "starcrown"]);
    expect(THEME_SIZES.slice(9)).toEqual([22, 22, 22, 23]);
    expect(THEME_STYLE.dewhouse.name).toBe("夜露温室");
    expect(THEME_STYLE.gearhouse.name).toBe("齿轮花房");
    expect(THEME_STYLE.cloudfarm.name).toBe("云端苗圃");
    expect(THEME_STYLE.starcrown.name).toBe("星辉花冠");
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

  it("新章章末都是新 BOSS,四位新 BOSS 各有本领", () => {
    expect(LEVELS[120].waves.flat().some((e) => e.kind === "boss10")).toBe(true);
    expect(LEVELS[142].waves.flat().some((e) => e.kind === "boss11")).toBe(true);
    expect(LEVELS[164].waves.flat().some((e) => e.kind === "boss12")).toBe(true);
    expect(LEVELS[187].waves.flat().some((e) => e.kind === "boss13")).toBe(true);
    expect(MONSTER_INFO.boss10.sneaks && MONSTER_INFO.boss10.heals).toBe(true);
    expect(MONSTER_INFO.boss11.dashes && MONSTER_INFO.boss11.summons).toBe(true);
    expect(MONSTER_INFO.boss12.flies && MONSTER_INFO.boss12.enrages).toBe(true);
    expect(MONSTER_INFO.boss13.summons && MONSTER_INFO.boss13.enrages).toBe(true);
    expect(MONSTER_INFO.boss13.hp).toBeGreaterThan(MONSTER_INFO.boss9.hp);
  });

  it("新塔冰晶/毒雾:第 100 关解锁冰晶,齿轮花房开章解锁毒雾", () => {
    expect(TOWER_KINDS).toContain("frost");
    expect(TOWER_KINDS).toContain("mist");
    expect(LEVELS[99].unlockTower).toBe("frost");
    expect(LEVELS[121].unlockTower).toBe("mist");
    const before = towersUnlockedAt(98, LEVELS);
    expect(before).not.toContain("frost");
    expect(before).not.toContain("mist");
    const after = towersUnlockedAt(121, LEVELS);
    expect(after).toContain("frost");
    expect(after).toContain("mist");
  });

  it("冰晶塔命中减速:等级越高冻得越狠,有下限有时限", () => {
    expect(frostSlowFactor(2)).toBeLessThan(frostSlowFactor(1));
    expect(frostSlowFactor(3)).toBeLessThan(frostSlowFactor(2));
    expect(frostSlowFactor(9)).toBeGreaterThanOrEqual(0.34);
    expect(FROST_DURATION).toBeGreaterThan(0);
    expect(TOWER_INFO.frost.hitSlow).toBe(true);
  });

  it("毒雾塔:毒伤随级递增,标记为无视护甲的毒雾塔", () => {
    expect(mistPoisonDamage(2)).toBeGreaterThan(mistPoisonDamage(1));
    expect(mistPoisonDamage(3)).toBeGreaterThan(mistPoisonDamage(2));
    expect(TOWER_INFO.mist.poison).toBe(true);
    expect(TOWER_INFO.mist.air).toBeUndefined();
  });

  it("对空规则:泡泡/针针/冰晶能打飞怪,露珠/阳光/花火/毒雾不能", () => {
    expect(towerCanHitAir("bubble")).toBe(true);
    expect(towerCanHitAir("needle")).toBe(true);
    expect(towerCanHitAir("frost")).toBe(true);
    expect(towerCanHitAir("dew")).toBe(false);
    expect(towerCanHitAir("sunny")).toBe(false);
    expect(towerCanHitAir("boom")).toBe(false);
    expect(towerCanHitAir("mist")).toBe(false);
  });

  it("索敌:不能对空的塔会跳过飞怪,能对空的塔照打", () => {
    const monsters = [
      { x: 1, y: 1, dist: 5, hp: 3, flying: true },
      { x: 1, y: 1.2, dist: 2, hp: 3 },
    ];
    expect(pickTarget(monsters, 1, 1, 2, false)).toBe(1);
    expect(pickTarget(monsters, 1, 1, 2, true)).toBe(0);
    expect(pickTarget(monsters, 1, 1, 2)).toBe(0);
  });

  it("新怪:飞飞怪/云朵怪都会飞,云朵怪更肉更慢", () => {
    expect(MONSTER_INFO.flappy.flies).toBe(true);
    expect(MONSTER_INFO.glidey.flies).toBe(true);
    expect(MONSTER_INFO.glidey.hp).toBeGreaterThan(MONSTER_INFO.flappy.hp);
    expect(MONSTER_INFO.glidey.speed).toBeLessThan(MONSTER_INFO.flappy.speed);
    const airLevels = LEVELS.filter((d) =>
      d.waves.some((w) => w.some((e) => MONSTER_INFO[e.kind].flies)),
    );
    expect(airLevels.length).toBeGreaterThanOrEqual(20);
  });

  it("天气影响射程与怪速:起雾变短、顺风变长、细雨都慢", () => {
    expect(weatherRangeMult("fog")).toBeLessThan(1);
    expect(weatherRangeMult("breeze")).toBeGreaterThan(1);
    expect(weatherRangeMult("clear")).toBe(1);
    expect(weatherRangeMult(undefined)).toBe(1);
    expect(weatherSpeedMult("drizzle")).toBeLessThan(1);
    expect(weatherSpeedMult("breeze")).toBeGreaterThan(1);
    expect(effectiveRange("needle", 1, "fog")).toBeLessThan(towerRange("needle", 1));
    expect(effectiveRange("needle", 1, "breeze")).toBeGreaterThan(towerRange("needle", 1));
    expect(effectiveRange("needle", 2, undefined)).toBe(towerRange("needle", 2));
    // 新章里三种非晴朗天气都要登场
    const used = new Set(LEVELS.slice(99).map((d) => d.weather).filter((x) => x && x !== "clear"));
    expect(used.has("fog")).toBe(true);
    expect(used.has("breeze")).toBe(true);
    expect(used.has("drizzle")).toBe(true);
    for (const k of ["clear", "fog", "breeze", "drizzle"] as const) {
      expect(WEATHER_INFO[k].name.length).toBeGreaterThan(0);
    }
  });

  it("路障:不压路、不越界、有耐久,拆掉有奖励", () => {
    expect(BARRICADE_SMASH_REWARD).toBeGreaterThanOrEqual(1);
    const withBarr = LEVELS.filter((d) => (d.barricades ?? []).length > 0);
    expect(withBarr.length).toBeGreaterThanOrEqual(10);
    for (const def of withBarr) {
      const cells = pathsCellSet(def.paths);
      for (const [c, r, hp] of def.barricades!) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(GRID_COLS);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(GRID_ROWS);
        expect(hp).toBeGreaterThanOrEqual(1);
        expect(cells.has(`${c},${r}`)).toBe(false);
      }
    }
    const map = barricadeMap([[2, 1, 3], [4, 4, 5]]);
    expect(map.get("2,1")).toBe(3);
    expect(map.get("4,4")).toBe(5);
    expect(barricadeMap(undefined).size).toBe(0);
  });

  it("100+ 关血量坡度放缓但仍上涨,护甲不失控", () => {
    expect(monsterHp("softy", 99)).toBeGreaterThanOrEqual(monsterHp("softy", 98));
    expect(monsterHp("softy", 187)).toBeGreaterThan(monsterHp("softy", 99));
    const classicStep = monsterHp("tanky", 98) - monsterHp("tanky", 88);
    const newStep = monsterHp("tanky", 160) - monsterHp("tanky", 150);
    expect(newStep).toBeLessThanOrEqual(classicStep);
    expect(monsterArmor("shieldy", 187)).toBeGreaterThanOrEqual(monsterArmor("shieldy", 98));
    expect(monsterArmor("shieldy", 187) - monsterArmor("shieldy", 98)).toBeLessThanOrEqual(4);
    // 前 99 关的数值曲线保持原样
    expect(monsterHp("softy", 50)).toBe(Math.round(MONSTER_INFO.softy.hp * (1 + 50 * 0.042)));
  });

  it("章节解锁沿用变长偏移:打通上一章末关才开新章", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 9)).toBe(false);
    for (let i = 0; i < 99; i++) stars[i] = 1;
    expect(isThemeUnlocked(stars, 9)).toBe(true);
    expect(isThemeUnlocked(stars, 10)).toBe(false);
    for (let i = 99; i <= 120; i++) stars[i] = 1;
    expect(isThemeUnlocked(stars, 10)).toBe(true);
  });

  it("新章文案不夹带商标:全部关卡名/提示为原创中文", () => {
    const banned = ["植物大战", "僵尸", "保卫萝卜", "王国保卫", "Kingdom", "PvZ"];
    for (const def of LEVELS) {
      for (const word of banned) {
        expect(def.name.includes(word)).toBe(false);
        expect(def.hint.includes(word)).toBe(false);
      }
    }
  });
});

describe("garden-guard 1.1 · 固定策略模拟可通关", () => {
  it("第 100–188 关资源曲线不是死局:固定策略全部能赢", () => {
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateLevel(i);
      expect(r.win, `第 ${i + 1} 关 ${LEVELS[i].name} 应能用固定策略通关`).toBe(true);
    }
  }, 120000);

  it("经典关抽查:第 1/34/67/99 关固定策略也能赢(回归)", () => {
    for (const i of [0, 33, 66, 98]) {
      expect(simulateLevel(i).win, `第 ${i + 1} 关`).toBe(true);
    }
  }, 60000);

  it("四个新 BOSS 关能赢也能输:不种塔必输,正常打必赢", () => {
    for (const i of [120, 142, 164, 187]) {
      const win = simulateLevel(i);
      expect(win.win, `BOSS 关 ${i + 1} 正常打`).toBe(true);
      const lose = simulateLevel(i, { noTowers: true });
      expect(lose.win, `BOSS 关 ${i + 1} 摆烂`).toBe(false);
      expect(lose.heartsLeft).toBe(0);
    }
  }, 60000);

  it("模拟器结果字段完整,失败时心数为 0", () => {
    const r = simulateLevel(187, { noTowers: true });
    expect(r.towersBuilt).toBe(0);
    expect(r.towersUpgraded).toBe(0);
    expect(r.monstersLeaked).toBeGreaterThanOrEqual(5);
    expect(r.timeUsed).toBeGreaterThan(0);
  });
});
