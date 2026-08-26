import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";
import { CASUAL_PLAY, SKILLED_PLAY, mechanicsOf, simulateTug } from "./logic";

/** 1.0 的前 99 关章节切分，硬编码在这里做回归：1.1 一个字都不许改 */
const LEGACY_CHAPTERS: Array<[string, number]> = [
  ["草地拔河", 17],
  ["加油星", 17],
  ["红灯绿灯", 17],
  ["节奏鼓点", 16],
  ["大力士挑战", 16],
  ["冠军之路", 16]
];

/** 1.1 追加的四章：名字、emoji、关数 */
const NEW_CHAPTERS: Array<[string, string, number]> = [
  ["沙丘角力", "🏜️", 23],
  ["补给争夺", "🧤", 22],
  ["齐心号子", "📣", 22],
  ["巅峰绳王", "🥇", 22]
];

describe("红蓝拔河 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188, "red-blue-tug")).toBe(true);
  });

  it("每关参数合法：孩子每秒点 5 下就能拉得动", () => {
    for (const lv of LEVELS) {
      expect(lv.aiRate).toBeGreaterThan(3);
      // 每秒 5 次点击的拉力要能超过小电脑
      expect(lv.pullPower * 5).toBeGreaterThan(lv.aiRate * 0.8);
      expect(lv.pullPower).toBeGreaterThan(0);
    }
  });

  it("六章机关各不相同（并非同一模板）", () => {
    expect(LEVELS[5].star || LEVELS[5].redlight || LEVELS[5].rhythm).toBe(false);
    expect(LEVELS[25].star).toBe(true);
    expect(LEVELS[45].redlight).toBe(true);
    expect(LEVELS[60].rhythm).toBe(true);
    expect(LEVELS[75].star).toBe(true);
    expect(LEVELS[75].aiRate).toBeGreaterThan(LEVELS[25].aiRate);
    const last = LEVELS[95];
    expect(last.star && last.redlight).toBe(true);
  });

  it("章节内小电脑力气递增", () => {
    expect(LEVELS[0].aiRate).toBeLessThan(LEVELS[16].aiRate);
    expect(LEVELS[83].aiRate).toBeLessThan(LEVELS[98].aiRate);
  });
});

describe("红蓝拔河 · 前 99 关回归（1.1 一个字不许动）", () => {
  it("前六章的名字与切分与 1.0 完全一致", () => {
    LEGACY_CHAPTERS.forEach(([name, size], ci) => {
      expect(CHAPTERS[ci].name).toBe(name);
      expect(CHAPTERS[ci].size).toBe(size);
    });
    expect(LEGACY_CHAPTERS.reduce((s, [, n]) => s + n, 0)).toBe(99);
  });

  it("前 99 关的生成参数与 1.0 逐关一致（抽样锚点）", () => {
    expect(LEVELS[0]).toEqual({ aiRate: 5, pullPower: 2.6, star: false, redlight: false, rhythm: false, theme: 0 });
    expect(LEVELS[17]).toEqual({ aiRate: 6.5, pullPower: 2.5, star: true, redlight: false, rhythm: false, theme: 1 });
    expect(LEVELS[34]).toEqual({ aiRate: 4.8, pullPower: 2.6, star: false, redlight: true, rhythm: false, theme: 2 });
    expect(LEVELS[51]).toEqual({ aiRate: 6, pullPower: 3.0, star: false, redlight: false, rhythm: true, theme: 3 });
    expect(LEVELS[67]).toEqual({ aiRate: 7.5, pullPower: 2.8, star: true, redlight: false, rhythm: false, theme: 4 });
    expect(LEVELS[98]).toEqual({
      aiRate: 6 + 15 * 0.25,
      pullPower: 2.8,
      star: true,
      redlight: true,
      rhythm: true,
      theme: 5
    });
  });

  it("前 99 关一个新机制都没混进去（体力 / 补给 / 号子 / 读招）", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].stamina).toBeUndefined();
      expect(LEVELS[i].supply).toBeUndefined();
      expect(LEVELS[i].chantMs).toBeUndefined();
      expect(LEVELS[i].aiAdapt).toBeUndefined();
      expect(mechanicsOf(LEVELS[i])).toEqual([]);
    }
  });
});

describe("红蓝拔河 · 1.1 新增的四章与新机制", () => {
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

  it("沙丘角力整章启用体力条，越往后越吃紧", () => {
    for (let i = 99; i < 122; i++) {
      expect(LEVELS[i].theme).toBe(6);
      expect(LEVELS[i].stamina ?? 0).toBeGreaterThan(0);
      expect(LEVELS[i].staminaRegen ?? 0).toBeGreaterThan(0);
    }
    expect(LEVELS[121].stamina!).toBeLessThan(LEVELS[99].stamina!);
    expect(LEVELS[121].staminaRegen!).toBeLessThan(LEVELS[99].staminaRegen!);
  });

  it("补给争夺整章会掉补给，小电脑也一关比一关有劲", () => {
    for (let i = 122; i < 144; i++) {
      expect(LEVELS[i].theme).toBe(7);
      expect(LEVELS[i].supply).toBe(true);
      expect(LEVELS[i].star).toBe(true);
    }
    expect(LEVELS[143].aiRate).toBeGreaterThan(LEVELS[122].aiRate);
  });

  it("齐心号子整章有号子，号子越来越急、齐心值越攒越多", () => {
    for (let i = 144; i < 166; i++) {
      expect(LEVELS[i].theme).toBe(8);
      expect(LEVELS[i].chantMs ?? 0).toBeGreaterThan(150);
      expect(LEVELS[i].chantMax ?? 0).toBeGreaterThan(0);
    }
    expect(LEVELS[165].chantMs!).toBeLessThan(LEVELS[144].chantMs!);
    expect(LEVELS[165].chantMax!).toBeGreaterThan(LEVELS[144].chantMax!);
  });

  it("巅峰绳王整章是读招电脑，还把新老机关都混在一起", () => {
    let lights = 0;
    let chants = 0;
    let rhythms = 0;
    for (let i = 166; i < 188; i++) {
      expect(LEVELS[i].theme).toBe(9);
      expect(LEVELS[i].aiAdapt ?? 0).toBeGreaterThan(0);
      expect(LEVELS[i].supply).toBe(true);
      expect(LEVELS[i].stamina ?? 0).toBeGreaterThan(0);
      if (LEVELS[i].redlight) lights++;
      if (LEVELS[i].chantMs) chants++;
      if (LEVELS[i].rhythm) rhythms++;
    }
    expect(lights).toBeGreaterThan(0);
    expect(chants).toBeGreaterThan(0);
    expect(rhythms).toBeGreaterThan(0);
    expect(LEVELS[187].aiAdapt!).toBeGreaterThan(LEVELS[166].aiAdapt!);
    expect(LEVELS[187].aiAdapt!).toBeLessThanOrEqual(1);
  });

  it("四章各自带来一个前 99 关没有的新机制", () => {
    expect(mechanicsOf(LEVELS[100])).toContain("体力条");
    expect(mechanicsOf(LEVELS[130])).toContain("补给争夺");
    expect(mechanicsOf(LEVELS[150])).toContain("号子连击");
    expect(mechanicsOf(LEVELS[180])).toContain("读招电脑");
  });

  it("第 100–188 关逐关可通关：手稳、看灯、抢补给、踩号子、会换气就拔得赢", () => {
    const lost: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      if (!simulateTug(LEVELS[i], SKILLED_PLAY).won) lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });

  it("第 100–188 关确实更难：闷头狂点一关都拔不赢", () => {
    const won: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      if (simulateTug(LEVELS[i], CASUAL_PLAY).won) won.push(i + 1);
    }
    expect(won).toEqual([]);
  });

  it("第 100–188 关一局的长度是孩子能扛住的：几秒到半分钟出结果", () => {
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateTug(LEVELS[i], SKILLED_PLAY);
      expect(r.seconds).toBeGreaterThan(5);
      expect(r.seconds).toBeLessThan(35);
    }
  });

  it("前 99 关的难度没有被新章顺手改掉：同样的手法照样全赢", () => {
    const lost: number[] = [];
    for (let i = 0; i < 99; i++) {
      if (!simulateTug(LEVELS[i], SKILLED_PLAY).won) lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });
});
