import { describe, expect, it } from "vitest";
import {
  GRID_COLS,
  GRID_ROWS,
  LEVELS,
  MAX_TOWER_LEVEL,
  MONSTER_INFO,
  TOWER_INFO,
  buildWaypoints,
  canPlace,
  combineSlow,
  comboPetalBonus,
  dewSlowFactor,
  levelMonsterCount,
  monsterHp,
  pathCellSet,
  pathLength,
  pickTarget,
  pointAlongPath,
  sellRefund,
  starsForRun,
  towerCooldown,
  towerDamage,
  towerInvested,
  towerRange,
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

  it("路径格子集合包含拐角与中间格", () => {
    const cells = pathCellSet([
      [0, 1],
      [2, 1],
      [2, 3],
    ]);
    expect(cells.has("0,1")).toBe(true);
    expect(cells.has("1,1")).toBe(true);
    expect(cells.has("2,2")).toBe(true);
    expect(cells.has("2,3")).toBe(true);
    expect(cells.has("0,0")).toBe(false);
  });
});

describe("garden-guard 关卡", () => {
  it("至少 5 关,每关至少 2 波,路径都在棋盘内", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
    for (const def of LEVELS) {
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      for (const [c, r] of def.corners) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(GRID_COLS);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(GRID_ROWS);
      }
      expect(pathLength(buildWaypoints(def.corners))).toBeGreaterThan(5);
    }
  });

  it("每关路径都不一样(有变化)", () => {
    const keys = LEVELS.map((l) => JSON.stringify(l.corners));
    expect(new Set(keys).size).toBe(LEVELS.length);
  });

  it("最后一关有 BOSS,前面的关没有", () => {
    const hasBoss = (idx: number) =>
      LEVELS[idx].waves.some((w) => w.some((e) => e.kind === "boss"));
    expect(hasBoss(LEVELS.length - 1)).toBe(true);
    expect(hasBoss(0)).toBe(false);
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

  it("怪物血量随关卡上涨", () => {
    expect(monsterHp("softy", 5)).toBeGreaterThan(monsterHp("softy", 1));
    expect(monsterHp("boss", 1)).toBe(MONSTER_INFO.boss.hp);
  });
});

describe("garden-guard 塔", () => {
  it("三种塔各有分工:泡泡伤害高、针针射速快、露珠会减速", () => {
    expect(TOWER_INFO.bubble.dmg).toBeGreaterThan(TOWER_INFO.needle.dmg);
    expect(TOWER_INFO.needle.cd).toBeLessThan(TOWER_INFO.bubble.cd);
    expect(TOWER_INFO.dew.slow).toBeDefined();
    expect(TOWER_INFO.dew.dmg).toBe(0);
  });

  it("升级让塔更强:伤害、射程涨,冷却降", () => {
    expect(towerDamage("bubble", 2)).toBeGreaterThan(towerDamage("bubble", 1));
    expect(towerRange("needle", 3)).toBeGreaterThan(towerRange("needle", 1));
    expect(towerCooldown("needle", 3)).toBeLessThan(towerCooldown("needle", 1));
    expect(dewSlowFactor(3)).toBeLessThan(dewSlowFactor(1));
  });

  it("升级费用递增,投入 = 买价 + 各级升级费", () => {
    expect(upgradeCost("bubble", 2)).toBeGreaterThan(upgradeCost("bubble", 1));
    expect(towerInvested("bubble", 1)).toBe(TOWER_INFO.bubble.cost);
    expect(towerInvested("bubble", 2)).toBe(
      TOWER_INFO.bubble.cost + upgradeCost("bubble", 1),
    );
  });

  it("卖塔退六成(向下取整,至少 1)", () => {
    const invested = towerInvested("needle", MAX_TOWER_LEVEL);
    expect(sellRefund("needle", MAX_TOWER_LEVEL)).toBe(Math.floor(invested * 0.6));
    expect(sellRefund("bubble", 1)).toBeGreaterThanOrEqual(1);
  });

  it("减速光环叠加取最狠但有下限", () => {
    expect(combineSlow([])).toBe(1);
    expect(combineSlow([0.55, 0.47])).toBeCloseTo(0.47);
    expect(combineSlow([0.1, 0.2])).toBeCloseTo(0.35);
  });
});

describe("garden-guard 放塔与索敌", () => {
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

  it("优先打射程内走得最远的怪", () => {
    const monsters = [
      { x: 1, y: 1, dist: 2, hp: 3 },
      { x: 1.5, y: 1, dist: 5, hp: 3 },
      { x: 9, y: 9, dist: 8, hp: 3 },
      { x: 1, y: 1.2, dist: 6, hp: 0 },
    ];
    expect(pickTarget(monsters, 1, 1, 2)).toBe(1);
    expect(pickTarget(monsters, 20, 20, 2)).toBe(-1);
  });
});

describe("garden-guard 结算", () => {
  it("连击每 5 只奖励花瓣", () => {
    expect(comboPetalBonus(4)).toBe(0);
    expect(comboPetalBonus(5)).toBe(2);
    expect(comboPetalBonus(10)).toBe(2);
    expect(comboPetalBonus(0)).toBe(0);
  });

  it("星级:不重试少掉心 3 星,重试多则降星", () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(0, 1)).toBe(3);
    expect(starsForRun(0, 3)).toBe(2);
    expect(starsForRun(1, 0)).toBe(2);
    expect(starsForRun(3, 5)).toBe(1);
  });
});
