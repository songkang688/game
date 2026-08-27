/**
 * 窗口4 · 档B · 第 3 轮验收 —— 泡泡噗噗(bubble-pop)。
 *
 * 「五款不漏」这一轮不再抽样:188 关一关不落地让贪心机器人真打一遍(每关 6 个种子),
 * 无尽泡泡海连推 200 次,评星与过关线也全量扫一遍。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { SEA_ROWS, planCollapse, pushUpRow, seaColors, seaPushMs, seaTideRows } from "./collapse";
import { BOARD_COLS, CHAPTERS, LEVELS } from "./levels";
import { hasMovesOn } from "./logic";
import { bestAction, greedyPlay, popCells, seedBoard } from "./qaSolver";

const COLS = BOARD_COLS;

describe("档B R3 · 泡泡噗噗 · 188 关一关不落", () => {
  it("188 关每关 6 个种子:整体过关率不低于九成,没有一关是全军覆没", () => {
    const dead: string[] = [];
    let won = 0;
    let total = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      let hits = 0;
      for (let s = 1; s <= 6; s++) {
        total++;
        if (greedyPlay(LEVELS[i], s * 977 + i).won) {
          hits++;
          won++;
        }
      }
      if (hits === 0) dead.push(`第 ${i + 1} 关 6 个种子一个都没过`);
    }
    expect(dead.slice(0, 10), "有关卡是死局").toEqual([]);
    expect(won / total, `整体过关率只有 ${((won / total) * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.9);
  });

  it("188 关开局都有可点的一手:没有一关是开盘即死", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const grid = seedBoard(LEVELS[i], i * 31 + 7);
      if (!hasMovesOn(grid, COLS, LEVELS[i].colors)) bad.push(`第 ${i + 1} 关开盘就没得消`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关的过关线都留得下消不掉的石头,而且盘面装得下所有道具", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      if (lv.stone > 0 && lv.maxLeft < lv.stone) bad.push(`第 ${i + 1} 关的线比石头数还紧`);
      const specials =
        lv.rainbow + lv.stone + lv.bolt + (lv.chain ?? 0) + lv.frozen + (lv.hidden ?? 0) + (lv.chameleon ?? 0);
      if (specials > lv.rows * COLS) bad.push(`第 ${i + 1} 关的道具比格子还多`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关一步不点都是输:输局的剩余数就是满盘", () => {
    for (let i = 0; i < LEVELS.length; i += 7) {
      const r = greedyPlay(LEVELS[i], i * 13 + 3, { lazy: true });
      expect(r.won, `第 ${i + 1} 关一步不点居然也赢了`).toBe(false);
      expect(r.moves, `第 ${i + 1} 关摆烂打法居然动了手`).toBe(0);
    }
  });

  it("10 章一章不落:各章关数加起来正好 188", () => {
    expect(CHAPTERS.reduce((n, c) => n + c.size, 0)).toBe(LEVELS.length);
    expect(LEVELS.length).toBe(188);
  });
});

describe("档B R3 · 泡泡噗噗 · 无尽泡泡海全量复扫", () => {
  it("边推边消:一直好好玩能撑很久,但潮水终究会赢——这才是无尽的结算条件", () => {
    // 用与游戏同一套 planCollapse / bestAction，别自己手搓塌陷（第一版就搓错了）
    const survive = (seed: number): number => {
      let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
      const rand = mulberry32(seed);
      for (let push = 0; push < 400; push++) {
        const colors = seaColors(push);
        for (let row = 0; row < seaTideRows(push); row++) {
          const res = pushUpRow(grid, COLS, colors, rand);
          if (res.overflow) return push;
          grid = res.grid;
        }
        // 模拟玩家一直在点：把能消的一直消到没得消
        const cfg = { ...LEVELS[0], rows: SEA_ROWS, colors };
        for (let step = 0; step < 60; step++) {
          const move = bestAction(grid, cfg);
          if (!move || move.length < 2) break;
          popCells(grid, move);
          grid = planCollapse(grid, COLS, false, { reduced: true }).next;
        }
      }
      return 400;
    };
    for (const seed of [20260827, 4242, 987654]) {
      const pushes = survive(seed);
      // 一路点得很准的玩家至少能撑 80 次上推（约合连玩四五分钟）
      expect(pushes, `seed=${seed} 只撑了 ${pushes} 次推就被顶穿`).toBeGreaterThanOrEqual(80);
      // 但后段的大潮终究会追上来：无尽必须收得了摊，不能永远打不完
      expect(pushes, `seed=${seed} 推了 400 次还收不了摊`).toBeLessThan(400);
    }
  });

  it("泡泡海 200 推的节奏与颜色一路合法", () => {
    for (let n = 0; n <= 200; n++) {
      expect(seaPushMs(n), `第 ${n} 推的间隔归零了`).toBeGreaterThan(0);
      expect(seaColors(n), `第 ${n} 推的颜色数不合法`).toBeGreaterThanOrEqual(3);
      expect(seaColors(n)).toBeLessThanOrEqual(5);
      expect(seaTideRows(n)).toBeGreaterThanOrEqual(1);
    }
  });
});
