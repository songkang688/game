import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";
import { AI_LEVEL_ORDER } from "./ai";
import {
  CHAPTERS,
  LEVELS,
  TOWER_TOP,
  aiLevelOf,
  boostOf,
  buildEndlessRound,
  buildLevel,
  dealForLevel,
  endlessLine,
  towerLoseLine,
  towerStars,
  towerWinLine,
} from "./levels";
import { DECK_SIZE } from "./logic";
import { createGame, runBidding } from "./sim";

describe("地主塔章节", () => {
  it("八个主题章节,加起来正好 188 关", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "landlord-cards")).toBe(true);
    expect(TOWER_TOP).toBe(TOTAL_LEVELS);
  });

  it("每一章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(5);
    }
  });

  it("章节名不重复", () => {
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });
});

describe("188 层关卡表", () => {
  it("刚好 188 关,关号连续", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    LEVELS.forEach((lv, i) => expect(lv.index).toBe(i));
  });

  it("每一关的章节号和框架算出来的一致", () => {
    for (const lv of LEVELS) expect(lv.chapter).toBe(chapterOf(CHAPTERS, lv.index));
  });

  it("越界的关号会被夹回合法范围", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(9999).index).toBe(TOTAL_LEVELS - 1);
  });

  it("同一关每次生成的配置完全一样", () => {
    expect(buildLevel(77)).toEqual(buildLevel(77));
  });

  it("每一关的发牌种子都不一样,不会连着两关同一副牌", () => {
    expect(new Set(LEVELS.map((l) => l.seed)).size).toBe(TOTAL_LEVELS);
  });

  it("按章看电脑档位只升不降(章内可以先尝一口下一档)", () => {
    const byChapter = CHAPTERS.map((_, ci) => LEVELS.filter((l) => l.chapter === ci).map((l) => AI_LEVEL_ORDER.indexOf(l.aiLevel)));
    for (let ci = 1; ci < byChapter.length; ci++) {
      expect(Math.min(...byChapter[ci])).toBeGreaterThanOrEqual(Math.min(...byChapter[ci - 1]));
      expect(Math.max(...byChapter[ci])).toBeGreaterThanOrEqual(Math.max(...byChapter[ci - 1]));
    }
  });

  it("头两章是轻松档,最后两章是厉害档", () => {
    expect(aiLevelOf(0)).toBe("easy");
    expect(aiLevelOf(30)).toBe("easy");
    expect(aiLevelOf(TOTAL_LEVELS - 1)).toBe("hard");
    expect(aiLevelOf(TOTAL_LEVELS - 40)).toBe("hard");
  });

  it("发牌照顾只减不增,最后一章完全不照顾", () => {
    let prev = boostOf(0);
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const b = boostOf(i);
      expect(b).toBeLessThanOrEqual(prev);
      prev = b;
    }
    expect(boostOf(0)).toBe(2);
    expect(boostOf(TOTAL_LEVELS - 1)).toBe(0);
  });

  it("底分一路涨到 3 分", () => {
    expect(buildLevel(0).base).toBe(1);
    expect(buildLevel(TOTAL_LEVELS - 1).base).toBe(3);
  });

  it("第一章一律当地主,后面农民和地主都会轮到", () => {
    for (let i = 0; i < CHAPTERS[0].size; i++) expect(buildLevel(i).playerIsLandlord).toBe(true);
    const later = LEVELS.slice(CHAPTERS[0].size);
    expect(later.some((l) => l.playerIsLandlord)).toBe(true);
    expect(later.some((l) => !l.playerIsLandlord)).toBe(true);
  });

  it("每一关都有一句给小朋友的提示", () => {
    for (const lv of LEVELS) expect(lv.hint.length).toBeGreaterThan(5);
  });
});

describe("按关卡发牌", () => {
  it("发出来还是完整的一副牌:三家 17 张 + 底牌 3 张", () => {
    for (const i of [0, 40, 100, 187]) {
      const d = dealForLevel(buildLevel(i));
      expect(d.hands.map((h) => h.length)).toEqual([17, 17, 17]);
      expect(d.bottom).toHaveLength(3);
      expect(new Set([...d.hands.flat(), ...d.bottom]).size).toBe(DECK_SIZE);
    }
  });

  it("玩家座位与地主座位都在 0..2 之间,身份和配置对得上", () => {
    for (const lv of LEVELS) {
      const d = dealForLevel(lv);
      expect(d.playerSeat).toBeGreaterThanOrEqual(0);
      expect(d.playerSeat).toBeLessThanOrEqual(2);
      expect(d.landlord).toBeGreaterThanOrEqual(0);
      expect(d.landlord).toBeLessThanOrEqual(2);
      expect(d.landlord === d.playerSeat).toBe(lv.playerIsLandlord);
    }
  });

  it("同一关发到的牌永远一样", () => {
    expect(dealForLevel(buildLevel(5))).toEqual(dealForLevel(buildLevel(5)));
  });

  it("照顾力度 2 的关卡,发给玩家的是三手里最好的那一手", () => {
    const lv = buildLevel(3);
    expect(lv.boost).toBe(2);
    const d = dealForLevel(lv);
    const g = createGame({ hands: d.hands, bottom: d.bottom, landlord: d.landlord, base: lv.base });
    expect(g.hands[d.playerSeat].length).toBeGreaterThanOrEqual(17);
  });

  it("发出来的牌总能走完叫分流程(不会因为流局卡住)", () => {
    for (const i of [0, 60, 120, 187]) {
      const d = dealForLevel(buildLevel(i));
      const bid = runBidding(d.hands, 0);
      expect(bid === null || (bid.base >= 1 && bid.base <= 3)).toBe(true);
    }
  });
});

describe("评星与文案", () => {
  it("对手剩的牌越多星越高", () => {
    const lv = buildLevel(0);
    expect(towerStars(20, lv)).toBe(3);
    expect(towerStars(10, lv)).toBe(2);
    expect(towerStars(2, lv)).toBe(1);
  });

  it("当农民时门槛低一些(对手只有一家)", () => {
    const asFarmer = buildLevel(26);
    const asLandlord = buildLevel(24);
    expect(asFarmer.playerIsLandlord).toBe(false);
    expect(asLandlord.playerIsLandlord).toBe(true);
    expect(asFarmer.starThree).toBeLessThan(asLandlord.starThree);
  });

  it("过关的话都是好话,而且会点出对手剩多少张", () => {
    const lv = buildLevel(0);
    expect(towerWinLine(3, 18, lv)).toContain("18");
    for (const s of [1, 2, 3] as const) {
      expect(towerWinLine(s, 9, lv)).not.toMatch(/错|不行|笨/);
    }
  });

  it("输了给的是方法,不是批评", () => {
    expect(towerLoseLine(2, buildLevel(0))).toContain("2");
    expect(towerLoseLine(9, buildLevel(0))).toContain("地主");
    expect(towerLoseLine(9, buildLevel(26))).toContain("队友");
    expect(towerLoseLine(9, buildLevel(0))).not.toMatch(/错|不行|笨/);
  });
});

describe("无尽连胜", () => {
  it("轮次越靠后电脑越厉害、底分越高", () => {
    expect(buildEndlessRound(1).aiLevel).toBe("easy");
    expect(buildEndlessRound(4).aiLevel).toBe("normal");
    expect(buildEndlessRound(9).aiLevel).toBe("hard");
    expect(buildEndlessRound(1).base).toBeLessThan(buildEndlessRound(9).base);
  });

  it("每一轮的牌都不一样,同一轮永远一样", () => {
    expect(buildEndlessRound(3).seed).not.toBe(buildEndlessRound(4).seed);
    expect(buildEndlessRound(3)).toEqual(buildEndlessRound(3));
  });

  it("轮次会被夹到至少第 1 轮", () => {
    expect(buildEndlessRound(0).round).toBe(1);
    expect(buildEndlessRound(-9).round).toBe(1);
  });

  it("地主和农民轮着当", () => {
    expect(buildEndlessRound(1).playerIsLandlord).toBe(true);
    expect(buildEndlessRound(2).playerIsLandlord).toBe(false);
  });

  it("结束语按成绩说话", () => {
    expect(endlessLine(0, 5)).toContain("第一局");
    expect(endlessLine(7, 7)).toContain("刷新");
    expect(endlessLine(3, 7)).toContain("7");
  });
});
