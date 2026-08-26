import { describe, expect, it } from "vitest";
import { AI_ORDER } from "./ai";
import { createMatch, runMatch } from "./battle";
import { CHAPTERS, LEVELS, endlessFoe, endlessStage, levelAt, rateLevel } from "./levels";
import { ITEMS } from "./items";
import { ROSTER, fighterById } from "./roster";
import { STAGES, stageById } from "./stages";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";

describe("章节切分", () => {
  it("章节数不少于 8 个", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
  });

  it("章节大小之和正好是 188 关", () => {
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "duo-vs-star")).toBe(true);
  });

  it("每个章节都有名字、表情、颜色和一句话介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(6);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("关卡表正好 188 关", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
  });
});

describe("每一关都合法", () => {
  it("场地都能在场地表里找到", () => {
    for (const lv of LEVELS) {
      expect(STAGES.some((s) => s.id === lv.stageId)).toBe(true);
    }
  });

  it("对手至少一位、最多三位，而且都是本作原创角色", () => {
    for (const lv of LEVELS) {
      expect(lv.foes.length).toBeGreaterThanOrEqual(1);
      expect(lv.foes.length).toBeLessThanOrEqual(3);
      for (const f of lv.foes) {
        expect(ROSTER.some((r) => r.id === f.charId)).toBe(true);
        expect(AI_ORDER).toContain(f.tier);
        expect(f.powerBonus ?? 1).toBeGreaterThan(0.5);
        expect(f.powerBonus ?? 1).toBeLessThan(2);
      }
    }
  });

  it("上场机会与限时都在合理范围内", () => {
    for (const lv of LEVELS) {
      expect(lv.playerStocks).toBeGreaterThanOrEqual(1);
      expect(lv.playerStocks).toBeLessThanOrEqual(4);
      expect(lv.timeLimit).toBeGreaterThanOrEqual(0);
      expect(lv.timeLimit).toBeLessThanOrEqual(180);
      expect(lv.itemEvery).toBeGreaterThanOrEqual(0);
    }
  });

  it("限定道具池里的道具都真的存在", () => {
    for (const lv of LEVELS) {
      if (!lv.itemPool) continue;
      expect(lv.itemPool.length).toBeGreaterThan(0);
      for (const id of lv.itemPool) {
        expect(ITEMS.some((it) => it.id === id)).toBe(true);
      }
    }
  });

  it("每一关都有规则标签和一句话说明", () => {
    for (const lv of LEVELS) {
      expect(lv.ruleTag.length).toBeGreaterThan(1);
      expect(lv.rule.length).toBeGreaterThan(8);
    }
  });

  it("组队关一定配一个队友，普通关一定没有队友", () => {
    for (const lv of LEVELS) {
      if (lv.ruleTag === "组队赛") expect(lv.allies).toHaveLength(1);
      else expect(lv.allies).toHaveLength(0);
    }
  });

  it("队友和对手不会用同一个角色", () => {
    for (const lv of LEVELS) {
      for (const ally of lv.allies) {
        expect(lv.foes.some((f) => f.charId === ally.charId)).toBe(false);
      }
    }
  });

  it("素手关真的一个道具都不掉", () => {
    const bare = LEVELS.filter((l) => l.ruleTag === "素手赛");
    expect(bare.length).toBeGreaterThan(5);
    for (const lv of bare) expect(lv.itemEvery).toBe(0);
  });

  it("每一章都用自己的主题场地", () => {
    CHAPTERS.forEach((_, ci) => {
      const start = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      const ids = new Set(LEVELS.slice(start, start + CHAPTERS[ci].size).map((l) => l.stageId));
      expect(ids.size).toBe(1);
      expect(Array.from(ids)[0]).toBe(STAGES[ci % STAGES.length].id);
    });
  });

  it("十种花样在关卡表里都出现过", () => {
    const tags = new Set(LEVELS.map((l) => l.ruleTag));
    expect(tags.size).toBeGreaterThanOrEqual(9);
    for (const tag of ["标准赛", "道具场", "素手赛", "限时赛", "一击定", "三人乱斗", "守擂赛", "组队赛", "大将战"]) {
      expect(tags.has(tag)).toBe(true);
    }
  });

  it("越往后对手越强：后 40 关的高手档比前 40 关多得多", () => {
    const hardIn = (from: number, to: number) =>
      LEVELS.slice(from, to).reduce((n, l) => n + l.foes.filter((f) => f.tier === "hard").length, 0);
    expect(hardIn(148, 188)).toBeGreaterThan(hardIn(0, 40));
  });

  it("越往后对手的力度加成越高", () => {
    const avg = (from: number, to: number) => {
      const arr = LEVELS.slice(from, to).flatMap((l) => l.foes.map((f) => f.powerBonus ?? 1));
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };
    expect(avg(148, 188)).toBeGreaterThan(avg(0, 40));
  });

  it("第一关很温柔：一个轻松档对手，还有道具帮忙", () => {
    const first = LEVELS[0];
    expect(first.foes).toHaveLength(1);
    expect(first.foes[0].tier).toBe("easy");
    expect(first.itemEvery).toBeGreaterThan(0);
    expect(first.playerStocks).toBeGreaterThanOrEqual(2);
  });

  it("最后一关是全明星决战场上的大将战", () => {
    const last = LEVELS[TOTAL_LEVELS - 1];
    expect(last.stageId).toBe("allstar-arena");
    expect(last.ruleTag).toBe("大将战");
    expect(last.foes[0].tier).toBe("hard");
  });

  it("每一章的最后一关都是大将战", () => {
    let acc = 0;
    for (const ch of CHAPTERS) {
      acc += ch.size;
      expect(LEVELS[acc - 1].ruleTag).toBe("大将战");
    }
  });

  it("levelAt 会把越界的关号夹回来", () => {
    expect(levelAt(-5)).toBe(LEVELS[0]);
    expect(levelAt(1000)).toBe(LEVELS[TOTAL_LEVELS - 1]);
    expect(levelAt(42)).toBe(LEVELS[42]);
  });

  it("关号能正确对到章节", () => {
    expect(chapterOf(CHAPTERS, 0)).toBe(0);
    expect(chapterOf(CHAPTERS, TOTAL_LEVELS - 1)).toBe(CHAPTERS.length - 1);
  });
});

describe("星级与无尽", () => {
  it("一次没被撞出去就是三星，掉一次两星，再多一星", () => {
    expect(rateLevel(0)).toBe(3);
    expect(rateLevel(1)).toBe(2);
    expect(rateLevel(2)).toBe(1);
    expect(rateLevel(9)).toBe(1);
  });

  it("无尽车轮战的对手越来越强", () => {
    expect(endlessFoe(0).tier).toBe("easy");
    expect(endlessFoe(8).tier).toBe("normal");
    expect(endlessFoe(20).tier).toBe("hard");
    expect(endlessFoe(20).powerBonus!).toBeGreaterThan(endlessFoe(0).powerBonus!);
  });

  it("无尽对手都是原创角色，而且只有一次上场机会", () => {
    for (let r = 0; r < 30; r++) {
      const foe = endlessFoe(r);
      expect(fighterById(foe.charId).id).toBe(foe.charId);
      expect(foe.stocks).toBe(1);
    }
  });

  it("无尽模式会把十张场地轮着用", () => {
    const seen = new Set<string>();
    for (let r = 0; r < STAGES.length * 2; r++) seen.add(endlessStage(r));
    expect(seen.size).toBe(STAGES.length);
    for (const id of seen) expect(stageById(id).id).toBe(id);
  });
});

describe("关卡真的打得通", () => {
  function playable(level: number, seed: number): boolean {
    const lv = LEVELS[level];
    const s = createMatch({
      stageId: lv.stageId,
      slots: [
        { charId: "duoduo", team: 0, control: "ai", aiTier: "hard", stocks: lv.playerStocks },
        ...lv.allies.map((a) => ({
          charId: a.charId,
          team: 0,
          control: "ai" as const,
          aiTier: a.tier,
          stocks: a.stocks,
        })),
        ...lv.foes.map((f, i) => ({
          charId: f.charId,
          team: 1 + (lv.allies.length > 0 ? 0 : i),
          control: "ai" as const,
          aiTier: f.tier,
          powerBonus: f.powerBonus,
          stocks: f.stocks,
        })),
      ],
      stocks: lv.playerStocks,
      timeLimit: lv.timeLimit > 0 ? lv.timeLimit : 150,
      itemEvery: lv.itemEvery,
      itemPool: lv.itemPool,
      seed,
    });
    runMatch(s, (lv.timeLimit > 0 ? lv.timeLimit : 150) + 5);
    return s.over;
  }

  it("抽查各章的代表关都能在限时内跑出结果", () => {
    for (const level of [0, 18, 19, 37, 60, 95, 120, 150, 170, 187]) {
      expect(playable(level, 13 + level)).toBe(true);
    }
  });

  it("高手档玩家在第一关能赢下轻松档对手（关卡不是无解的）", () => {
    let wins = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const lv = LEVELS[0];
      const s = createMatch({
        stageId: lv.stageId,
        slots: [
          { charId: "duoduo", team: 0, control: "ai", aiTier: "hard", stocks: lv.playerStocks },
          ...lv.foes.map((f) => ({
            charId: f.charId,
            team: 1,
            control: "ai" as const,
            aiTier: f.tier,
            powerBonus: f.powerBonus,
            stocks: f.stocks,
          })),
        ],
        stocks: lv.playerStocks,
        timeLimit: 120,
        itemEvery: lv.itemEvery,
        seed,
      });
      runMatch(s, 130);
      if (s.winnerTeam === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});
