import { describe, expect, it } from "vitest";
import { assertTotal, totalSize } from "../level99";
import { canHuWithFloor, scoreFans } from "./fan";
import { isHu } from "./hu";
import {
  CHAPTERS,
  CHAPTER_FLOORS,
  chapterIndexOf,
  endlessConfig,
  junkHint,
  levelConfig,
  levelGoal,
  solveLevel,
  starsFor
} from "./levels";
import { meldTileCount } from "./melds";
import { countOf, isFlower, sortTiles } from "./tiles";

const ALL = Array.from({ length: 188 }, (_, i) => levelConfig(i));

describe("章节切分", () => {
  it("八章加起来正好 188 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
  });

  it("每章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
    }
  });

  it("起和门槛按章走：前三章教学,第七章起回到八番", () => {
    expect(CHAPTER_FLOORS.length).toBe(CHAPTERS.length);
    expect(CHAPTER_FLOORS[0]).toBe(1);
    expect(CHAPTER_FLOORS[1]).toBe(2);
    expect(CHAPTER_FLOORS[2]).toBe(4);
    expect(CHAPTER_FLOORS[6]).toBe(8);
    expect(CHAPTER_FLOORS[7]).toBe(8);
  });

  it("关号能算回所属章节", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    // 越界也不炸
    expect(chapterIndexOf(999)).toBe(7);
  });
});

describe("188 关残局", () => {
  it("每一关都有解", () => {
    const bad = ALL.filter((cfg) => !solveLevel(cfg).solvable).map((cfg) => cfg.level + 1);
    expect(bad).toEqual([]);
  });

  it("每一关手牌 + 副露 + 和牌张正好 14 张", () => {
    for (const cfg of ALL) {
      expect(cfg.hand.length + meldTileCount(cfg.melds) + 1).toBe(14);
    }
  });

  it("每一关的牌一张都不重四,也不混进花牌", () => {
    for (const cfg of ALL) {
      const all = [...cfg.hand, cfg.winTile];
      for (const m of cfg.melds) all.push(...m.tiles);
      for (const t of all) {
        expect(isFlower(t)).toBe(false);
        expect(countOf(all, t)).toBeLessThanOrEqual(4);
      }
    }
  });

  it("和牌张一定排在小牌墙的最后一张", () => {
    for (const cfg of ALL) {
      expect(cfg.wall.length).toBeGreaterThan(0);
      expect(cfg.wall[cfg.wall.length - 1]).toBe(cfg.winTile);
    }
  });

  it("摸到和牌张就真的能和,而且够本关门槛", () => {
    for (const cfg of ALL) {
      expect(isHu(cfg.hand, cfg.winTile, cfg.melds)).toBe(true);
      const r = solveLevel(cfg);
      expect(canHuWithFloor(r.points, cfg.floor)).toBe(true);
    }
  });

  it("每一关都点名了要凑的番种,而且真的凑到了", () => {
    for (const cfg of ALL) {
      expect(cfg.require.length).toBeGreaterThan(0);
      const r = solveLevel(cfg);
      for (const name of cfg.require) expect(r.names).toContain(name);
    }
  });

  it("章节门槛落到了每一关上", () => {
    for (const cfg of ALL) {
      expect(cfg.floor).toBe(CHAPTER_FLOORS[cfg.chapterIndex]);
    }
  });

  it("八章各自的招牌番种都出现在本章关卡里", () => {
    const want = ["平和", "碰碰和", "杠上开花", "清一色", "七对", "清龙", "清一色", "十三幺"];
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const names = new Set<string>();
      for (const cfg of ALL.filter((c) => c.chapterIndex === ci)) {
        for (const n of cfg.require) names.add(n);
      }
      expect(names.has(want[ci])).toBe(true);
    }
  });

  it("第八章覆盖到了国标里最漂亮的那些牌型", () => {
    const names = new Set<string>();
    for (const cfg of ALL.filter((c) => c.chapterIndex === 7)) for (const n of cfg.require) names.add(n);
    for (const n of ["大三元", "十三幺", "大四喜", "字一色", "九莲宝灯", "绿一色", "清幺九"]) {
      expect(names.has(n)).toBe(true);
    }
  });

  it("同一关读两次拿到一模一样的配置", () => {
    const a = levelConfig(77);
    const b = levelConfig(77);
    expect(b.hand).toEqual(a.hand);
    expect(b.wall).toEqual(a.wall);
    expect(b.winTile).toBe(a.winTile);
  });

  it("关号越界会夹回 0..187,不会白屏", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(999).level).toBe(187);
  });

  it("闲牌都是打掉也不心疼的牌:少一张闲牌照样能和", () => {
    for (const cfg of ALL) {
      for (const junk of cfg.wall.slice(0, -1)) {
        // 闲牌不在手牌里,所以摸上来直接打掉就行
        expect(cfg.hand).not.toContain(junk);
      }
    }
  });

  it("手牌是排好序的,界面直接画就是顺的", () => {
    for (const cfg of ALL) {
      expect(cfg.hand).toEqual(sortTiles(cfg.hand));
    }
  });

  it("三星线记的是这条既定路线真能拿到的番数", () => {
    for (const cfg of ALL) {
      const r = solveLevel(cfg);
      expect(cfg.targetPoints).toBe(r.points);
      expect(cfg.targetPoints).toBeGreaterThanOrEqual(cfg.floor);
    }
  });

  it("杠上开花那一章真的带着杠", () => {
    const kanLevels = ALL.filter((c) => c.chapterIndex === 2);
    expect(kanLevels.length).toBe(24);
    for (const cfg of kanLevels) {
      expect(cfg.afterKan).toBe(true);
      expect(cfg.melds.some((m) => m.tiles.length === 4)).toBe(true);
    }
  });

  it("明杠 / 暗杠 / 加杠三种都教到了", () => {
    const kinds = new Set<string>();
    for (const cfg of ALL.filter((c) => c.chapterIndex === 2)) {
      for (const m of cfg.melds) if (m.tiles.length === 4) kinds.add(m.kind);
    }
    expect(kinds.has("ankan")).toBe(true);
    expect(kinds.has("minkan")).toBe(true);
    expect(kinds.has("kakan")).toBe(true);
  });

  it("门风圈风都落在东南西北里", () => {
    for (const cfg of ALL) {
      expect(cfg.seatWind).toBeGreaterThanOrEqual(1);
      expect(cfg.seatWind).toBeLessThanOrEqual(4);
      expect(cfg.roundWind).toBeGreaterThanOrEqual(1);
      expect(cfg.roundWind).toBeLessThanOrEqual(4);
    }
  });

  it("番数是一路往上走的:第八章比第一章高得多", () => {
    const avg = (ci: number): number => {
      const rows = ALL.filter((c) => c.chapterIndex === ci);
      return rows.reduce((s, c) => s + c.targetPoints, 0) / rows.length;
    };
    expect(avg(7)).toBeGreaterThan(avg(0));
    expect(avg(6)).toBeGreaterThan(avg(0));
  });
});

describe("关卡文案", () => {
  it("每一关都有一句话目标", () => {
    for (const cfg of ALL) {
      expect(levelGoal(cfg).length).toBeGreaterThan(3);
      expect(cfg.goal).toContain("番");
    }
  });

  it("闲牌提示会点名第一张闲牌", () => {
    const cfg = levelConfig(5);
    expect(junkHint(cfg)).toContain("闲牌");
  });

  it("目标里带番种名的那些关,提示里就写着番种", () => {
    const cfg = levelConfig(0);
    expect(cfg.goal).toContain(cfg.require[0]);
  });
});

describe("评星与无尽", () => {
  it("凑齐目标番种又没浪费机会才给三星", () => {
    const cfg = levelConfig(0);
    expect(starsFor(cfg.targetPoints, cfg, true, 0)).toBe(3);
    expect(starsFor(cfg.targetPoints, cfg, true, 5)).toBe(2);
    expect(starsFor(cfg.targetPoints, cfg, false, 0)).toBe(2);
    expect(starsFor(1, cfg, false, 9)).toBe(1);
  });

  it("无尽越往后门槛越高、对手越强", () => {
    const rounds = [1, 3, 5, 8, 12].map((r) => endlessConfig(r));
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i].floor).toBeGreaterThanOrEqual(rounds[i - 1].floor);
    }
    expect(rounds[0].tier).toBe("rookie");
    expect(rounds[rounds.length - 1].tier).toBe("hell");
    expect(rounds[rounds.length - 1].floor).toBe(8);
  });

  it("无尽局号越界也给得出配置", () => {
    expect(endlessConfig(0).floor).toBeGreaterThan(0);
    expect(endlessConfig(-3).tier).toBe("rookie");
    expect(endlessConfig(999).tier).toBe("hell");
  });

  it("无尽每一盘都有一句抬头", () => {
    expect(endlessConfig(4).label).toContain("番起和");
  });
});

describe("番数与关卡表对得上", () => {
  it("按关卡表的既定路线算番,和 scoreFans 直接算的一致", () => {
    for (const cfg of ALL.slice(0, 40)) {
      const scored = scoreFans({
        hand: sortTiles([...cfg.hand, cfg.winTile]),
        melds: cfg.melds,
        winTile: cfg.winTile,
        selfDraw: cfg.selfDraw,
        seatWind: cfg.seatWind,
        roundWind: cfg.roundWind,
        afterKan: cfg.afterKan,
        flowers: 0
      });
      expect(scored.points).toBe(cfg.targetPoints);
    }
  });
});
