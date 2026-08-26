import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { CHAPTERS, LEVELS, TRACK_LEN } from "./levels";
import { CASUAL_PLAY, SKILLED_PLAY, mechanicsOf, simulateRace } from "./logic";

/** 1.0 的前 99 关章节切分，硬编码在这里做回归：1.1 一个字都不许改 */
const LEGACY_CHAPTERS: Array<[string, number]> = [
  ["操场直道", 17],
  ["水坑赛道", 17],
  ["跨栏赛场", 17],
  ["上坡森林", 16],
  ["夜跑霓虹", 16],
  ["冠军巡回", 16]
];

/** 1.1 追加的四章：名字、emoji、关数 */
const NEW_CHAPTERS: Array<[string, string, number]> = [
  ["云顶接力", "☁️", 23],
  ["拾光集市", "🎁", 22],
  ["节拍风廊", "🎵", 22],
  ["决胜星轨", "🌠", 22]
];

describe("红蓝赛跑 188 关", () => {
  it("恰好 188 关，至少 6 个主题章节", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188, "red-blue-race")).toBe(true);
  });

  it("每关参数合法、机关在赛道内", () => {
    for (const lv of LEVELS) {
      expect(lv.aiSpeed).toBeGreaterThan(5);
      expect(lv.aiSpeed).toBeLessThan(20);
      expect(lv.tapStep).toBeGreaterThan(0);
      for (const ob of lv.obstacles) {
        expect(ob.pos).toBeGreaterThanOrEqual(10);
        expect(ob.pos + ob.len).toBeLessThanOrEqual(TRACK_LEN);
      }
      // 机关之间不重叠
      const sorted = [...lv.obstacles].sort((a, b) => a.pos - b.pos);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].pos).toBeGreaterThanOrEqual(sorted[i - 1].pos + 4);
      }
    }
  });

  it("六章赛道机关各不相同（并非同一模板）", () => {
    const typesAt = (i: number) => new Set(LEVELS[i].obstacles.map((o) => o.type));
    expect(LEVELS[5].obstacles).toHaveLength(0);
    expect(typesAt(25).has("puddle")).toBe(true);
    expect(typesAt(45).has("hurdle")).toBe(true);
    expect(typesAt(60).has("hill")).toBe(true);
    expect(typesAt(75).has("star")).toBe(true);
    // 冠军巡回混合多种机关
    expect(typesAt(95).size).toBeGreaterThanOrEqual(3);
  });

  it("电脑速度随章节递增", () => {
    expect(LEVELS[0].aiSpeed).toBeLessThan(LEVELS[16].aiSpeed);
    expect(LEVELS[0].aiSpeed).toBeLessThan(LEVELS[98].aiSpeed);
  });
});

describe("红蓝赛跑 · 前 99 关回归（1.1 一个字不许动）", () => {
  it("前六章的名字与切分与 1.0 完全一致", () => {
    LEGACY_CHAPTERS.forEach(([name, size], ci) => {
      expect(CHAPTERS[ci].name).toBe(name);
      expect(CHAPTERS[ci].size).toBe(size);
    });
    expect(LEGACY_CHAPTERS.reduce((s, [, n]) => s + n, 0)).toBe(99);
  });

  it("前 99 关的生成参数与 1.0 逐关一致（抽样锚点）", () => {
    expect(LEVELS[0]).toEqual({ aiSpeed: 6.2, tapStep: 1.6, obstacles: [], theme: 0 });
    expect(LEVELS[16].aiSpeed).toBeCloseTo(6.2 + 16 * 0.09, 10);
    expect(LEVELS[17].theme).toBe(1);
    expect(LEVELS[34].theme).toBe(2);
    expect(LEVELS[51].theme).toBe(3);
    expect(LEVELS[67].theme).toBe(4);
    expect(LEVELS[83].theme).toBe(5);
    expect(LEVELS[98].aiSpeed).toBeCloseTo(7.2 + 15 * 0.12, 10);
    expect(LEVELS[98].tapStep).toBe(1.6);
  });

  it("前 99 关一个新机制都没混进去（体力 / 节拍 / 读招 / 礼物箱）", () => {
    for (let i = 0; i < 99; i++) {
      expect(LEVELS[i].stamina).toBeUndefined();
      expect(LEVELS[i].beatMs).toBeUndefined();
      expect(LEVELS[i].aiAdapt).toBeUndefined();
      expect(LEVELS[i].obstacles.some((o) => o.type === "item")).toBe(false);
    }
  });
});

describe("红蓝赛跑 · 1.1 新增的四章与新机制", () => {
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
  });

  it("新章名字与颜色都不与前六章重复", () => {
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.color)).size).toBe(CHAPTERS.length);
  });

  it("云顶接力整章启用体力条，而且体力越往后越吃紧", () => {
    for (let i = 99; i < 122; i++) {
      expect(LEVELS[i].theme).toBe(6);
      expect(LEVELS[i].stamina ?? 0).toBeGreaterThan(0);
      expect(LEVELS[i].staminaRegen ?? 0).toBeGreaterThan(0);
    }
    expect(LEVELS[121].stamina!).toBeLessThan(LEVELS[99].stamina!);
    expect(LEVELS[121].staminaRegen!).toBeLessThan(LEVELS[99].staminaRegen!);
  });

  it("拾光集市每关都有可抢的礼物箱", () => {
    for (let i = 122; i < 144; i++) {
      expect(LEVELS[i].theme).toBe(7);
      expect(LEVELS[i].obstacles.some((o) => o.type === "item")).toBe(true);
    }
  });

  it("节拍风廊整章有鼓点，鼓点越来越快、连击上限越来越高", () => {
    for (let i = 144; i < 166; i++) {
      expect(LEVELS[i].theme).toBe(8);
      expect(LEVELS[i].beatMs ?? 0).toBeGreaterThan(150);
      expect(LEVELS[i].comboMax ?? 0).toBeGreaterThan(0);
    }
    expect(LEVELS[165].beatMs!).toBeLessThan(LEVELS[144].beatMs!);
    expect(LEVELS[165].comboMax!).toBeGreaterThan(LEVELS[144].comboMax!);
  });

  it("决胜星轨整章是读招电脑，还把五种机关都摆上了", () => {
    const kinds = new Set<string>();
    for (let i = 166; i < 188; i++) {
      expect(LEVELS[i].theme).toBe(9);
      expect(LEVELS[i].aiAdapt ?? 0).toBeGreaterThan(0);
      for (const ob of LEVELS[i].obstacles) kinds.add(ob.type);
    }
    expect(kinds).toEqual(new Set(["puddle", "hurdle", "hill", "star", "item"]));
    expect(LEVELS[187].aiAdapt!).toBeGreaterThan(LEVELS[166].aiAdapt!);
    expect(LEVELS[187].aiAdapt!).toBeLessThanOrEqual(1);
  });

  it("四章各自带来一个前 99 关没有的新机制", () => {
    expect(mechanicsOf(LEVELS[100])).toContain("体力条");
    expect(mechanicsOf(LEVELS[130])).toContain("道具抢夺");
    expect(mechanicsOf(LEVELS[150])).toContain("节拍连击");
    expect(mechanicsOf(LEVELS[180])).toContain("读招电脑");
    for (let i = 0; i < 99; i++) expect(mechanicsOf(LEVELS[i])).toEqual([]);
  });

  it("第 100–188 关逐关可通关：稳手速 + 会跳 + 踩点 + 换气都赢得下来", () => {
    const lost: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateRace(LEVELS[i], SKILLED_PLAY);
      if (!r.won || !Number.isFinite(r.meTime)) lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });

  it("第 100–188 关确实更难：随手乱点一关都赢不了", () => {
    const won: number[] = [];
    for (let i = 99; i < LEVELS.length; i++) {
      if (simulateRace(LEVELS[i], CASUAL_PLAY).won) won.push(i + 1);
    }
    expect(won).toEqual([]);
  });

  it("第 100–188 关都是真比赛，不是白送：小电脑至少跑到大半程", () => {
    for (let i = 99; i < LEVELS.length; i++) {
      const r = simulateRace(LEVELS[i], SKILLED_PLAY);
      expect(r.aiPos).toBeGreaterThan(55);
      // 冲线时间控制在一局一分钟以内，孩子不会跑到手酸
      expect(r.meTime).toBeLessThan(30);
    }
  });

  it("前 99 关的难度没有被新章顺手改掉：同样的手速照样全赢", () => {
    const lost: number[] = [];
    for (let i = 0; i < 99; i++) {
      if (!simulateRace(LEVELS[i], SKILLED_PLAY).won) lost.push(i + 1);
    }
    expect(lost).toEqual([]);
  });
});
