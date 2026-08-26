import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { CHAPTERS, chapterIndexOf, endlessConfig, goalLine, levelConfig, starsFor } from "./levels";
import guide from "./guide";
import { meta } from "./meta";

describe("圆圆大作战 · 188 关切分", () => {
  it("十章之和恒等于 188", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "orb-arena")).toBe(true);
    expect(CHAPTERS.length).toBe(10);
  });

  it("每章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#/);
      expect(ch.desc.length).toBeGreaterThan(4);
    }
  });

  it("关号能对上章节", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(19)).toBe(0);
    expect(chapterIndexOf(20)).toBe(1);
    expect(chapterIndexOf(187)).toBe(9);
  });

  it("每一关都有能玩的配置,越往后越难", () => {
    const first = levelConfig(0);
    const last = levelConfig(187);
    expect(first.targetMass).toBeLessThan(last.targetMass);
    expect(first.bots).toBeLessThanOrEqual(last.bots);
    expect(last.bots).toBeLessThanOrEqual(11);
  });

  it("第 1 / 100 / 145 / 188 关都拿得到配置且参数合法", () => {
    for (const lv of [0, 99, 144, 187]) {
      const cfg = levelConfig(lv);
      expect(cfg.mapW).toBeGreaterThan(400);
      expect(cfg.targetMass).toBeGreaterThan(0);
      expect(cfg.bots).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(cfg.shrink)).toBe(true);
    }
  });

  it("越界关号被夹住,不会崩", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(9999).level).toBe(TOTAL_LEVELS - 1);
  });

  it("第 1 章没有刺球,后面才有", () => {
    expect(levelConfig(0).viruses).toBe(0);
    expect(levelConfig(25).viruses).toBeGreaterThan(0);
  });

  it("缩圈只在缩圈荒原与总决赛出现", () => {
    expect(levelConfig(0).shrink).toBe(0);
    expect(levelConfig(120).shrink).toBeGreaterThan(0);
    expect(levelConfig(180).shrink).toBeGreaterThan(0);
  });

  it("队友章与迷雾章的开关对得上", () => {
    expect(levelConfig(140).ally).toBe(true);
    expect(levelConfig(160).fog).toBe(true);
    expect(levelConfig(0).ally).toBe(false);
  });

  it("无尽一波比一波密", () => {
    expect(endlessConfig(1).pellets).toBeLessThan(endlessConfig(9).pellets);
    expect(endlessConfig(1).shrink).toBeLessThan(endlessConfig(9).shrink);
    expect(endlessConfig(99).bots).toBeLessThanOrEqual(11);
  });

  it("评星:没到目标只有一星,超额又快才三星", () => {
    expect(starsFor(50, 100, 30, 80)).toBe(1);
    expect(starsFor(150, 100, 20, 80)).toBe(3);
    expect(starsFor(112, 100, 70, 80)).toBe(2);
  });

  it("目标写成一句话,该提醒的都提醒", () => {
    const line = goalLine(levelConfig(120));
    expect(line).toContain("质量");
    expect(line).toContain("安全区");
    expect(goalLine(levelConfig(140))).toContain("队友");
  });
});

describe("圆圆大作战 · meta 与攻略", () => {
  it("meta 字段按规格落地", () => {
    expect(meta.id).toBe("orb-arena");
    expect(meta.title).toBe("圆圆大作战");
    expect(meta.category).toBe("action");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(meta.modes).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("攻略覆盖第 1 关到第 188 关,章节条数够", () => {
    expect(guide.gameId).toBe("orb-arena");
    expect(guide.entries.length).toBeGreaterThanOrEqual(8);
    expect(guide.entries[0].from).toBe(1);
    expect(Math.max(...guide.entries.map((e) => e.to))).toBe(188);
  });

  it("文案里没有商标,也没有死亡词", () => {
    const text = [meta.title, meta.blurb, guide.title, ...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("|");
    expect(text).not.toMatch(/球球大作战|贪吃蛇大作战|吃豆人|Tetris/i);
    expect(text).not.toMatch(/死|炸死|血/);
  });
});
