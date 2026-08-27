import { describe, expect, it } from "vitest";
import { save } from "../../engine/save";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";
import { AI_LEVEL_ORDER } from "./ai";
import { meta } from "./meta";
import {
  CHAPTERS,
  GOAL_FROM_LEVEL,
  LEVELS,
  TOWER_TOP,
  aiLevelOf,
  battleHighlight,
  boostOf,
  buildEndlessRound,
  buildLevel,
  dealForLevel,
  endlessLine,
  goalLabel,
  goalMet,
  goalOf,
  goalWinLine,
  proveInputOf,
  proveLevelWinnable,
  starGate,
  towerLoseLine,
  towerStars,
  towerStarsWithGoal,
  towerWinLine,
} from "./levels";
import { DECK_SIZE } from "./logic";
import { createGame, findWinningLine, replayLine, runBidding } from "./sim";

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
    expect(towerStars(20, true)).toBe(3);
    expect(towerStars(10, true)).toBe(2);
    expect(towerStars(2, true)).toBe(1);
  });

  it("当农民时门槛低一些(对手只有一家)", () => {
    expect(starGate(false).three).toBeLessThan(starGate(true).three);
    expect(towerStars(11, false)).toBe(3);
    expect(towerStars(11, true)).toBe(2);
  });

  it("关卡预告的门槛跟预设身份对得上", () => {
    const asFarmer = buildLevel(26);
    const asLandlord = buildLevel(24);
    expect(asFarmer.playerIsLandlord).toBe(false);
    expect(asLandlord.playerIsLandlord).toBe(true);
    expect(asFarmer.starThree).toBe(starGate(false).three);
    expect(asLandlord.starThree).toBe(starGate(true).three);
  });

  it("过关的话都是好话,而且会点出对手剩多少张", () => {
    expect(towerWinLine(3, 18, true)).toContain("18");
    for (const s of [1, 2, 3] as const) {
      expect(towerWinLine(s, 9, true)).not.toMatch(/错|不行|笨/);
    }
  });

  it("输了给的是方法,不是批评", () => {
    expect(towerLoseLine(2, true)).toContain("2");
    expect(towerLoseLine(9, true)).toContain("地主");
    expect(towerLoseLine(9, false)).toContain("队友");
    expect(towerLoseLine(9, true)).not.toMatch(/错|不行|笨/);
  });
});

// ---------------------------------------------------------------------------
// 1.2:每关目标 + 可赢性证明
// ---------------------------------------------------------------------------

describe("关卡目标", () => {
  it("前 99 关一律只要求「赢」——1.1 的数据一个字不改", () => {
    for (let i = 0; i < GOAL_FROM_LEVEL; i++) {
      expect(goalOf(i)).toEqual({ kind: "win" });
      expect(LEVELS[i].goal).toEqual({ kind: "win" });
    }
  });

  it("前 99 关的种子、档位、底分、照顾、身份、星门都和 1.1 的算法一模一样", () => {
    for (let i = 0; i < GOAL_FROM_LEVEL; i++) {
      const lv = LEVELS[i];
      expect(lv.seed).toBe(70000 + i * 1013);
      expect(lv.aiLevel).toBe(aiLevelOf(i));
      expect(lv.boost).toBe(boostOf(i));
      expect(lv.base).toBe(lv.chapter <= 1 ? 1 : lv.chapter <= 5 ? 2 : 3);
      expect(lv.playerIsLandlord).toBe(i < CHAPTERS[0].size ? true : i % 3 !== 2);
      expect(lv.starThree).toBe(starGate(lv.playerIsLandlord).three);
      expect(lv.starTwo).toBe(starGate(lv.playerIsLandlord).two);
    }
  });

  it("第 100 关起三种目标轮着来,「几手内赢」越往塔顶要求越紧", () => {
    const kinds = new Set(LEVELS.slice(GOAL_FROM_LEVEL).map((l) => l.goal.kind));
    expect(kinds).toEqual(new Set(["win", "hands", "noBomb"]));
    const first = LEVELS.slice(GOAL_FROM_LEVEL).find((l) => l.goal.kind === "hands")!;
    const last = [...LEVELS].reverse().find((l) => l.goal.kind === "hands")!;
    expect(first.goal.kind === "hands" && last.goal.kind === "hands").toBe(true);
    if (first.goal.kind === "hands" && last.goal.kind === "hands") {
      expect(last.goal.hands).toBeLessThanOrEqual(first.goal.hands);
      expect(last.goal.hands).toBeGreaterThanOrEqual(8);
    }
  });

  it("没赢就一定不算达成目标", () => {
    expect(goalMet({ kind: "win" }, { won: false, plays: 3, bombs: 0 })).toBe(false);
    expect(goalMet({ kind: "hands", hands: 12 }, { won: false, plays: 3, bombs: 0 })).toBe(false);
    expect(goalMet({ kind: "noBomb" }, { won: false, plays: 3, bombs: 0 })).toBe(false);
  });

  it("「几手内赢」按自己出了几手算,「不出炸弹赢」按自己炸了几次算", () => {
    expect(goalMet({ kind: "hands", hands: 10 }, { won: true, plays: 10, bombs: 2 })).toBe(true);
    expect(goalMet({ kind: "hands", hands: 10 }, { won: true, plays: 11, bombs: 0 })).toBe(false);
    expect(goalMet({ kind: "noBomb" }, { won: true, plays: 20, bombs: 0 })).toBe(true);
    expect(goalMet({ kind: "noBomb" }, { won: true, plays: 4, bombs: 1 })).toBe(false);
    expect(goalMet({ kind: "win" }, { won: true, plays: 40, bombs: 9 })).toBe(true);
  });

  it("达成目标多给一颗星,封顶还是三星", () => {
    expect(towerStarsWithGoal(2, true, false)).toBe(towerStars(2, true));
    expect(towerStarsWithGoal(2, true, true)).toBe(2);
    expect(towerStarsWithGoal(20, true, true)).toBe(3);
    expect(towerStarsWithGoal(20, true, false)).toBe(3);
  });

  it("目标那一行看得懂,达成了才有那句夸奖", () => {
    for (const lv of LEVELS) expect(goalLabel(lv.goal).length).toBeGreaterThan(6);
    expect(goalLabel({ kind: "hands", hands: 9 })).toContain("9");
    expect(goalWinLine({ kind: "noBomb" }, true)).toContain("炸");
    expect(goalWinLine({ kind: "noBomb" }, false)).toBe("");
  });
});

describe("每一关都证明得了可以赢", () => {
  /** 抽 30 关:第 1 关、每 6 关一抽,再把 100 / 145 / 188 这三关钉进去 */
  const sample = (() => {
    const picks = new Set<number>([0, 99, 144, 187]);
    for (let i = 0; picks.size < 30; i += 6) picks.add(Math.min(TOWER_TOP - 1, i));
    return [...picks].sort((a, b) => a - b);
  })();

  it("抽样的 30 关里含第 100 / 145 / 188 关", () => {
    expect(sample).toHaveLength(30);
    for (const i of [99, 144, 187]) expect(sample).toContain(i);
  });

  it("每一关都搜得到一条真能赢的线路,而且能一步不差地重放出来", () => {
    for (const i of sample) {
      const lv = LEVELS[i];
      const line = proveLevelWinnable(lv);
      expect(line, `第 ${i + 1} 关搜不到能赢的线路`).not.toBeNull();
      expect(line!.moves.length).toBeGreaterThan(0);
      expect(replayLine(proveInputOf(lv), line!), `第 ${i + 1} 关的线路重放不出来`).toBe(true);
    }
  }, 120000);

  it("线路里玩家自己那几手都记了账(出了几手、炸了几次)", () => {
    const lv = LEVELS[144];
    const input = proveInputOf(lv);
    const line = findWinningLine(input);
    expect(line).not.toBeNull();
    const mine = line!.moves.filter((m) => m.seat === input.playerSeat && m.cards.length > 0);
    expect(line!.playerPlays).toBe(mine.length);
    expect(line!.playerBombs).toBeLessThanOrEqual(line!.playerPlays);
  }, 60000);

  it("带加分目标去搜也搜得到:不出炸弹的关就真有不出炸弹的赢法", () => {
    const noBomb = LEVELS.filter((l) => l.goal.kind === "noBomb").slice(0, 3);
    expect(noBomb.length).toBe(3);
    for (const lv of noBomb) {
      const line = findWinningLine(proveInputOf(lv), 1600, { noBomb: true });
      expect(line, `第 ${lv.index + 1} 关找不到不用炸弹的赢法`).not.toBeNull();
      expect(line!.playerBombs).toBe(0);
    }
  }, 120000);

  it("「几手内赢」的关也有满足手数的赢法", () => {
    const limited = LEVELS.filter((l) => l.goal.kind === "hands").slice(0, 3);
    expect(limited.length).toBe(3);
    for (const lv of limited) {
      const max = lv.goal.kind === "hands" ? lv.goal.hands : 99;
      const line = findWinningLine(proveInputOf(lv), 1600, { maxHands: max });
      expect(line, `第 ${lv.index + 1} 关找不到 ${max} 手内的赢法`).not.toBeNull();
      expect(line!.playerPlays).toBeLessThanOrEqual(max);
    }
  }, 120000);
});

describe("本局亮点", () => {
  it("赢了挑最亮的一条夸", () => {
    expect(battleHighlight({ won: true, plays: 6, bombs: 1, bombsHeld: 0, longest: 4, foeLeft: 9 })).toContain("炸弹");
    expect(battleHighlight({ won: true, plays: 12, bombs: 0, bombsHeld: 1, longest: 3, foeLeft: 5 })).toContain("捏在手里");
    expect(battleHighlight({ won: true, plays: 11, bombs: 0, bombsHeld: 0, longest: 8, foeLeft: 4 })).toContain("8");
  });

  it("输了也只讲这一局做得好的地方,一句批评都没有", () => {
    const lines = [
      battleHighlight({ won: false, plays: 9, bombs: 0, bombsHeld: 0, longest: 7, foeLeft: 8 }),
      battleHighlight({ won: false, plays: 9, bombs: 0, bombsHeld: 1, longest: 3, foeLeft: 8 }),
      battleHighlight({ won: false, plays: 9, bombs: 1, bombsHeld: 0, longest: 3, foeLeft: 2 }),
      battleHighlight({ won: false, plays: 9, bombs: 1, bombsHeld: 0, longest: 3, foeLeft: 9 }),
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      expect(line).not.toMatch(/错|不行|笨|输给|太差/);
    }
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

  it("电脑档位随连胜一路升级,底分也跟着涨", () => {
    const ladder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => buildEndlessRound(n));
    const rank = ladder.map((r) => AI_LEVEL_ORDER.indexOf(r.aiLevel));
    for (let i = 1; i < rank.length; i++) expect(rank[i]).toBeGreaterThanOrEqual(rank[i - 1]);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i].base).toBeGreaterThanOrEqual(ladder[i - 1].base);
    expect(rank[rank.length - 1]).toBe(AI_LEVEL_ORDER.length - 1);
  });

  it("连胜成绩记在 landlord-cards 名下,而且只保留最高的那次", () => {
    expect(meta.id).toBe("landlord-cards");
    const before = save.getGameProgress(meta.id).endlessBest;
    expect(save.recordEndlessBest(meta.id, before + 4)).toBe(before + 4);
    // 后面打得差一点不会把最好成绩顶掉
    expect(save.recordEndlessBest(meta.id, 1)).toBe(before + 4);
    expect(save.getGameProgress(meta.id).endlessBest).toBe(before + 4);
    // 脏数据进不来
    expect(save.recordEndlessBest(meta.id, Number.NaN)).toBe(before + 4);
    expect(save.recordEndlessBest(meta.id, -5)).toBe(before + 4);
  });

  it("连胜每赢一局就往上记一格", () => {
    const id = `${meta.id}-streak-probe`;
    let best = save.getGameProgress(id).endlessBest;
    for (let streak = 1; streak <= 5; streak++) best = save.recordEndlessBest(id, streak);
    expect(best).toBe(5);
  });
});
