import { describe, expect, it } from "vitest";
import { AI_ORDER, AI_STYLES, type Input } from "./ai";
import { createMatch, runMatch, stepMatch } from "./battle";
import {
  CHAPTERS,
  LEVELS,
  endlessBonusStars,
  endlessFoe,
  endlessStage,
  levelAt,
  rateLevel,
  styleFor,
} from "./levels";
import GUIDE from "./guide";
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

  it("车轮战的小星星：每连胜 2 场 1 颗，封顶 6 颗", () => {
    expect(endlessBonusStars(0)).toBe(0);
    expect(endlessBonusStars(1)).toBe(0);
    expect(endlessBonusStars(2)).toBe(1);
    expect(endlessBonusStars(5)).toBe(2);
    expect(endlessBonusStars(12)).toBe(6);
    expect(endlessBonusStars(999)).toBe(6);
  });

  it("车轮战的小星星不会被乱数字弄崩", () => {
    expect(endlessBonusStars(-4)).toBe(0);
    expect(endlessBonusStars(Number.NaN)).toBe(0);
    expect(endlessBonusStars(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("攻略跟着章节走", () => {
  it("攻略的关卡区间正好铺满 188 关，一关不漏也不重叠", () => {
    const entries = [...GUIDE.entries].sort((a, b) => a.from - b.from);
    expect(entries).toHaveLength(CHAPTERS.length);
    expect(entries[0].from).toBe(1);
    expect(entries[entries.length - 1].to).toBe(TOTAL_LEVELS);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].from).toBe(entries[i - 1].to + 1);
    }
  });

  it("每一章的攻略标题对得上章节名，提示都写满了", () => {
    CHAPTERS.forEach((ch, i) => {
      expect(GUIDE.entries[i].title).toContain(ch.name);
      expect(GUIDE.entries[i].tips.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("攻略挂在本游戏名下，通用心得条数符合壳层要求", () => {
    expect(GUIDE.gameId).toBe("duo-vs-star");
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(3);
    expect(GUIDE.general.length).toBeLessThanOrEqual(6);
  });
});

describe("第一章是上手坡道", () => {
  const CH1 = CHAPTERS[0].size;

  it("第一章对手的上场机会从不多于玩家", () => {
    for (let t = 0; t < CH1; t++) {
      const lv = LEVELS[t];
      for (const f of lv.foes) {
        expect(f.stocks ?? 1).toBeLessThanOrEqual(lv.playerStocks);
      }
    }
  });

  it("第一章头几关对手明显让着玩家", () => {
    for (let t = 0; t < 4; t++) {
      const lv = LEVELS[t];
      // 「一击定」双方都只有 1 次机会，不参与让子
      if (lv.ruleTag === "一击定") continue;
      expect(lv.foes[0].stocks!).toBeLessThan(lv.playerStocks);
    }
  });

  it("第一章对手力度从七成一路加回十成，之后的章节不再打折", () => {
    expect(LEVELS[0].foes[0].powerBonus!).toBeLessThan(0.75);
    expect(LEVELS[CH1 - 1].foes[0].powerBonus!).toBeGreaterThan(
      LEVELS[0].foes[0].powerBonus!
    );
    // 第二章第一关不再有上手折扣
    expect(LEVELS[CH1].foes[0].powerBonus!).toBeGreaterThanOrEqual(1);
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

/**
 * 「乱按型小玩家」：来回走、一直挥击、偶尔跳一下，完全不看局势。
 * 这是新手能力的下限。开头几关必须连这种按法都能赢，不然小朋友第一关就卡住了。
 */
describe("新手也打得动开头几关", () => {
  const DT = 1 / 60;

  function masher(t: number, seed: number): Input {
    const phase = Math.floor(t / 0.49 + seed) % 2;
    const beat = Math.floor(t / 0.14 + seed) % 3;
    return {
      left: phase === 1,
      right: phase === 0,
      up: beat === 2 && Math.floor(t / 0.7 + seed) % 5 === 4,
      down: false,
      light: beat === 0,
      heavy: beat === 1 && Math.floor(t / 0.42 + seed) % 3 === 2,
    };
  }

  function masherWinRate(level: number, runs: number): number {
    const lv = LEVELS[level];
    let wins = 0;
    for (let i = 0; i < runs; i++) {
      const seed = 1000 + i * 7919;
      let s = createMatch({
        stageId: lv.stageId,
        slots: [
          { charId: "duoduo", team: 0, control: "p1", stocks: lv.playerStocks },
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
        timeLimit: lv.timeLimit,
        itemEvery: lv.itemEvery,
        itemPool: lv.itemPool,
        seed,
      });
      let t = 0;
      while (!s.over && t < 240) {
        s = stepMatch(s, DT, { 0: masher(t, seed % 7) });
        t += DT;
      }
      if (s.winnerTeam === 0) wins++;
    }
    return wins / runs;
  }

  it("第 1 关：乱按也能赢下大半", () => {
    expect(masherWinRate(0, 16)).toBeGreaterThanOrEqual(0.7);
  });

  it("第 3 关：还是很好过", () => {
    expect(masherWinRate(2, 16)).toBeGreaterThanOrEqual(0.6);
  });

  it("越往后越不能只靠乱按：第 1 关比第一章大将战好过得多", () => {
    const first = masherWinRate(0, 16);
    const boss = masherWinRate(CHAPTERS[0].size - 1, 16);
    expect(first).toBeGreaterThan(boss + 0.3);
  });
});

/* ------------------------------------------------------------------ */
/* 1.2：后段的难度靠打法，不靠数值堆                                   */
/* ------------------------------------------------------------------ */

describe("对手的打法", () => {
  it("每一位对手都带着打法标签，而且是四种里的一种", () => {
    for (const lv of LEVELS) {
      for (const f of [...lv.foes, ...lv.allies]) {
        expect(f.style).toBeDefined();
        expect(AI_STYLES).toContain(f.style);
      }
    }
  });

  it("前五章老老实实正面来，别一上手就被绕后", () => {
    let cursor = 0;
    CHAPTERS.forEach((ch, ci) => {
      for (let t = 0; t < ch.size; t++) {
        const lv = LEVELS[cursor++];
        if (ci < 5) {
          for (const f of lv.foes) expect(f.style).toBe("plain");
        }
      }
    });
    expect(styleFor(0, 0)).toBe("plain");
    expect(styleFor(4, 18)).toBe("plain");
  });

  it("第六章起打法轮着换，四种一种不落", () => {
    const late = new Set<string>();
    let cursor = 0;
    CHAPTERS.forEach((ch, ci) => {
      for (let t = 0; t < ch.size; t++) {
        const lv = LEVELS[cursor++];
        if (ci >= 5) for (const f of lv.foes) late.add(f.style ?? "plain");
      }
    });
    expect(Array.from(late).sort()).toEqual([...AI_STYLES].sort());
  });

  it("难度不再靠力气堆：最后一关的力度加成也没比第一关多出一半", () => {
    const first = LEVELS[0].foes[0].powerBonus ?? 1;
    const last = LEVELS[LEVELS.length - 1].foes[0].powerBonus ?? 1;
    expect(last).toBeGreaterThan(first);
    expect(last).toBeLessThan(1.2);
    for (const lv of LEVELS) {
      for (const f of lv.foes) expect(f.powerBonus ?? 1).toBeLessThanOrEqual(1.2);
    }
  });

  it("无尽车轮战也一样：越往后主要是打法越刁，力气只慢慢加一点点", () => {
    expect(endlessFoe(0).style).toBe("plain");
    const styles = new Set(Array.from({ length: 12 }, (_, i) => endlessFoe(i + 3).style));
    expect(styles.size).toBeGreaterThan(1);
    expect(endlessFoe(30).powerBonus ?? 1).toBeLessThan(1.6);
  });
});
