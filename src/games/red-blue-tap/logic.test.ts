import { describe, expect, it } from "vitest";
import { LEVELS, type TapLevel } from "./levels";
import {
  AI_DELAY_FLOOR,
  CASUAL_PLAY,
  ENDLESS_LIVES,
  FREEZE_FACTOR,
  FREEZE_ROUNDS,
  SEQ_GRACE_MS,
  SKILLED_PLAY,
  TRAP_READ_MS,
  adaptiveAiDelay,
  endlessAiDelay,
  endlessDotCount,
  endlessTrapChance,
  inCombo,
  isNewRecord,
  mechanicsOf,
  nextSequenceStep,
  pointsFor,
  sequenceGrace,
  sequenceLabels,
  simulateTapDuel
} from "./logic";

function level(patch: Partial<TapLevel> = {}): TapLevel {
  return { targetPoints: 12, aiDelayMs: 700, trapChance: 0, double: false, theme: 9, ...patch };
}

describe("红蓝点点 · 连击加成", () => {
  it("连抢够数才点着连击", () => {
    const cfg = level({ comboNeed: 3, comboScore: 2 });
    expect(inCombo(0, cfg)).toBe(false);
    expect(inCombo(2, cfg)).toBe(false);
    expect(inCombo(3, cfg)).toBe(true);
    // 没有连击设定的关永远不进连击
    expect(inCombo(99, level())).toBe(false);
  });

  it("连击状态下每一下都翻倍，连序列链也一起翻", () => {
    const cfg = level({ comboNeed: 3, comboScore: 2 });
    expect(pointsFor(0, 1, cfg)).toBe(1);
    expect(pointsFor(3, 1, cfg)).toBe(2);
    expect(pointsFor(4, 3, cfg)).toBe(6);
    expect(pointsFor(9, 1, level())).toBe(1);
  });
});

describe("红蓝点点 · 读招电脑", () => {
  it("你领先它出手更快，落后时它会稍稍放慢", () => {
    const cfg = level({ aiDelayMs: 800, aiAdapt: 0.3, targetPoints: 10 });
    expect(adaptiveAiDelay(cfg, 0, 0)).toBeCloseTo(800, 10);
    expect(adaptiveAiDelay(cfg, 8, 0)).toBeLessThan(800);
    expect(adaptiveAiDelay(cfg, 0, 8)).toBeGreaterThan(800);
  });

  it("再怎么读招也压不到人做不到的下限", () => {
    const cfg = level({ aiDelayMs: 800, aiAdapt: 0.9, targetPoints: 10 });
    expect(adaptiveAiDelay(cfg, 10, 0)).toBeCloseTo(800 * AI_DELAY_FLOOR, 6);
  });

  it("不带读招的关永远匀速出手", () => {
    expect(adaptiveAiDelay(level({ aiDelayMs: 640 }), 11, 0)).toBe(640);
  });
});

describe("红蓝点点 · 序列抢点", () => {
  it("号码从 1 开始按顺序排", () => {
    expect(sequenceLabels(3)).toEqual([1, 2, 3]);
    expect(sequenceLabels(0)).toEqual([]);
  });

  it("只有拍到下一个号码才算对，拍错返回 null", () => {
    expect(nextSequenceStep(0, 1, 3)).toBe(1);
    expect(nextSequenceStep(1, 2, 3)).toBe(2);
    expect(nextSequenceStep(1, 3, 3)).toBeNull();
    expect(nextSequenceStep(2, 3, 3)).toBe(3);
  });

  it("链越长给的宽限越多，两个号码就多给一档", () => {
    expect(sequenceGrace(1)).toBe(0);
    expect(sequenceGrace(2)).toBe(SEQ_GRACE_MS);
    expect(sequenceGrace(3)).toBe(SEQ_GRACE_MS * 2);
    expect(sequenceGrace(0)).toBe(0);
  });
});

describe("红蓝点点 · 道具点与陷阱", () => {
  it("会用 ❄️ 的孩子明显更轻松：同一关分差更好看", () => {
    const cfg = LEVELS[135];
    const withPower = simulateTapDuel(cfg, SKILLED_PLAY, 5);
    const without = simulateTapDuel(cfg, { ...SKILLED_PLAY, usePowers: false }, 5);
    expect(withPower.ai).toBeLessThanOrEqual(without.ai);
  });

  it("冻结是打慢不是打停，冻两轮就恢复", () => {
    expect(FREEZE_FACTOR).toBeGreaterThan(1);
    expect(FREEZE_ROUNDS).toBe(2);
    expect(TRAP_READ_MS).toBeGreaterThan(0);
  });

  it("认不出陷阱就会白送分：同一关分差立刻变难看", () => {
    const cfg = LEVELS[105];
    const careful = simulateTapDuel(cfg, SKILLED_PLAY, 3);
    const careless = simulateTapDuel(cfg, { ...SKILLED_PLAY, avoidTraps: false }, 3);
    expect(careless.ai).toBeGreaterThan(careful.ai);
  });
});

describe("红蓝点点 · 机制清单", () => {
  it("按关卡配置列出本关启用的新玩法", () => {
    expect(mechanicsOf(level())).toEqual([]);
    expect(mechanicsOf(level({ comboNeed: 3 }))).toEqual(["连击加成"]);
    expect(mechanicsOf(level({ comboNeed: 3, powerChance: 0.2, sequence: 2, aiAdapt: 0.1 }))).toEqual([
      "连击加成",
      "道具点",
      "序列抢点",
      "读招电脑"
    ]);
  });
});

describe("红蓝点点 · 无尽霓虹抢点", () => {
  it("小电脑一轮比一轮快，但压不到人反应不过来的地步", () => {
    expect(endlessAiDelay(0)).toBe(1250);
    expect(endlessAiDelay(10)).toBeLessThan(endlessAiDelay(0));
    expect(endlessAiDelay(9999)).toBe(430);
    expect(endlessAiDelay(Number.NaN)).toBe(1250);
    expect(endlessAiDelay(-5)).toBe(1250);
  });

  it("陷阱越来越多，封顶四成", () => {
    expect(endlessTrapChance(0)).toBeCloseTo(0.08, 10);
    expect(endlessTrapChance(10)).toBeGreaterThan(endlessTrapChance(0));
    expect(endlessTrapChance(9999)).toBe(0.4);
  });

  it("一次冒几个点分三档，最多三个", () => {
    expect(endlessDotCount(0)).toBe(1);
    expect(endlessDotCount(9)).toBe(1);
    expect(endlessDotCount(10)).toBe(2);
    expect(endlessDotCount(24)).toBe(3);
    expect(endlessDotCount(9999)).toBe(3);
  });

  it("三颗爱心，破纪录判定 0 分不算", () => {
    expect(ENDLESS_LIVES).toBe(3);
    expect(isNewRecord(31, 30)).toBe(true);
    expect(isNewRecord(30, 30)).toBe(false);
    expect(isNewRecord(0, 0)).toBe(false);
  });
});

describe("红蓝点点 · 无头对局模拟器本身可信", () => {
  it("同一关同一种子的结果完全一样（确定性）", () => {
    const a = simulateTapDuel(LEVELS[170], SKILLED_PLAY, 11);
    const b = simulateTapDuel(LEVELS[170], SKILLED_PLAY, 11);
    expect(a).toEqual(b);
  });

  it("反应时间拉到离谱就一定输，说明胜负真的取决于手速", () => {
    const r = simulateTapDuel(LEVELS[187], { ...CASUAL_PLAY, reactionMs: 3000 }, 1);
    expect(r.won).toBe(false);
    expect(r.ai).toBeGreaterThanOrEqual(LEVELS[187].targetPoints);
  });
});
