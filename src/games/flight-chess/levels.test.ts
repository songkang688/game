import { describe, expect, it } from "vitest";
import { assertTotal, chapterOf, totalSize } from "../level99";
import { GOAL, PLANES_PER_COLOR } from "./board";
import { IMPROVED_RULES } from "./dice";
import {
  CHAPTERS,
  GOAL_LABELS,
  achievementOf,
  chapterCheck,
  duoConfig,
  endlessConfig,
  goalLine,
  levelConfig,
  rulesLine,
  runLine,
  solveLevel,
  starsFor,
  versusConfig
} from "./levels";

describe("188 关的章节切分", () => {
  it("八章之和恒等于 188", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(chapterCheck()).toBe(true);
  });

  it("每章的关数与规格表一致", () => {
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
    expect(CHAPTERS.map((c) => c.name)).toEqual([
      "起飞跑道",
      "跳格子",
      "航线飞",
      "撞机演练",
      "叠机堡垒",
      "通道折返",
      "改进规则",
      "四人决赛"
    ]);
  });

  it("每章都有表情、粉彩色和一句说明", () => {
    for (const ch of CHAPTERS) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
    }
  });
});

describe("关卡配置", () => {
  it("同一关每次读出来都一模一样（骰序固定）", () => {
    for (const level of [0, 37, 99, 140, 187]) {
      const a = levelConfig(level);
      const b = levelConfig(level);
      expect(a.dice).toEqual(b.dice);
      expect(a.setup).toEqual(b.setup);
      expect(a.goal).toEqual(b.goal);
    }
  });

  it("关号越界也不会崩，夹到 1..188 之间", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(999).level).toBe(187);
    expect(levelConfig(3.7).level).toBe(3);
  });

  it("每一关都有正数目标、非空骰序，初始局面每色 4 架", () => {
    for (let i = 0; i < 188; i++) {
      const cfg = levelConfig(i);
      expect(cfg.goal.need, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(1);
      expect(cfg.dice.length, `第 ${i + 1} 关`).toBeGreaterThan(3);
      expect(cfg.dice.every((d) => d >= 1 && d <= 6)).toBe(true);
      for (const row of cfg.setup) {
        expect(row).toHaveLength(PLANES_PER_COLOR);
        for (const p of row) {
          expect(p).toBeGreaterThanOrEqual(-1);
          expect(p).toBeLessThanOrEqual(GOAL);
        }
      }
      expect(cfg.seats[0]).toBe(cfg.player);
    }
  });

  it("章节主题对得上:改进规则章开 5/6 起飞，决赛章是四人同场地狱 AI", () => {
    const ch7 = levelConfig(140);
    expect(ch7.chapter).toBe(6);
    expect(ch7.rules.takeOff).toEqual(IMPROVED_RULES.takeOff);
    expect(ch7.rules.punishThreeSixes).toBe(true);

    const ch8 = levelConfig(187);
    expect(ch8.chapter).toBe(7);
    expect(ch8.multi).toBe(true);
    expect(ch8.seats).toEqual([0, 1, 2, 3]);
    expect(ch8.tiers[1]).toBe("hell");
    expect(ch8.rounds).toBeGreaterThan(10);
  });

  it("前三章的主题目标就是起飞 / 跳格 / 航线飞", () => {
    expect(["takeoff", "progress"]).toContain(levelConfig(0).goal.kind);
    expect(["jump", "progress"]).toContain(levelConfig(30).goal.kind);
    expect(["fly", "progress"]).toContain(levelConfig(55).goal.kind);
    expect(["capture", "progress"]).toContain(levelConfig(80).goal.kind);
  });
});

describe("188 关逐关可解", () => {
  it("参考走法把每一关都打到达标", () => {
    const bad: string[] = [];
    for (let i = 0; i < 188; i++) {
      const cfg = levelConfig(i);
      const run = solveLevel(i);
      if (!run.win) bad.push(`第 ${i + 1} 关（${cfg.goal.kind} × ${cfg.goal.need}）`);
      if (achievementOf(run.state, cfg.goal.kind, cfg.player) < cfg.goal.need) {
        bad.push(`第 ${i + 1} 关成绩没到线`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("参考步数是评星基准，且不超过骰序长度", () => {
    for (let i = 0; i < 188; i += 7) {
      const cfg = levelConfig(i);
      expect(cfg.refRolls).toBeGreaterThan(0);
      expect(cfg.refRolls).toBeLessThanOrEqual(cfg.dice.length);
      expect(starsFor(cfg, cfg.refRolls)).toBe(3);
      expect(starsFor(cfg, cfg.refRolls + 2)).toBe(2);
      expect(starsFor(cfg, cfg.refRolls + 9)).toBe(1);
    }
  });

  it("目标定得不虚:参考走法真的用掉了掷骰，不是开局就白送", () => {
    let moved = 0;
    for (let i = 0; i < 188; i++) {
      if (levelConfig(i).refRolls >= 1) moved++;
    }
    expect(moved).toBe(188);
  });

  it("回放的每一手都在合法范围里", () => {
    for (const level of [0, 25, 60, 95, 120, 150, 187]) {
      const run = solveLevel(level);
      for (const step of run.steps) {
        expect(step.dice).toBeGreaterThanOrEqual(1);
        expect(step.dice).toBeLessThanOrEqual(6);
        if (step.planeIdx !== null) {
          expect(step.planeIdx).toBeGreaterThanOrEqual(0);
          expect(step.planeIdx).toBeLessThan(PLANES_PER_COLOR);
        }
      }
    }
  });

  it("骰序用光还没达标就算这一关没过（不会假装赢）", () => {
    const cfg = { ...levelConfig(0), goal: { kind: "takeoff" as const, need: 99 } };
    const run = runLine(cfg, 99);
    expect(run.win).toBe(false);
    expect(run.achieved).toBeLessThan(99);
  });
});

describe("目标与规则的中文说明", () => {
  it("每一种目标都有中文名，说明句子读得懂", () => {
    for (const kind of Object.keys(GOAL_LABELS)) {
      expect(GOAL_LABELS[kind as keyof typeof GOAL_LABELS].length).toBeGreaterThan(1);
    }
    for (const level of [0, 40, 90, 187]) {
      const cfg = levelConfig(level);
      const line = goalLine(cfg);
      expect(line).not.toContain("undefined");
      expect(line).toContain(String(cfg.goal.need));
      expect(rulesLine(cfg)).toContain("起飞");
    }
  });

  it("章节归属和 level99 的算法一致", () => {
    for (let i = 0; i < 188; i++) {
      expect(levelConfig(i).chapter).toBe(chapterOf(CHAPTERS, i));
    }
  });
});

describe("对战 / 双人 / 无尽的配置", () => {
  it("对战是四人同场，缺人用 AI 补", () => {
    const cfg = versusConfig("pro");
    expect(cfg.seats).toEqual([0, 1, 2, 3]);
    expect(cfg.tiers[1]).toBe("pro");
    expect(cfg.tiers[3]).toBe("pro");
  });

  it("双人:鸭梨与康康各一色，另外两色交给电脑", () => {
    const cfg = duoConfig();
    expect(cfg.seats).toEqual([0, 1, 2, 3]);
    expect(cfg.tiers[0]).toBeUndefined();
    expect(cfg.tiers[1]).toBeUndefined();
    expect(cfg.tiers[2]).toBe("normal");
    expect(cfg.tiers[3]).toBe("normal");
  });

  it("无尽:连胜越多对手越强，到后面还会换成改进规则", () => {
    expect(endlessConfig(0).tier).toBe("rookie");
    expect(endlessConfig(1).tier).toBe("normal");
    expect(endlessConfig(3).tier).toBe("pro");
    expect(endlessConfig(9).tier).toBe("hell");
    expect(endlessConfig(0).rules.takeOff).toEqual([6]);
    expect(endlessConfig(5).rules.takeOff).toEqual([5, 6]);
  });
});
