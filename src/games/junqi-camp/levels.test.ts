// 军旗对决 · 188 关：章节和恒等 188，每一关都真的能扛旗回来。
import { describe, expect, it } from "vitest";
import { assertTotal } from "../level99";
import {
  CHAPTERS,
  TOTAL,
  chapterIndexOf,
  chaptersValid,
  endlessGame,
  endlessPlan,
  indexInChapterOf,
  levelHint,
  maxPliesOf,
  planFor,
  positionFor,
  rateLevel,
  replaySolution,
  solveLevel,
} from "./levels";
import { validateSetup, kindsOf } from "./setup";
import { HQ } from "./board";
import { ARMY_SIZE, legalMoves, status } from "./rules";

describe("军旗对决 · 章节切分", () => {
  it("八章加起来正好 188 关", () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(TOTAL).toBe(188);
    expect(assertTotal(CHAPTERS, 188, "junqi-camp")).toBe(true);
    expect(chaptersValid()).toBe(true);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("章节名与说明在 360px 上不会撑破一行", () => {
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeLessThanOrEqual(8);
      expect(c.desc.length).toBeLessThanOrEqual(30);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });

  it("关卡编号能对上章节", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(187)).toBe(7);
    expect(indexInChapterOf(24)).toBe(0);
    expect(indexInChapterOf(187)).toBe(23);
  });

  it("越往后越难：前七章是守备队残局，第八章是地狱档实战", () => {
    expect(planFor(0).garrison).toBe(true);
    expect(planFor(0).hidden).toBe(false);
    expect(planFor(120).hidden).toBe(true); // 第六章暗棋
    expect(planFor(187).garrison).toBe(false);
    expect(planFor(187).tier).toBe("hell");
    expect(planFor(187).hidden).toBe(true);
  });
});

describe("军旗对决 · 每一关的局面", () => {
  it("每一关都摆着星星的军旗和朵朵能动的子", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const s = positionFor(lv);
      const flag = s.cells.findIndex((c) => c?.side === "star" && c.kind === "junqi");
      expect(flag, `第 ${lv + 1} 关缺军旗`).toBeGreaterThanOrEqual(0);
      expect(HQ.star, `第 ${lv + 1} 关军旗不在大本营`).toContain(flag);
      expect(legalMoves(s.cells, "duo").length, `第 ${lv + 1} 关朵朵没子可动`).toBeGreaterThan(0);
      expect(status(s).kind, `第 ${lv + 1} 关一上来就结束了`).toBe("playing");
      expect(levelHint(lv).length).toBeGreaterThan(4);
    }
  });

  it("残局里的地雷都摆在最后两行、军旗都在大本营", () => {
    for (let lv = 0; lv < TOTAL; lv++) {
      const s = positionFor(lv);
      for (let p = 0; p < s.cells.length; p++) {
        const c = s.cells[p];
        if (!c) continue;
        const back = c.side === "star" ? [0, 1] : [10, 11];
        if (c.kind === "dilei") {
          expect(back, `第 ${lv + 1} 关的地雷摆错行`).toContain(Math.floor(p / 5));
        }
        if (c.kind === "junqi") {
          expect(HQ[c.side], `第 ${lv + 1} 关的军旗不在大本营`).toContain(p);
        }
      }
    }
  });

  it("手数上限跟着玩法走", () => {
    const garrison = planFor(3);
    expect(maxPliesOf(garrison)).toBe(garrison.budget);
    const versus = planFor(187);
    expect(maxPliesOf(versus)).toBe(versus.budget * 2);
  });

  it("步数省得越多星越多", () => {
    expect(rateLevel(1, 4)).toBe(3);
    expect(rateLevel(3, 4)).toBe(2);
    expect(rateLevel(4, 4)).toBe(1);
  });
});

describe("军旗对决 · 188 关可解", () => {
  it("每一关都搜得出一条扛旗的路，回放到底真的赢", () => {
    const failed: number[] = [];
    for (let lv = 0; lv < TOTAL; lv++) {
      const plan = planFor(lv);
      const moves = solveLevel(lv);
      if (!moves || moves.length > plan.budget || !replaySolution(lv, moves)) {
        failed.push(lv + 1);
        continue;
      }
    }
    expect(failed, `这些关走不通：${failed.join("、")}`).toEqual([]);
  });

  it("参考解都在手数以内，而且每一步都真的动了子", () => {
    for (const lv of [0, 25, 60, 90, 110, 130, 160, 187]) {
      const plan = planFor(lv);
      const moves = solveLevel(lv)!;
      expect(moves.length, `第 ${lv + 1} 关`).toBeGreaterThan(0);
      expect(moves.length, `第 ${lv + 1} 关`).toBeLessThanOrEqual(plan.budget);
      for (const m of moves) expect(m.from).not.toBe(m.to);
    }
  });

  it("乱走一气是赢不了的（参考解不是碰巧的）", () => {
    const moves = solveLevel(0)!;
    const wrong = moves.slice(0, moves.length - 1);
    expect(replaySolution(0, wrong)).toBe(false);
  });
});

describe("军旗对决 · 无尽", () => {
  it("连胜越多对手越强", () => {
    expect(endlessPlan(0).tier).toBe("rookie");
    expect(endlessPlan(3).tier).toBe("normal");
    expect(endlessPlan(6).tier).toBe("pro");
    expect(endlessPlan(12).tier).toBe("hell");
  });

  it("无尽的每一盘都是合法的整局布阵", () => {
    for (const streak of [0, 4, 8, 13]) {
      const s = endlessGame(streak);
      expect(s.cells.filter((c) => c?.side === "duo")).toHaveLength(ARMY_SIZE);
      expect(validateSetup({ side: "star", cells: kindsOf(s.cells, "star") }).ok).toBe(true);
    }
  });
});
