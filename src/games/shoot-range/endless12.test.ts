/**
 * 1.2 无尽「打不完的靶场」的单测(规格第四节最后一行)。
 * 密度与靶速随时间上升、投放曲线可复现、成绩单调、跑掉 5 个收工。
 */
import { describe, expect, it } from "vitest";
import {
  ALIVE_MAX,
  ENDLESS_MISS_LIMIT,
  SPAWN_EVERY_MIN,
  SPEED_MAX,
  TTL_MIN,
  UNLOCK_FLOWER_S,
  UNLOCK_RAINBOW_S,
  UNLOCK_SHIELD_S,
  UNLOCK_SPLIT_S,
  endlessLine,
  endlessPhase,
  endlessSchedule,
  endlessScore,
  endlessTarget,
  missLine,
  spawnCountBefore,
  spawnTimeAt,
  spawnsPerMinute,
  waveAt,
  type EndlessStat,
} from "./endless12";
import { depthRowOf, isForbidden, mustClear } from "./targets12";

const stat = (over: Partial<EndlessStat> = {}): EndlessStat => ({
  cleared: 20,
  points: 300,
  elapsed: 60,
  hits: 24,
  shots: 30,
  bestCombo: 6,
  missed: 1,
  ...over,
});

describe("shoot-range 1.2 无尽 · 强度曲线", () => {
  it("投放间隔越来越短、靶速越来越快、场上越来越挤,四条都有封顶", () => {
    const t0 = endlessPhase(0);
    const t60 = endlessPhase(60);
    const t180 = endlessPhase(180);
    expect(t60.spawnEvery).toBeLessThan(t0.spawnEvery);
    expect(t180.spawnEvery).toBeLessThan(t60.spawnEvery);
    expect(t60.speedMul).toBeGreaterThan(t0.speedMul);
    expect(t60.maxAlive).toBeGreaterThan(t0.maxAlive);
    expect(t60.ttl).toBeLessThan(t0.ttl);
    const far = endlessPhase(100000);
    expect(far.spawnEvery).toBe(SPAWN_EVERY_MIN);
    expect(far.speedMul).toBe(SPEED_MAX);
    expect(far.maxAlive).toBe(ALIVE_MAX);
    expect(far.ttl).toBe(TTL_MIN);
  });

  it("每分钟出靶数单调上升——这就是「密度曲线」", () => {
    let prev = 0;
    for (const t of [0, 20, 40, 60, 90, 120, 200]) {
      const n = spawnsPerMinute(t);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(spawnsPerMinute(200)).toBeGreaterThan(spawnsPerMinute(0) * 2);
  });

  it("靶种按时间解锁:先彩虹靶,再分裂靶,再护盾靶;不许打的靶最后才混进来", () => {
    expect(endlessPhase(UNLOCK_RAINBOW_S - 1).kinds).not.toContain("rainbow");
    expect(endlessPhase(UNLOCK_RAINBOW_S).kinds).toContain("rainbow");
    expect(endlessPhase(UNLOCK_SPLIT_S - 1).kinds).not.toContain("split");
    expect(endlessPhase(UNLOCK_SPLIT_S).kinds).toContain("split");
    expect(endlessPhase(UNLOCK_SHIELD_S).kinds).toContain("shield");
    expect(endlessPhase(UNLOCK_FLOWER_S - 1).forbiddenChance).toBe(0);
    expect(endlessPhase(UNLOCK_FLOWER_S + 60).forbiddenChance).toBeGreaterThan(0);
    // 不许打的靶封顶,不会满屏都是花
    expect(endlessPhase(100000).forbiddenChance).toBeLessThanOrEqual(0.26);
    expect(waveAt(0)).toBe(1);
    expect(waveAt(1000)).toBeGreaterThan(waveAt(100));
  });

  it("ttl 有下限:再往后靶子也留够 3 秒以上,不做「必须秒反应」的不公平靶", () => {
    for (const t of [0, 60, 120, 300, 900]) {
      expect(endlessPhase(t).ttl).toBeGreaterThanOrEqual(TTL_MIN);
    }
    expect(TTL_MIN).toBeGreaterThanOrEqual(3);
  });
});

describe("shoot-range 1.2 无尽 · 投放表可复现", () => {
  it("同一个序号永远同一个时刻、同一个靶,整场重放一模一样", () => {
    const a = endlessSchedule(90);
    const b = endlessSchedule(90);
    expect(a.length).toBeGreaterThan(20);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(spawnTimeAt(30)).toBe(a[30].at);
  });

  it("投放时刻严格递增,后半程同样长的一段窗口里出的靶明显更多", () => {
    const times = endlessSchedule(240).map((s) => s.at);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const early = spawnCountBefore(30) - spawnCountBefore(0);
    const late = spawnCountBefore(210) - spawnCountBefore(180);
    expect(late).toBeGreaterThan(early);
  });

  it("放出来的靶都在场地里,远近两排的标记与 y 坐标对得上", () => {
    for (const { target } of endlessSchedule(200)) {
      expect(target.r).toBeGreaterThan(15);
      expect(target.x).toBeGreaterThan(50);
      expect(target.x).toBeLessThan(950);
      expect(target.y).toBeGreaterThan(60);
      expect(target.y).toBeLessThan(500);
      expect(target.ttl).toBeGreaterThan(0);
      expect(target.far === true).toBe(depthRowOf(target.y) === "far");
      // 必打的靶都有 ttl,所以「打不完的靶场」永远不会卡死在一个打不到的靶上
      if (mustClear(target.kind)) expect(typeof target.ttl).toBe("number");
    }
  });

  it("开场那几分钟不出「不许打的靶」,后面才慢慢混进来", () => {
    const early = endlessSchedule(UNLOCK_FLOWER_S - 1);
    expect(early.some((s) => isForbidden(s.target.kind))).toBe(false);
    const long = endlessSchedule(600);
    const forbidden = long.filter((s) => isForbidden(s.target.kind)).length;
    expect(forbidden).toBeGreaterThan(0);
    expect(forbidden / long.length).toBeLessThan(0.26);
  });

  it("强度是按投放那一刻算的:同一个序号在不同强度下靶速不同", () => {
    const slow = endlessTarget(9, endlessPhase(0));
    const fast = endlessTarget(9, endlessPhase(200));
    expect(slow.kind).toBeDefined();
    expect(Math.abs(fast.vx) + Math.abs(fast.vy)).toBeGreaterThan(Math.abs(slow.vx) + Math.abs(slow.vy));
  });
});

describe("shoot-range 1.2 无尽 · 成绩与收工", () => {
  it("撑得久、打得准、连得长,三项都单调加分", () => {
    const base = endlessScore(stat());
    expect(endlessScore(stat({ cleared: 40 }))).toBeGreaterThan(base);
    expect(endlessScore(stat({ elapsed: 200 }))).toBeGreaterThan(base);
    expect(endlessScore(stat({ points: 900 }))).toBeGreaterThan(base);
    expect(endlessScore(stat({ bestCombo: 20 }))).toBeGreaterThan(base);
    expect(endlessScore(stat({ hits: 30 }))).toBeGreaterThan(base);
    // 一发没打也不会是负分
    expect(endlessScore(stat({ cleared: 0, points: -200, elapsed: 3, hits: 0, shots: 4, bestCombo: 0 }))).toBeGreaterThanOrEqual(0);
  });

  it("收工文案报成绩、破纪录会说,而且一句都不批评", () => {
    const s = stat();
    const score = endlessScore(s);
    const fresh = endlessLine(s, score, score);
    expect(fresh).toContain("新的最好成绩");
    const behind = endlessLine(s, score, score + 500);
    expect(behind).toContain("再来一轮");
    for (const line of [fresh, behind, missLine(1), missLine(ENDLESS_MISS_LIMIT)]) {
      for (const bad of ["笨", "输了", "失败", "差劲"]) expect(line).not.toContain(bad);
    }
  });

  it("跑掉 5 个才收工,前面几个只是轻轻提醒还剩几次", () => {
    expect(ENDLESS_MISS_LIMIT).toBe(5);
    expect(missLine(1)).toContain("4");
    expect(missLine(ENDLESS_MISS_LIMIT - 1)).toContain("稳住");
    expect(missLine(ENDLESS_MISS_LIMIT)).toContain("成绩记下了");
  });
});
