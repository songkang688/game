import { describe, expect, it } from "vitest";
import { assertTotal, totalSize } from "../level99";
import { indexOf, maxMines } from "./board";
import { generateNoGuess, isLogicallySolvable } from "./solver";
import {
  CHAPTERS,
  NO_GUESS_FROM,
  allLevels,
  chapterIndexOf,
  density,
  levelAt,
  levelSeed,
  loseLine,
  starsByTime,
  winLine
} from "./levels";

const LEVELS = allLevels();

describe("mine-garden · 188 关章节", () => {
  it("八章之和恒等于 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(CHAPTERS).toHaveLength(8);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每一章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(4);
    }
  });

  it("关号能落回正确的章节", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(95)).toBe(3);
    expect(chapterIndexOf(96)).toBe(4);
    expect(chapterIndexOf(187)).toBe(7);
  });

  it("越界关号会被夹回 0..187，不抛异常", () => {
    expect(levelAt(-5).index).toBe(0);
    expect(levelAt(999).index).toBe(187);
    expect(levelAt(3.7).index).toBe(3);
  });
});

describe("mine-garden · 关卡表体检", () => {
  it("188 关一关不多一关不少，序号连着", () => {
    expect(LEVELS).toHaveLength(188);
    LEVELS.forEach((lv, i) => expect(lv.index).toBe(i));
  });

  it("每一关的尺寸与刺种数都在能玩的范围里", () => {
    for (const lv of LEVELS) {
      expect(lv.w).toBeGreaterThanOrEqual(5);
      expect(lv.h).toBeGreaterThanOrEqual(5);
      expect(lv.w).toBeLessThanOrEqual(30);
      expect(lv.h).toBeLessThanOrEqual(16);
      expect(lv.mines).toBeGreaterThanOrEqual(2);
      // 留得下首点安全区，还得留几格空地给人下手
      expect(lv.mines).toBeLessThan(maxMines(lv.w, lv.h, indexOf(lv.w, 2, 2)));
      expect(density(lv)).toBeLessThan(0.25);
    }
  });

  it("规格里点名的三档尺寸都出现在关卡表里", () => {
    const has = (w: number, h: number, mines: number): boolean =>
      LEVELS.some((lv) => lv.w === w && lv.h === h && lv.mines === mines);
    expect(has(9, 9, 10), "初级 9×9 / 10").toBe(true);
    expect(has(16, 16, 40), "中级 16×16 / 40").toBe(true);
    expect(has(30, 16, 99), "高级 16×30 / 99").toBe(true);
    // 小苗床从 5×5 起步
    expect(LEVELS[0].w).toBe(5);
    expect(LEVELS[0].h).toBe(5);
  });

  it("难度整体是往上走的：格子数与刺种数都不倒退太多", () => {
    const heads = [0, 24, 48, 72, 96, 118, 140, 164].map((i) => LEVELS[i]);
    const cells = heads.map((lv) => lv.w * lv.h);
    expect(cells[0]).toBeLessThan(cells[3]);
    expect(cells[3]).toBeLessThanOrEqual(cells[6]);
    expect(LEVELS[187].w * LEVELS[187].h).toBeGreaterThan(LEVELS[0].w * LEVELS[0].h * 10);
  });

  it("三星时限永远比二星时限紧，两个都为正", () => {
    for (const lv of LEVELS) {
      expect(lv.starMs[0]).toBeGreaterThan(0);
      expect(lv.starMs[1]).toBeGreaterThan(lv.starMs[0]);
    }
  });

  it("限时关的倒计时一定比二星时限宽松（不逼孩子手忙脚乱）", () => {
    const timed = LEVELS.filter((lv) => typeof lv.timeLimitMs === "number");
    expect(timed.length).toBeGreaterThan(20);
    for (const lv of timed) expect(lv.timeLimitMs as number).toBeGreaterThan(lv.starMs[1] * 1.1);
  });
});

describe("mine-garden · 各章的新机制", () => {
  it("前两章有保护，第三章起没有", () => {
    for (const lv of LEVELS) expect(lv.protect).toBe(lv.chapterIndex <= 1);
  });

  it("第 3 章是和弦课，三星时限明显更紧", () => {
    const chord = LEVELS.filter((lv) => lv.chordCourse);
    expect(chord).toHaveLength(24);
    for (const lv of chord) expect(lv.chapterIndex).toBe(2);
    const perCell = (i: number): number => LEVELS[i].starMs[0] / (LEVELS[i].w * LEVELS[i].h);
    expect(perCell(48)).toBeLessThan(perCell(24) * 0.6);
  });

  it("第 5 章整章有雾，园丁杯里也轮到几关", () => {
    const fog = LEVELS.filter((lv) => lv.fog);
    for (let i = 96; i <= 117; i++) expect(LEVELS[i].fog).toBe(true);
    expect(fog.length).toBeGreaterThan(22);
    expect(fog.some((lv) => lv.chapterIndex === 7)).toBe(true);
  });

  it("第 6 章整章限时", () => {
    for (let i = 118; i <= 139; i++) expect(typeof LEVELS[i].timeLimitMs).toBe("number");
  });

  it("园丁杯有限旗关，上限就是刺种数（一颗都不许浪费）", () => {
    const limited = LEVELS.filter((lv) => typeof lv.flagLimit === "number");
    expect(limited.length).toBeGreaterThan(5);
    for (const lv of limited) {
      expect(lv.chapterIndex).toBe(7);
      expect(lv.flagLimit).toBe(lv.mines);
    }
  });

  it("第 7 章一路逼近 16×30 / 99", () => {
    expect(LEVELS[163].w).toBe(30);
    expect(LEVELS[163].h).toBe(16);
    expect(LEVELS[163].mines).toBe(99);
    expect(LEVELS[140].w * LEVELS[140].h).toBeLessThan(30 * 16);
  });
});

describe("mine-garden · 第 3 章起必须无猜", () => {
  it("无猜标记从第 49 关开始（前两章不标）", () => {
    expect(NO_GUESS_FROM).toBe(48);
    for (const lv of LEVELS) expect(lv.noGuess).toBe(lv.index >= 48);
  });

  it("抽样第 3–8 章：每一关都真能生成出「一路推到底」的图", () => {
    const sample = [48, 55, 60, 71, 72, 80, 95, 96, 105, 117, 118, 130, 139, 140, 150, 163, 164, 175, 187];
    for (const i of sample) {
      const lv = LEVELS[i];
      const first = indexOf(lv.w, Math.floor(lv.w / 2), Math.floor(lv.h / 2));
      const res = generateNoGuess(lv.w, lv.h, lv.mines, first, levelSeed(lv.index), { noGuess: lv.noGuess });
      expect(res.noGuess, `第 ${i + 1} 关没能生成无猜图`).toBe(true);
      expect(isLogicallySolvable({ w: lv.w, h: lv.h, mine: res.mine }, first)).toBe(true);
    }
  });

  it("换一批首点重来一次，第 3 章起照样全是无猜图", () => {
    for (const i of [48, 90, 120, 160, 186]) {
      const lv = LEVELS[i];
      for (const first of [0, indexOf(lv.w, lv.w - 1, 0), indexOf(lv.w, lv.w - 1, lv.h - 1)]) {
        const res = generateNoGuess(lv.w, lv.h, lv.mines, first, levelSeed(lv.index, 3), {
          noGuess: true
        });
        expect(res.noGuess, `第 ${i + 1} 关首点 ${first} 生成失败`).toBe(true);
      }
    }
  });

  it("同一关的种子是稳的，重开一次会换一张图", () => {
    expect(levelSeed(10)).toBe(levelSeed(10));
    expect(levelSeed(10)).not.toBe(levelSeed(11));
    expect(levelSeed(10, 1)).not.toBe(levelSeed(10, 0));
  });
});

describe("mine-garden · 评星与结算文案", () => {
  it("按时限评星：够快是三星，慢一点两星，再慢一星", () => {
    const limits = [30000, 60000] as const;
    expect(starsByTime(10000, limits)).toBe(3);
    expect(starsByTime(30000, limits)).toBe(3);
    expect(starsByTime(30001, limits)).toBe(2);
    expect(starsByTime(60000, limits)).toBe(2);
    expect(starsByTime(60001, limits)).toBe(1);
  });

  it("用过保护最多两星（三星留给一颗都没碰到的那一盘）", () => {
    const limits = [30000, 60000] as const;
    expect(starsByTime(1000, limits, true)).toBe(2);
    expect(starsByTime(90000, limits, true)).toBe(1);
  });

  it("结算文案只夸不批评，也不出现吓人的字眼", () => {
    const lv = LEVELS[0];
    const bad = ["地雷", "爆炸", "炸", "战", "死", "血"];
    const lines = [
      winLine(lv, 3, 12000),
      winLine(lv, 2, 40000),
      winLine(lv, 1, 90000),
      loseLine("hit"),
      loseLine("time")
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
      for (const w of bad) expect(line, `「${line}」里不该出现「${w}」`).not.toContain(w);
    }
    expect(winLine(lv, 3, 12000)).toContain("12.0");
  });
});
