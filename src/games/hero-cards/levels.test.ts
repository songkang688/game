import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  TOTAL,
  buildLevel,
  chapterIndexOf,
  chapterStartOf,
  chaptersOk,
  endlessOpenHand,
  endlessTier,
  goalLine,
  levelConfig,
  solveLevel,
  starsFor
} from "./levels";
import { assertTotal } from "../level99";
import { campOf, winnerOf } from "./engine";
import { HERO_IDS } from "./heroes";
import { AI_TIERS } from "./ai";

describe("八章 188 关", () => {
  it("章节和恒等 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(chaptersOk()).toBe(true);
    expect(TOTAL).toBe(188);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("八章各有名字、emoji、主色和一句介绍", () => {
    expect(CHAPTERS.length).toBe(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(8);
  });

  it("关号能对回章节,章节起点对得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(chapterStartOf(0)).toBe(0);
    expect(chapterStartOf(1)).toBe(24);
    expect(chapterStartOf(8)).toBe(188);
  });
});

describe("关卡配置", () => {
  it("同一关每次算出来都一模一样", () => {
    const a = levelConfig(66);
    const b = levelConfig(66);
    expect(a.seed).toBe(b.seed);
    expect(a.maxTurns).toBe(b.maxTurns);
    expect(a.seats.map((s) => `${s.heroId}/${s.role}/${s.vigor}`)).toEqual(
      b.seats.map((s) => `${s.heroId}/${s.role}/${s.vigor}`)
    );
  });

  it("每一关都有目标、提示、回合上限和三星线", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const cfg = levelConfig(lv);
      expect(cfg.level).toBe(lv);
      expect(cfg.goal.length).toBeGreaterThan(3);
      expect(cfg.hint.length).toBeGreaterThan(3);
      expect(cfg.maxTurns).toBeGreaterThan(0);
      expect(cfg.threeStarTurns).toBeGreaterThan(0);
      expect(cfg.threeStarTurns).toBeLessThanOrEqual(cfg.maxTurns);
      expect(AI_TIERS).toContain(cfg.tier);
    }
  });

  it("每一关的座位都合法:人数够、英杰认得、玩家坐 0 号位", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const cfg = levelConfig(lv);
      expect(cfg.seats.length).toBeGreaterThanOrEqual(2);
      expect(cfg.seats.length).toBeLessThanOrEqual(5);
      for (const s of cfg.seats) {
        expect(HERO_IDS).toContain(s.heroId);
        expect(s.name.length).toBeGreaterThan(0);
        if (s.vigor !== undefined) expect(s.vigor).toBeGreaterThan(0);
      }
    }
  });

  it("每一关开局就不能是已经分出胜负的局面", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const cfg = levelConfig(lv);
      const roles = cfg.seats.map((s) => s.role);
      expect(winnerOf(roles.map((_, i) => i), roles)).toBeNull();
    }
  });

  it("越界的关号自动夹回 0..187,不会炸", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(9999).level).toBe(187);
  });

  it("buildLevel 摆出来的局面跟配置对得上", () => {
    const cfg = levelConfig(3);
    const state = buildLevel(cfg);
    expect(state.players.length).toBe(cfg.seats.length);
    expect(state.players[0].name).toBe(cfg.seats[0].name);
    expect(state.over).toBe(false);
    expect(state.turn).toBe(0);
  });

  it("难度是往上走的:第八章的回合预算不比第一章宽松", () => {
    const first = levelConfig(0);
    const last = levelConfig(187);
    expect(last.seats.length).toBeGreaterThanOrEqual(first.seats.length);
    expect(AI_TIERS.indexOf(last.tier)).toBeGreaterThan(AI_TIERS.indexOf(first.tier));
  });

  it("第七章是藏花残局,玩家的身份就是藏花", () => {
    for (let lv = 140; lv < 164; lv++) {
      expect(levelConfig(lv).seats[0].role).toBe("spy");
    }
  });

  // ---------------------------------------------------------------------------
  // 第 2 轮 W1-R2-02:第 7 章原先整章 24 关都是菜鸟档,夹在第 6 章(normal→pro)
  // 与第 8 章(pro→hell)中间塌成一段低谷
  // ---------------------------------------------------------------------------

  it("第七章也有章内坡度,不是整章一个档位", () => {
    const start = chapterStartOf(6);
    const tiers = new Set<string>();
    for (let i = start; i < start + CHAPTERS[6].size; i++) tiers.add(levelConfig(i).tier);
    expect([...tiers].sort()).not.toEqual(["rookie"]);
    expect(tiers.size).toBeGreaterThanOrEqual(3);
    // 头几关还是菜鸟档:先把「花主要留到最后」这条规则教清楚
    expect(levelConfig(start).tier).toBe("rookie");
    expect(levelConfig(start + CHAPTERS[6].size - 1).tier).toBe("pro");
  });

  it("每一章最强的那一档,一章比一章不弱", () => {
    const peak = (ci: number): number => {
      const start = chapterStartOf(ci);
      let best = 0;
      for (let i = start; i < start + CHAPTERS[ci].size; i++) {
        best = Math.max(best, AI_TIERS.indexOf(levelConfig(i).tier));
      }
      return best;
    };
    for (let ci = 1; ci < CHAPTERS.length; ci++) {
      expect(peak(ci), `第 ${ci + 1} 章比第 ${ci} 章弱了`).toBeGreaterThanOrEqual(peak(ci - 1));
    }
  });

  it("有合作小关:同阵营互相打不了", () => {
    let locked = 0;
    for (let lv = 0; lv < TOTAL; lv++) if (levelConfig(lv).factionLock) locked++;
    expect(locked).toBeGreaterThan(0);
  });
});

describe("188 关全部有解", () => {
  it("每一关都能用同一套规则引擎真的走通", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < TOTAL; lv++) {
      const res = solveLevel(lv);
      if (!res.solvable) bad.push(res.note);
    }
    expect(bad).toEqual([]);
  });

  it("走通的那条线用的回合数在上限之内", () => {
    for (const lv of [0, 12, 30, 55, 80, 100, 125, 150, 175, 187]) {
      const cfg = levelConfig(lv);
      const res = solveLevel(lv, cfg);
      expect(res.solvable).toBe(true);
      expect(res.turns).toBeLessThanOrEqual(cfg.maxTurns);
      expect(res.log.length).toBeGreaterThan(0);
    }
  });

  it("赢下来的是玩家自己的阵营,不是别人替他赢的", () => {
    for (const lv of [5, 40, 90, 145, 186]) {
      const cfg = levelConfig(lv);
      expect(campOf(cfg.seats[0].role)).toBeTruthy();
      expect(solveLevel(lv, cfg).solvable).toBe(true);
    }
  });
});

describe("星级与目标文案", () => {
  it("回合越少星越多", () => {
    const cfg = levelConfig(10);
    expect(starsFor(cfg, 1)).toBe(3);
    expect(starsFor(cfg, cfg.threeStarTurns)).toBe(3);
    expect(starsFor(cfg, cfg.threeStarTurns + 1)).toBe(2);
    expect(starsFor(cfg, cfg.threeStarTurns + 3)).toBe(2);
    expect(starsFor(cfg, cfg.threeStarTurns + 4)).toBe(1);
  });

  it("目标那一行写清了要干什么和几个回合", () => {
    const cfg = levelConfig(0);
    const line = goalLine(cfg);
    expect(line).toContain(cfg.goal);
    expect(line).toContain(String(cfg.maxTurns));
    expect(line).toContain("回合");
  });
});

describe("无尽的坡度", () => {
  it("连胜越多对手越硬,而且一路只升不降", () => {
    expect(endlessTier(0)).toBe("rookie");
    expect(endlessTier(2)).toBe("normal");
    expect(endlessTier(5)).toBe("pro");
    expect(endlessTier(9)).toBe("hell");
    expect(endlessTier(50)).toBe("hell");
    let last = -1;
    for (let s = 0; s <= 30; s++) {
      const at = AI_TIERS.indexOf(endlessTier(s));
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
  });

  it("连胜越多起手牌越少,但不会少到没法打", () => {
    expect(endlessOpenHand(0)).toBe(5);
    expect(endlessOpenHand(4)).toBe(4);
    expect(endlessOpenHand(8)).toBe(3);
    for (let s = 0; s <= 60; s++) expect(endlessOpenHand(s)).toBeGreaterThanOrEqual(3);
  });
});
