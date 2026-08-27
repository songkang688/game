/**
 * 连连看 · 窗口 4 档A · 第 1 轮学习优化员
 *
 * 落地项 **A-L05**：提示改成「挑最好懂的那一对」——先给拐弯最少的，
 * 一样少就给离得最近的。
 *
 * 原来 `hintPair` 直接返回 `anyMove`，也就是「碰巧最先扫到」的那一对。
 * `anyMove` 是按图案编号、再按行列顺序扫的，扫出来的经常是横跨大半个盘的两拐线。
 * 孩子照着按掉，学到的只是「原来这两个能连」这条一次性的答案。
 * 每关只有 3 次提示，还封顶两星——这么贵的一次提示，应该教一条能自己反复用的规矩：
 * 「同行同列先看」。所以提示优先给直线。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { createBoard, findPath, type BoardState } from "./board";
import { LEVELS } from "./levels";
import { hintBest, hintPair, pathIsOrthogonal, turnCount } from "./logic";

function blank(rows: number, cols: number): BoardState {
  const R = rows + 2;
  const C = cols + 2;
  return { rows, cols, R, C, grid: Array.from({ length: R }, () => new Array<number>(C).fill(-1)) };
}

function turnsOf(level: number): number {
  return LEVELS[level].maxTurns ?? 2;
}

describe("连连看 · R1 学习优化 · A-L05 提示先给最好懂的一对", () => {
  it("盘上同时有直线对和两拐对时，提示给的是直线那一对", () => {
    const b = blank(5, 5);
    // 图案 0：同一行挨着，直线就能连
    b.grid[1][1] = 0;
    b.grid[1][2] = 0;
    // 图案 1：对角两头，只能靠两拐绕过去
    b.grid[3][1] = 1;
    b.grid[5][5] = 1;
    const pick = hintBest(b, 2);
    expect(pick).not.toBeNull();
    expect(pick?.turns).toBe(0);
    expect(pick?.pair).toEqual([
      [1, 1],
      [1, 2]
    ]);
  });

  it("扫描顺序靠后的直线也抢得过靠前的两拐（不是「先到先得」）", () => {
    const b = blank(5, 5);
    // 图案 0 排在前面，但要拐弯
    b.grid[1][1] = 0;
    b.grid[3][3] = 0;
    // 图案 5 排在后面，却是同列直通
    b.grid[1][5] = 5;
    b.grid[2][5] = 5;
    const pick = hintBest(b, 2);
    expect(pick?.turns).toBe(0);
    expect(pick?.pair).toEqual([
      [1, 5],
      [2, 5]
    ]);
  });

  it("都要拐一样多的弯时，挑离得最近的那一对", () => {
    const b = blank(6, 6);
    // 两对都是「一拐」，但一对横跨整盘、一对就在隔壁
    b.grid[1][1] = 0;
    b.grid[6][6] = 0;
    b.grid[2][2] = 3;
    b.grid[3][3] = 3;
    const pick = hintBest(b, 2);
    expect(pick?.turns).toBe(1);
    expect(pick?.pair).toEqual([
      [2, 2],
      [3, 3]
    ]);
  });

  it("提示走的仍然是真求解：给出来的一对图案相同、路真的连得上、线横平竖直", () => {
    for (let seed = 0; seed < 40; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(seed));
      const pick = hintBest(b, 2);
      expect(pick, `种子 ${seed}`).not.toBeNull();
      const [a, z] = pick!.pair;
      expect(b.grid[a[0]][a[1]]).toBe(b.grid[z[0]][z[1]]);
      expect(findPath(b, a, z, 2)).not.toBeNull();
      expect(pathIsOrthogonal(pick!.path)).toBe(true);
      expect(turnCount(pick!.path)).toBe(pick!.turns);
      expect(pick!.turns).toBeLessThanOrEqual(2);
    }
  });

  it("死局照样诚实地说「没有」，不会为了给提示瞎高亮", () => {
    const b = blank(3, 3);
    b.grid[1][1] = 0;
    b.grid[3][3] = 1;
    expect(hintBest(b, 2)).toBeNull();
    expect(hintPair(b, 2)).toBeNull();
    // 空盘也不会崩
    expect(hintPair(blank(4, 4), 2)).toBeNull();
  });

  it("「只准拐一次」的关里，提示绝不会给一条要拐两次的线", () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 8, gravity: "none", maxTurns: 1 }, mulberry32(seed + 500));
      const pick = hintBest(b, 1);
      expect(pick, `种子 ${seed}`).not.toBeNull();
      expect(pick!.turns).toBeLessThanOrEqual(1);
      expect(findPath(b, pick!.pair[0], pick!.pair[1], 1)).not.toBeNull();
    }
  });

  it("188 关开局都给得出提示，而且每一条都守着本关的拐弯上限", () => {
    for (let lv = 0; lv < LEVELS.length; lv += 1) {
      const l = LEVELS[lv];
      const maxTurns = turnsOf(lv);
      const b = createBoard(
        { rows: l.rows, cols: l.cols, kinds: l.kinds, gravity: l.gravity ?? "none", maxTurns },
        mulberry32(9000 + lv)
      );
      const pick = hintBest(b, maxTurns);
      expect(pick, `第 ${lv + 1} 关`).not.toBeNull();
      expect(pick!.turns, `第 ${lv + 1} 关`).toBeLessThanOrEqual(maxTurns);
    }
  });

  it("开局这一盘里，提示给的绝大多数是直线——「同行同列先看」教得出来", () => {
    let straight = 0;
    const total = 60;
    for (let seed = 0; seed < total; seed++) {
      const b = createBoard({ rows: 6, cols: 6, kinds: 9, gravity: "none", maxTurns: 2 }, mulberry32(seed + 77));
      if (hintBest(b, 2)!.turns === 0) straight++;
    }
    expect(straight).toBeGreaterThanOrEqual(Math.round(total * 0.8));
  });
});
