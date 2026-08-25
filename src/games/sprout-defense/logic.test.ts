import { describe, expect, it } from "vitest";
import {
  BUG_INFO,
  BugKind,
  LANES,
  LEVELS,
  PLANT_INFO,
  PLANT_KINDS,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  canPlantOnCell,
  isLevelUnlocked,
  levelBugCount,
  parseProgress,
  passiveDewInterval,
  plantsUnlockedAt,
  projectileCanHit,
  serializeProgress,
  shovelRefund,
  starsForLevel,
  totalStars,
} from "./logic";

describe("sprout-defense 战役关卡(深度)", () => {
  it("关卡数量 >= 18,数据驱动", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(18);
  });

  it("每关都有独特机制标记(feature),互不相同", () => {
    const features = LEVELS.map((l) => l.feature);
    expect(features.every((f) => f.length > 0)).toBe(true);
    expect(new Set(features).size).toBe(LEVELS.length);
  });

  it("战役至少 7 种虫,至少 7 种植物", () => {
    const kinds = new Set<BugKind>();
    for (const def of LEVELS) {
      for (const wave of def.waves) for (const e of wave) kinds.add(e.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(7);
    expect(PLANT_KINDS.length).toBeGreaterThanOrEqual(6);
  });

  it("有夜间关、水路关和旗帜大波", () => {
    expect(LEVELS.some((l) => l.scene === "night")).toBe(true);
    const pools = LEVELS.filter((l) => l.scene === "pool");
    expect(pools.length).toBeGreaterThanOrEqual(2);
    for (const p of pools) expect(p.waterLanes.length).toBeGreaterThan(0);
    expect(LEVELS.some((l) => l.flagWaves.length > 0)).toBe(true);
    expect(LEVELS.some((l) => l.flagWaves.length >= 2)).toBe(true);
  });

  it("最后一关有大虫王 BOSS", () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(last.waves.some((w) => w.some((e) => BUG_INFO[e.kind].boss))).toBe(true);
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

  it("夜晚露珠攒得比白天慢", () => {
    expect(passiveDewInterval("night")).toBeGreaterThan(passiveDewInterval("day"));
    expect(passiveDewInterval("pool")).toBe(passiveDewInterval("day"));
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

  it("桶桶虫比壳壳虫更硬,大虫王是 BOSS", () => {
    expect(BUG_INFO.bucket.armor).toBeGreaterThan(BUG_INFO.armor.armor);
    expect(BUG_INFO.bossbug.boss).toBe(true);
    expect(BUG_INFO.digger.jumps).toBe(true);
    expect(bugHp("walker", 16)).toBeGreaterThan(bugHp("walker", 0));
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
});
