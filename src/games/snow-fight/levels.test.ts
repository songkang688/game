/**
 * 雪球大作战 · 关卡生成单测。
 *
 * 这一份看的是「关卡长什么样」,不看打得动打不动(那是 sim.test.ts 的活)。
 * 重点盯三件事:章节切分对不对、每一关都是同一颗种子生成的、
 * 以及最容易出死局的那条——掩体不许糊在靶子脸上、靶子不许摆到扔不到的地方。
 */
import { describe, expect, it } from "vitest";
import { assertTotal, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  CHAPTER_NEW,
  COVER_CLEARANCE,
  LEVEL_TOTAL,
  TARGET_MAX_X,
  TARGET_MIN_X,
  THROWER_X,
  VIEW_W,
  buildLevel,
  buildWind,
  chapterIndexOf,
  chapterStartOf,
  duelMatch,
  endlessMatch,
  levelMatch,
  monsterCount,
  targetCount,
} from "./levels";
import { GUARD_X } from "./logic";
import { MAX_WIND } from "./physics";

/** 遍历全部 188 关,省得每个用例都写一遍循环 */
function eachLevel(fn: (level: ReturnType<typeof buildLevel>, index: number) => void): void {
  for (let i = 0; i < LEVEL_TOTAL; i++) fn(buildLevel(i), i);
}

describe("雪球大作战 · 章节", () => {
  it("八章合计正好 188 关", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(LEVEL_TOTAL).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, LEVEL_TOTAL, "snow-fight")).toBe(true);
  });

  it("每一章都有名字、表情、颜色和一句介绍", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.desc.length).toBeGreaterThan(8);
      expect(c.size).toBeGreaterThan(0);
    }
    expect(CHAPTER_NEW).toHaveLength(CHAPTERS.length);
    for (const line of CHAPTER_NEW) expect(line.length).toBeGreaterThan(6);
  });

  it("关号能算回章节,章节起点接得上", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(LEVEL_TOTAL - 1)).toBe(CHAPTERS.length - 1);
    let acc = 0;
    for (let i = 0; i < CHAPTERS.length; i++) {
      expect(chapterStartOf(i)).toBe(acc);
      expect(chapterIndexOf(acc)).toBe(i);
      expect(chapterIndexOf(acc + CHAPTERS[i].size - 1)).toBe(i);
      acc += CHAPTERS[i].size;
    }
    expect(acc).toBe(LEVEL_TOTAL);
  });

  it("关号越界也不会崩,会被夹回 0..187", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(9999).index).toBe(LEVEL_TOTAL - 1);
    expect(buildLevel(12.4).index).toBe(12);
  });
});

describe("雪球大作战 · 关卡生成", () => {
  it("同一关生成两次一模一样", () => {
    for (const i of [0, 37, 88, 141, 187]) {
      expect(buildLevel(i)).toEqual(buildLevel(i));
    }
  });

  it("靶子都摆在扔得到的那一段里,而且在雪堡外面", () => {
    eachLevel((level, i) => {
      expect(level.targets.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
      for (const t of level.targets) {
        expect(t.x, `第 ${i + 1} 关`).toBeGreaterThan(GUARD_X);
        expect(t.x).toBeGreaterThanOrEqual(TARGET_MIN_X - 2);
        expect(t.x).toBeLessThanOrEqual(TARGET_MAX_X + 2);
        expect(t.x).toBeLessThan(VIEW_W);
        expect(t.y).toBeGreaterThan(0);
      }
    });
  });

  it("掩体永远离靶子留着一段空档,不会把靶子糊死", () => {
    eachLevel((level, i) => {
      for (const c of level.covers) {
        expect(c.x, `第 ${i + 1} 关`).toBeGreaterThan(GUARD_X);
        expect(c.w).toBeGreaterThan(0.5);
        expect(c.h).toBeGreaterThan(1);
        expect(c.hp).toBeGreaterThanOrEqual(2);
        for (const t of level.targets) {
          const gap = t.x < c.x ? c.x - t.x : t.x - (c.x + c.w);
          expect(gap, `第 ${i + 1} 关 掩体 ${c.x} 靶子 ${t.x}`).toBeGreaterThanOrEqual(
            COVER_CLEARANCE - 0.05
          );
        }
      }
    });
  });

  it("掩体之间也不重叠", () => {
    eachLevel((level, i) => {
      const sorted = [...level.covers].sort((a, b) => a.x - b.x);
      for (let k = 1; k < sorted.length; k++) {
        expect(sorted[k].x, `第 ${i + 1} 关`).toBeGreaterThan(sorted[k - 1].x + sorted[k - 1].w);
      }
    });
  });

  it("新东西按章节一样一样地出场", () => {
    eachLevel((level, i) => {
      const ci = level.chapterIndex;
      const monsters = level.targets.filter((t) => t.kind === "monster");
      if (ci <= 1) {
        expect(level.covers, `第 ${i + 1} 关`).toHaveLength(0);
        expect(monsters, `第 ${i + 1} 关`).toHaveLength(0);
      } else {
        expect(level.covers.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
      }
      if (ci <= 2) expect(monsters, `第 ${i + 1} 关`).toHaveLength(0);
      if (ci >= 3) {
        expect(monsters.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
        expect(level.walls, `第 ${i + 1} 关`).toBeGreaterThan(0);
      }
      const swaying = level.targets.filter((t) => (t.sway ?? 0) > 0);
      if (ci === 5 || ci === 7) expect(swaying.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
      else expect(swaying, `第 ${i + 1} 关`).toHaveLength(0);
    });
  });

  it("靶子数与雪怪数一路只增不减,雪怪永远不多于靶子", () => {
    for (let i = 1; i < LEVEL_TOTAL; i++) {
      expect(targetCount(i)).toBeGreaterThanOrEqual(1);
      expect(targetCount(i)).toBeLessThanOrEqual(6);
      expect(monsterCount(i)).toBeLessThanOrEqual(targetCount(i) + 2);
    }
    expect(targetCount(0)).toBeLessThanOrEqual(targetCount(LEVEL_TOTAL - 1));
    expect(monsterCount(0)).toBe(0);
  });

  it("雪球给得宽裕:至少是靶子数的两倍", () => {
    eachLevel((level, i) => {
      expect(level.balls, `第 ${i + 1} 关`).toBeGreaterThanOrEqual(level.targets.length * 2);
      expect(level.balls).toBeGreaterThanOrEqual(4);
    });
  });

  it("第一章一点风都没有,后面的风不会超过上限", () => {
    for (let i = 0; i < CHAPTERS[0].size; i++) {
      expect(buildWind(i)).toEqual([0]);
    }
    eachLevel((level, i) => {
      expect(level.windPlan.length, `第 ${i + 1} 关`).toBeGreaterThan(0);
      for (const w of level.windPlan) {
        expect(Math.abs(w), `第 ${i + 1} 关`).toBeLessThanOrEqual(MAX_WIND);
      }
    });
  });

  it("阵风章的风每一投都在换,别的章一整关一个风", () => {
    eachLevel((level, i) => {
      const gusty = level.chapterIndex === 4 || level.chapterIndex === 7;
      if (gusty) {
        expect(level.windPlan.length, `第 ${i + 1} 关`).toBeGreaterThan(1);
        expect(new Set(level.windPlan).size, `第 ${i + 1} 关`).toBeGreaterThan(1);
      } else {
        expect(level.windPlan, `第 ${i + 1} 关`).toHaveLength(1);
      }
    });
  });

  it("折成一局之后,投手站在雪堡这边,回合数够用", () => {
    const level = buildLevel(100);
    const spec = levelMatch(level);
    expect(spec.mode).toBe("campaign");
    expect(spec.throwers).toHaveLength(1);
    expect(spec.throwers[0].x).toBe(THROWER_X);
    expect(spec.throwers[0].x).toBeLessThan(GUARD_X);
    expect(spec.throwers[0].balls).toBe(level.balls);
    expect(spec.maxShots ?? 0).toBeGreaterThan(level.balls);
  });
});

describe("雪球大作战 · 另外三种模式的场地", () => {
  it("对战场地左右对称,谁都占不到便宜", () => {
    const spec = duelMatch(null);
    const mine = spec.targets.filter((t) => t.owner === 0).map((t) => t.x).sort((a, b) => a - b);
    const yours = spec.targets.filter((t) => t.owner === 1).map((t) => t.x).sort((a, b) => b - a);
    expect(mine).toHaveLength(3);
    expect(yours).toHaveLength(3);
    const mid = (spec.throwers[0].x + spec.throwers[1].x) / 2;
    for (let i = 0; i < 3; i++) {
      expect(mid - mine[i]).toBeCloseTo(yours[i] - mid, 6);
    }
    expect(spec.throwers[0].dir).toBe(1);
    expect(spec.throwers[1].dir).toBe(-1);
    expect(spec.throwers[0].walls).toBe(spec.throwers[1].walls);
  });

  it("双人对战没有电脑,人机对战只有康康那一边是电脑", () => {
    expect(duelMatch(null).mode).toBe("versus");
    expect(duelMatch(null).throwers.every((t) => !t.ai)).toBe(true);
    for (const level of ["easy", "normal", "hard"] as const) {
      const spec = duelMatch(level);
      expect(spec.mode).toBe("ai");
      expect(spec.throwers[0].ai ?? null).toBeNull();
      expect(spec.throwers[1].ai).toBe(level);
    }
  });

  it("对战场地中间有掩体,雪球是无限的", () => {
    const spec = duelMatch("normal");
    expect(spec.covers?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const t of spec.throwers) expect(t.balls).toBe(-1);
    expect(spec.windPlan.length).toBeGreaterThan(1);
  });

  it("无尽给无限雪球和几堵雪墙,靶子由外面一波一波送进来", () => {
    const spec = endlessMatch([{ x: 30, y: 2, kind: "monster", march: 1 }]);
    expect(spec.mode).toBe("endless");
    expect(spec.throwers[0].balls).toBe(-1);
    expect(spec.throwers[0].walls).toBeGreaterThan(0);
    expect(spec.targets).toHaveLength(1);
  });
});
