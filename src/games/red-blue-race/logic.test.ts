import { describe, expect, it } from "vitest";
import { SaveStore, type StorageLike } from "../../engine/save";
import { LEVELS, type RaceLevel } from "./levels";
import {
  BEAT_WINDOW_MS,
  CASUAL_PLAY,
  COMBO_STEP_BONUS,
  ITEM_SLOW_FACTOR,
  SKILLED_PLAY,
  STAMINA_RESUME_RATIO,
  TIRED_STEP_FACTOR,
  adaptiveAiSpeed,
  comboMultiplier,
  endlessChaserSpeed,
  endlessGapMeters,
  inZone,
  isNewRecord,
  mechanicsOf,
  nextCombo,
  onBeat,
  simulateRace,
  staminaResumeAt,
  staminaStepFactor
} from "./logic";

function level(patch: Partial<RaceLevel> = {}): RaceLevel {
  return { aiSpeed: 8, tapStep: 1.6, obstacles: [], theme: 9, ...patch };
}

describe("红蓝赛跑 · 节拍连击", () => {
  it("连击层数换步长加成，层数封顶后不再涨", () => {
    expect(comboMultiplier(0, 10)).toBe(1);
    expect(comboMultiplier(3, 10)).toBeCloseTo(1 + 3 * COMBO_STEP_BONUS, 10);
    expect(comboMultiplier(99, 10)).toBeCloseTo(1 + 10 * COMBO_STEP_BONUS, 10);
    expect(comboMultiplier(-5, 10)).toBe(1);
  });

  it("点击间隔落在鼓点容差内才算踩中", () => {
    expect(onBeat(240, 240)).toBe(true);
    expect(onBeat(240 - BEAT_WINDOW_MS, 240)).toBe(true);
    expect(onBeat(240 + BEAT_WINDOW_MS + 1, 240)).toBe(false);
    // 没有鼓点的关永远不算踩中
    expect(onBeat(240, 0)).toBe(false);
  });

  it("踩中就加一层，抢拍立刻清零", () => {
    const cfg = level({ beatMs: 240, comboMax: 5 });
    expect(nextCombo(0, 240, cfg)).toBe(1);
    expect(nextCombo(4, 240, cfg)).toBe(5);
    expect(nextCombo(5, 240, cfg)).toBe(5);
    expect(nextCombo(5, 40, cfg)).toBe(0);
    // 不带鼓点的关不累连击
    expect(nextCombo(3, 240, level())).toBe(0);
  });
});

describe("红蓝赛跑 · 体力条", () => {
  it("体力见底步子减半，没启用体力条的关永远满步", () => {
    const cfg = level({ stamina: 20, staminaRegen: 5 });
    expect(staminaStepFactor(12, cfg)).toBe(1);
    expect(staminaStepFactor(0.4, cfg)).toBe(TIRED_STEP_FACTOR);
    expect(staminaStepFactor(0, level())).toBe(1);
  });

  it("松手换气要回到四成体力才缓得过来", () => {
    expect(staminaResumeAt(level({ stamina: 20 }))).toBeCloseTo(20 * STAMINA_RESUME_RATIO, 10);
    expect(staminaResumeAt(level())).toBe(0);
  });

  it("同一关不换气会明显吃亏", () => {
    const cfg = LEVELS[110];
    const paced = simulateRace(cfg, SKILLED_PLAY);
    const mashed = simulateRace(cfg, { ...SKILLED_PLAY, pace: false });
    expect(paced.meTime).toBeLessThanOrEqual(mashed.meTime);
  });
});

describe("红蓝赛跑 · 读招电脑", () => {
  it("你领先它就提速，你落后它稍稍收力", () => {
    const cfg = level({ aiSpeed: 8, aiAdapt: 0.3 });
    expect(adaptiveAiSpeed(cfg, 0, 0)).toBeCloseTo(8, 10);
    expect(adaptiveAiSpeed(cfg, 60, 20)).toBeGreaterThan(8);
    expect(adaptiveAiSpeed(cfg, 20, 60)).toBeLessThan(8);
    // 再落后也不会停下来散步
    expect(adaptiveAiSpeed(cfg, 0, 100)).toBeGreaterThan(8 * 0.5 - 0.001);
  });

  it("不带读招的关永远匀速", () => {
    const cfg = level({ aiSpeed: 7.5 });
    expect(adaptiveAiSpeed(cfg, 90, 10)).toBe(7.5);
  });
});

describe("红蓝赛跑 · 道具抢夺", () => {
  it("礼物箱谁先冲到谁拿：手快的一方能抢到", () => {
    const cfg = level({ aiSpeed: 6, tapStep: 1.6, obstacles: [{ type: "item", pos: 40, len: 4 }] });
    const fast = simulateRace(cfg, SKILLED_PLAY);
    const slow = simulateRace(cfg, CASUAL_PLAY);
    expect(fast.itemsTaken).toBe(1);
    expect(slow.itemsTaken).toBe(0);
  });

  it("被抢走的减速倍率是打折不是停摆", () => {
    expect(ITEM_SLOW_FACTOR).toBeGreaterThan(0.4);
    expect(ITEM_SLOW_FACTOR).toBeLessThan(1);
  });

  it("上坡区间判定包含两个端点", () => {
    const hill = { type: "hill" as const, pos: 30, len: 12 };
    expect(inZone(30, hill)).toBe(true);
    expect(inZone(42, hill)).toBe(true);
    expect(inZone(29.9, hill)).toBe(false);
    expect(inZone(42.1, hill)).toBe(false);
  });
});

describe("红蓝赛跑 · 机制清单", () => {
  it("按关卡配置列出本关启用的新玩法", () => {
    expect(mechanicsOf(level())).toEqual([]);
    expect(mechanicsOf(level({ stamina: 20 }))).toEqual(["体力条"]);
    expect(
      mechanicsOf(level({ stamina: 20, beatMs: 240, aiAdapt: 0.2, obstacles: [{ type: "item", pos: 30, len: 4 }] }))
    ).toEqual(["体力条", "道具抢夺", "节拍连击", "读招电脑"]);
  });
});

describe("红蓝赛跑 · 无尽星轨长跑", () => {
  it("追赶者越跑越快，但有封顶不会变成追不上的怪物", () => {
    expect(endlessChaserSpeed(0)).toBeCloseTo(6.4, 10);
    expect(endlessChaserSpeed(300)).toBeGreaterThan(endlessChaserSpeed(0));
    expect(endlessChaserSpeed(99999)).toBe(13.5);
    expect(endlessChaserSpeed(Number.NaN)).toBeCloseTo(6.4, 10);
    expect(endlessChaserSpeed(-50)).toBeCloseTo(6.4, 10);
  });

  it("机关越跑越密，但留着最小安全距离", () => {
    expect(endlessGapMeters(0)).toBe(34);
    expect(endlessGapMeters(400)).toBeLessThan(endlessGapMeters(0));
    expect(endlessGapMeters(99999)).toBe(16);
    expect(endlessGapMeters(Number.NaN)).toBe(34);
  });

  it("破纪录判定按整米比较，0 米不算新纪录", () => {
    expect(isNewRecord(120, 80)).toBe(true);
    expect(isNewRecord(80, 80)).toBe(false);
    expect(isNewRecord(0, 0)).toBe(false);
    expect(isNewRecord(1, 0)).toBe(true);
  });
});

/**
 * 无尽模式的最高分记在平台钱包 `yiduo-yixing.save.v1` 的游戏进度里，
 * 不新开任何存档 key；三款红蓝对战共用这套写法，在这里一并守住。
 */
describe("无尽模式最高分写进平台存档", () => {
  function memStore(): StorageLike {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
      keys: () => [...map.keys()]
    };
  }

  it("只保留历史最高分，成绩变差不会把纪录冲掉", () => {
    const store = new SaveStore(memStore());
    expect(store.getGameProgress("red-blue-race").endlessBest).toBe(0);
    expect(store.recordEndlessBest("red-blue-race", 320)).toBe(320);
    expect(store.recordEndlessBest("red-blue-race", 180)).toBe(320);
    expect(store.getGameProgress("red-blue-race").endlessBest).toBe(320);
  });

  it("脏数据不会写坏存档，星级与游玩次数也不受影响", () => {
    const store = new SaveStore(memStore());
    store.recordPlay("red-blue-race");
    store.recordWin("red-blue-race", 3);
    store.recordEndlessBest("red-blue-race", Number.NaN);
    store.recordEndlessBest("red-blue-race", -40);
    expect(store.getGameProgress("red-blue-race").endlessBest).toBe(0);
    store.recordEndlessBest("red-blue-race", 256.7);
    const p = store.getGameProgress("red-blue-race");
    expect(p.endlessBest).toBe(257);
    expect(p.bestStars).toBe(3);
    expect(p.plays).toBe(1);
  });

  it("老存档没有这个字段也读得出来，而且记完关卡星级不会丢纪录", () => {
    const raw = memStore();
    raw.setItem("yiduo-yixing.save.v1", JSON.stringify({ stars: 12, games: { "red-blue-race": { bestStars: 2, plays: 7 } } }));
    const store = new SaveStore(raw);
    expect(store.getGameProgress("red-blue-race").endlessBest).toBe(0);
    store.recordEndlessBest("red-blue-race", 410);
    store.recordWin("red-blue-race", 3);
    expect(store.getGameProgress("red-blue-race").endlessBest).toBe(410);
    expect(store.getGameProgress("red-blue-race").plays).toBe(7);
    expect(store.getStars()).toBe(12);
  });
});
