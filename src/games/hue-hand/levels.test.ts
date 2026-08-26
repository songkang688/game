import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import {
  CHAPTERS,
  buildEndlessRound,
  buildLevel,
  buildVersusRound,
  levelBrief,
  levelDeck,
  levelStars,
  loseLine,
  matchStars,
  roundDeck,
  winLine,
} from "./levels";
import { firstLeadScore, simulateGame, simulateMatch } from "./sim";

describe("章节切分", () => {
  it("8 章,大小之和恒等于 188", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
  });

  it("章节大小照规格来:24×4 + 22×2 + 24×2", () => {
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每章都有名字、图标和一句说明", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.desc.length).toBeGreaterThan(6);
    }
  });
});

describe("关卡表", () => {
  it("同一关每次算出来完全一样,牌堆顺序也固定", () => {
    const a = buildLevel(40);
    const b = buildLevel(40);
    expect(a).toEqual(b);
    expect(levelDeck(a, 0).map((c) => c.id)).toEqual(levelDeck(b, 0).map((c) => c.id));
  });

  it("牌型跟着章节一层层放开", () => {
    expect(buildLevel(0).kinds).toEqual(["num"]);
    expect(buildLevel(30).kinds).toContain("skip");
    expect(buildLevel(30).kinds).toContain("reverse");
    expect(buildLevel(30).kinds).not.toContain("draw2");
    expect(buildLevel(55).kinds).toContain("draw2");
    expect(buildLevel(80).kinds).toContain("wild");
    expect(buildLevel(80).kinds).not.toContain("wild4");
    expect(buildLevel(100).kinds).toContain("wild4");
  });

  it("第 7 章是四人桌,第 8 章是有目标分的积分赛", () => {
    expect(buildLevel(150).players).toBe(4);
    const cup = buildLevel(180);
    expect(cup.players).toBe(4);
    expect(cup.goalScore).toBeGreaterThan(0);
    expect(cup.tiers).toContain("hell");
    expect(levelBrief(cup)).toContain("积分赛");
  });

  it("188 关全都造得出来,而且每关都在自己的章节里", () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const lv = buildLevel(i);
      expect(lv.index, `第 ${i + 1} 关`).toBe(i);
      expect(lv.chapter).toBe(chapterOf(CHAPTERS, i));
      expect(lv.players).toBeGreaterThanOrEqual(2);
      expect(lv.handSize).toBeGreaterThanOrEqual(3);
      expect(lv.hint.length).toBeGreaterThan(8);
    }
  });

  it("188 关全部可解:每一关都拿参考打法真的打赢一次", () => {
    const bad: string[] = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const lv = buildLevel(i);
      const seats = ["expert" as const, ...lv.tiers].slice(0, lv.players);
      if (lv.goalScore) {
        const track = simulateMatch({
          seats,
          seed: lv.seed,
          handSize: lv.handSize,
          rounds: 8,
          deckFor: (r) => levelDeck(lv, r),
          maxSteps: 420,
        });
        const goal = firstLeadScore(track, 0);
        if (goal === null || goal > lv.goalScore) bad.push(`第 ${i + 1} 关:拿不到 ${lv.goalScore} 分`);
      } else {
        const res = simulateGame({
          seats,
          seed: lv.seed,
          deck: levelDeck(lv, 0),
          handSize: lv.handSize,
          maxSteps: 420,
        });
        if (res.winner !== 0 || res.stalled) bad.push(`第 ${i + 1} 关:没打赢`);
        else if (res.actions[0] > lv.maxTurns) {
          bad.push(`第 ${i + 1} 关:${res.actions[0]} 手超过了上限 ${lv.maxTurns}`);
        }
      }
    }
    expect(bad, bad.join("；")).toEqual([]);
  });

  it("限步数留了余量,不会紧到刚好卡死", () => {
    for (let i = 0; i < TOTAL_LEVELS; i += 7) {
      const lv = buildLevel(i);
      if (lv.goalScore) continue;
      expect(lv.maxTurns, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("评星与文案", () => {
  it("出完得越快星越多", () => {
    const lv = buildLevel(3);
    expect(levelStars(lv, 1)).toBe(3);
    expect(levelStars(lv, lv.maxTurns)).toBe(1);
    expect(levelStars(lv, Math.round(lv.maxTurns * 0.7))).toBe(2);
  });

  it("积分赛用的局数越少星越多", () => {
    expect(matchStars(1)).toBe(3);
    expect(matchStars(3)).toBe(2);
    expect(matchStars(9)).toBe(1);
  });

  it("失败文案只鼓励,不批评", () => {
    expect(loseLine(1)).toContain("差一张就出完啦");
    for (const n of [1, 2, 5, 9]) {
      expect(loseLine(n)).not.toMatch(/笨|差劲|又输|真菜/);
    }
    expect(winLine(buildLevel(0), 3).length).toBeGreaterThan(6);
  });
});

describe("无尽与对战的每一轮", () => {
  it("连胜越多对手越硬,人也越多", () => {
    expect(buildEndlessRound(1).tiers[0]).toBe("rookie");
    expect(buildEndlessRound(5).tiers[0]).toBe("normal");
    expect(buildEndlessRound(8).tiers[0]).toBe("expert");
    expect(buildEndlessRound(12).tiers[0]).toBe("hell");
    expect(buildEndlessRound(1).players).toBe(2);
    expect(buildEndlessRound(12).players).toBe(4);
  });

  it("对战按人数配 AI,缺的位置一个不落", () => {
    const cfg = buildVersusRound(2, 4, "expert");
    expect(cfg.players).toBe(4);
    expect(cfg.tiers.length).toBe(3);
    expect(cfg.tiers.every((t) => t === "expert")).toBe(true);
    expect(roundDeck(cfg).length).toBe(108);
  });

  it("无尽每一轮都用整副 108 张", () => {
    expect(roundDeck(buildEndlessRound(3)).length).toBe(108);
  });
});
