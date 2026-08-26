import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";
import { CASUAL_PLAY, SKILLED_PLAY, mechanicsOf, simulateTapDuel } from "./logic";

/** 1.0 的前 99 关章节切分，硬编码在这里做回归：1.1 一个字都不许改 */
const LEGACY_CHAPTERS: Array<[string, number]> = [
  ["点点广场", 17],
  ["颜色为号", 17],
  ["星星石头", 17],
  ["闪电快拍", 16],
  ["双子挑战", 16],
  ["大师殿堂", 16]
];

/** 1.1 追加的四章：名字、emoji、关数 */
const NEW_CHAPTERS: Array<[string, string, number]> = [
  ["霓虹连击场", "💫", 23],
  ["机关道具局", "🧲", 22],
  ["序列谜阵", "🔢", 22],
  ["读心决赛", "🧠", 22]
];

/** 可解性校验用的几个固定种子：陷阱与道具的出现位置各不相同 */
const SEEDS = [1, 7, 23, 99, 404];

describe("红蓝点点 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188, "red-blue-tap")).toBe(true);
  });

  it("每关参数合法：小电脑再快也给孩子留出反应时间", () => {
    for (const lv of LEVELS) {
      expect(lv.targetPoints).toBeGreaterThanOrEqual(5);
      expect(lv.targetPoints).toBeLessThanOrEqual(26);
      expect(lv.aiDelayMs).toBeGreaterThanOrEqual(500);
      expect(lv.trapChance).toBeLessThanOrEqual(0.4);
    }
  });

  it("六章规则各不相同（并非同一模板）", () => {
    expect(LEVELS[5].trapChance).toBe(0);
    expect(LEVELS[25].trapChance).toBeGreaterThan(0);
    expect(LEVELS[45].trapChance).toBeGreaterThan(0);
    // 闪电快拍比点点广场快得多
    expect(LEVELS[60].aiDelayMs).toBeLessThan(LEVELS[10].aiDelayMs);
    // 双子挑战一次两个
    expect(LEVELS[75].double).toBe(true);
    expect(LEVELS[5].double).toBe(false);
    // 主题覆盖全部 10 章
    expect(new Set(LEVELS.map((l) => l.theme)).size).toBe(10);
  });

  it("章节内小电脑越来越快", () => {
    expect(LEVELS[16].aiDelayMs).toBeLessThan(LEVELS[0].aiDelayMs);
    expect(LEVELS[98].aiDelayMs).toBeLessThan(LEVELS[83].aiDelayMs);
  });
});

describe("红蓝点点 · 前 99 关回归（1.1 一个字不许动）", () => {
  it("前六章的名字与切分与 1.0 完全一致", () => {
    LEGACY_CHAPTERS.forEach(([name, size], ci) => {
      expect(CHAPTERS[ci].name).toBe(name);
      expect(CHAPTERS[ci].size).toBe(size);
    });
    expect(LEGACY_CHAPTERS.reduce((s, [, n]) => s + n, 0)).toBe(99);
  });

  it("前 99 关的生成参数与 1.0 逐关一致（抽样锚点）", () => {
    expect(LEVELS[0]).toEqual({ targetPoints: 5, aiDelayMs: 1400, trapChance: 0, double: false, theme: 0 });
    expect(LEVELS[17]).toEqual({ targetPoints: 6, aiDelayMs: 1350, trapChance: 0.3, double: false, theme: 1 });
    expect(LEVELS[34].theme).toBe(2);
    expect(LEVELS[51].theme).toBe(3);
    expect(LEVELS[67].double).toBe(true);
    expect(LEVELS[98]).toEqual({
      targetPoints: 8 + Math.floor(15 / 3),
      aiDelayMs: 950 - 15 * 18,
      trapChance: 0.25,
      double: true,
      theme: 5
    });
  });

  it("前 99 关一个新机制都没混进去（连击 / 道具 / 序列 / 读招）", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].comboNeed).toBeUndefined();
      expect(LEVELS[i].powerChance).toBeUndefined();
      expect(LEVELS[i].sequence).toBeUndefined();
      expect(LEVELS[i].aiAdapt).toBeUndefined();
      expect(mechanicsOf(LEVELS[i])).toEqual([]);
    }
  });
});

describe("红蓝点点 · 1.1 新增的四章与新机制", () => {
  it("追加了 89 关、四个全新章节，名字与关数对得上", () => {
    expect(totalSize(CHAPTERS) - 99).toBe(89);
    expect(CHAPTERS).toHaveLength(10);
    NEW_CHAPTERS.forEach(([name, emoji, size], i) => {
      const ch = CHAPTERS[6 + i];
      expect(ch.name).toBe(name);
      expect(ch.emoji).toBe(emoji);
      expect(ch.size).toBe(size);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
    });
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(10);
    expect(new Set(CHAPTERS.map((c) => c.color)).size).toBe(10);
  });

  it("霓虹连击场整章有连击加成，目标分也比 1.0 高一截", () => {
    for (let i = 99; i < 122; i++) {
      expect(LEVELS[i].theme).toBe(6);
      expect(LEVELS[i].comboNeed).toBe(3);
      expect(LEVELS[i].comboScore).toBe(2);
      expect(LEVELS[i].targetPoints).toBeGreaterThanOrEqual(12);
    }
    expect(LEVELS[121].aiDelayMs).toBeLessThan(LEVELS[99].aiDelayMs);
  });

  it("机关道具局整章会冒道具点，出现率一关比一关高", () => {
    for (let i = 122; i < 144; i++) {
      expect(LEVELS[i].theme).toBe(7);
      expect(LEVELS[i].powerChance ?? 0).toBeGreaterThan(0.2);
      expect(LEVELS[i].powerChance ?? 0).toBeLessThan(0.5);
    }
    expect(LEVELS[143].powerChance!).toBeGreaterThan(LEVELS[122].powerChance!);
  });

  it("序列谜阵整章要按号码顺序拍，链长从 2 涨到 3", () => {
    for (let i = 144; i < 166; i++) {
      expect(LEVELS[i].theme).toBe(8);
      expect(LEVELS[i].sequence ?? 0).toBeGreaterThanOrEqual(2);
      // 号码点没有陷阱，难在顺序不在眼力
      expect(LEVELS[i].trapChance).toBe(0);
    }
    expect(LEVELS[144].sequence).toBe(2);
    expect(LEVELS[165].sequence).toBe(3);
  });

  it("读心决赛整章是读招电脑，还把前面的规则都轮了一遍", () => {
    let seqRounds = 0;
    let doubles = 0;
    for (let i = 166; i < 188; i++) {
      expect(LEVELS[i].theme).toBe(9);
      expect(LEVELS[i].aiAdapt ?? 0).toBeGreaterThan(0);
      expect(LEVELS[i].powerChance ?? 0).toBeGreaterThan(0);
      expect(LEVELS[i].comboNeed).toBe(4);
      if (LEVELS[i].sequence) seqRounds++;
      if (LEVELS[i].double) doubles++;
    }
    expect(seqRounds).toBeGreaterThan(0);
    expect(doubles).toBeGreaterThan(0);
    expect(LEVELS[187].aiAdapt!).toBeGreaterThan(LEVELS[166].aiAdapt!);
    expect(LEVELS[187].aiAdapt!).toBeLessThanOrEqual(1);
  });

  it("四章各自带来一个前 99 关没有的新机制", () => {
    expect(mechanicsOf(LEVELS[100])).toContain("连击加成");
    expect(mechanicsOf(LEVELS[130])).toContain("道具点");
    expect(mechanicsOf(LEVELS[150])).toContain("序列抢点");
    expect(mechanicsOf(LEVELS[180])).toContain("读招电脑");
  });

  it("第 100–188 关逐关可通关：反应稳、认得陷阱、会用道具就赢得下来", () => {
    const lost: Array<[number, number]> = [];
    for (let i = 99; i < LEVELS.length; i++) {
      for (const seed of SEEDS) {
        const r = simulateTapDuel(LEVELS[i], SKILLED_PLAY, seed);
        if (!r.won) lost.push([i + 1, seed]);
      }
    }
    expect(lost).toEqual([]);
  });

  it("第 100–188 关确实更难：反应慢又不看陷阱，一关都赢不了", () => {
    const won: Array<[number, number]> = [];
    for (let i = 99; i < LEVELS.length; i++) {
      for (const seed of SEEDS) {
        if (simulateTapDuel(LEVELS[i], CASUAL_PLAY, seed).won) won.push([i + 1, seed]);
      }
    }
    expect(won).toEqual([]);
  });

  it("第 100–188 关一局的回合数是有限的，不会没完没了", () => {
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateTapDuel(LEVELS[i], SKILLED_PLAY, 1);
      expect(r.rounds).toBeGreaterThan(2);
      expect(r.rounds).toBeLessThan(80);
      expect(r.me).toBeGreaterThanOrEqual(LEVELS[i].targetPoints);
    }
  });

  it("前 99 关的难度没有被新章顺手改掉：同样的手速照样全赢", () => {
    const lost: number[] = [];
    for (let i = 0; i < 99; i++) {
      if (!simulateTapDuel(LEVELS[i], SKILLED_PLAY, 1).won) lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });
});
