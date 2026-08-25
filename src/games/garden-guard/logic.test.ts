import { describe, expect, it } from "vitest";
import {
  GRID_COLS,
  GRID_ROWS,
  HANDMADE_PER_THEME,
  LEVELS,
  LEVELS_PER_THEME,
  MAX_TOWER_LEVEL,
  MONSTER_INFO,
  MonsterKind,
  THEME_ORDER,
  THEME_STYLE,
  TOWER_INFO,
  TOWER_KINDS,
  applyHit,
  buildWaypoints,
  canPlace,
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
  it("正好 99 关,9 章 × 11 关", () => {
    expect(LEVELS.length).toBe(99);
    expect(THEME_ORDER.length).toBeGreaterThanOrEqual(6);
    expect(THEME_ORDER.length * LEVELS_PER_THEME).toBe(99);
  });

  it("关卡按章节分组,每章正好 11 关且主题一致", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const idxs = levelIndicesOfTheme(ci);
      expect(idxs.length).toBe(LEVELS_PER_THEME);
      for (const i of idxs) {
        expect(LEVELS[i].theme).toBe(THEME_ORDER[ci]);
        expect(themeOfLevel(i)).toBe(THEME_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写布局,生成关不超过 3 关", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const defs = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = defs.filter((d) => !d.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      expect(defs.length - hand.length).toBeLessThanOrEqual(3);
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
    expect(genDefs.length).toBe(THEME_ORDER.length * 3);
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
