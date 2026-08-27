/**
 * 窗口4 · 档B · 第 3 轮学习优化员 —— 泡泡噗噗(bubble-pop)。
 *
 * 落地 B3-L2(第 2 轮记的 B2-L8 欠账):
 * 战役里有石头 / 冰冻 / 彩虹 / 闪电四种花样,泡泡海却从头到尾只涨纯色,
 * 玩到后面只剩「点最大的一团」这一件事。这一轮给深海加冰冻。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  SEA_FROZEN_FROM,
  SEA_FROZEN_MAX,
  SEA_ROWS,
  blowShuffle,
  planCollapse,
  pushUpRow,
  seaColors,
  seaFrozen,
  seaTideRows,
} from "./collapse";
import { BOARD_COLS, LEVELS } from "./levels";
import { FROZEN_OFFSET, hasMovesOn, isFrozen } from "./logic";
import { bestAction, popCells } from "./qaSolver";

const COLS = BOARD_COLS;

const chilled = (grid: number[][]): number => grid.flat().filter(isFrozen).length;

/**
 * 消一组,并数一数顺手化开了几颗冰。
 * `popCells` 本身就带解冻(跟 `index.ts` 里泡泡海那段同一套规矩),
 * 所以这里只做前后差,别再解冻第二遍。
 */
function popAndCountThaw(grid: number[][], group: Array<[number, number]>): number {
  const before = chilled(grid);
  popCells(grid, group);
  return before - chilled(grid);
}

describe("档B R3-L2 · 泡泡海:深海开始夹冰冻泡泡", () => {
  it("前 12 推一颗冰都没有:开局的手感原样不动", () => {
    for (let n = 0; n < SEA_FROZEN_FROM; n++) {
      expect(seaFrozen(n), `第 ${n} 推就冻上了`).toBe(0);
    }
  });

  it("到点之后开始夹冰,而且一行最多两颗", () => {
    expect(seaFrozen(SEA_FROZEN_FROM)).toBe(1);
    expect(seaFrozen(200)).toBe(SEA_FROZEN_MAX);
    for (let n = 0; n <= 1000; n++) {
      expect(seaFrozen(n), `第 ${n} 推冻太多`).toBeLessThanOrEqual(SEA_FROZEN_MAX);
      if (n > 0) {
        expect(seaFrozen(n), `第 ${n} 推的冰比上一推少了`).toBeGreaterThanOrEqual(seaFrozen(n - 1));
      }
    }
  });

  it("涨上来的那一行:冰不重列,而且永远留得下能下手的地方", () => {
    const rand = mulberry32(20260827);
    for (let n = SEA_FROZEN_FROM; n <= 300; n++) {
      const empty = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
      const res = pushUpRow(empty, COLS, seaColors(n), rand, seaFrozen(n));
      const fresh = res.grid[SEA_ROWS - 1];
      const chilled = fresh.filter(isFrozen).length;
      expect(chilled, `第 ${n} 推冻了 ${chilled} 颗`).toBe(seaFrozen(n));
      expect(chilled, `第 ${n} 推整行都冻住了`).toBeLessThan(COLS);
      // 冰壳底下仍是一颗正常颜色,化开之后照样能配对
      for (const v of fresh) {
        if (!isFrozen(v)) continue;
        expect(v - FROZEN_OFFSET).toBeGreaterThanOrEqual(0);
        expect(v - FROZEN_OFFSET).toBeLessThan(seaColors(n));
      }
    }
  });

  it("不传冰这个参数时,涨上来的还是原来那一行(老用例不受影响)", () => {
    const a = pushUpRow(
      Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1)),
      COLS,
      4,
      mulberry32(7),
    );
    const b = pushUpRow(
      Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1)),
      COLS,
      4,
      mulberry32(7),
      0,
    );
    expect(a.grid).toEqual(b.grid);
    expect(a.grid[SEA_ROWS - 1].some(isFrozen)).toBe(false);
  });

  it("带着冰玩:玩家照样撑得住,而且冰真的会被化开", () => {
    const run = (seed: number): { pushes: number; thawed: number; met: number } => {
      let grid: number[][] = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
      const rand = mulberry32(seed);
      let thawed = 0;
      let met = 0;
      for (let push = 0; push < 400; push++) {
        const colors = seaColors(push);
        for (let row = 0; row < seaTideRows(push); row++) {
          const res = pushUpRow(grid, COLS, colors, rand, seaFrozen(push));
          if (res.overflow) return { pushes: push, thawed, met };
          grid = res.grid;
        }
        met += chilled(grid);
        const cfg = { ...LEVELS[0], rows: SEA_ROWS, colors };
        for (let step = 0; step < 60; step++) {
          const move = bestAction(grid, cfg);
          if (!move || move.length < 2) break;
          thawed += popAndCountThaw(grid, move);
          grid = planCollapse(grid, COLS, false, { reduced: true }).next;
        }
        if (!hasMovesOn(grid, COLS, colors)) grid = blowShuffle(grid, COLS, colors, rand);
      }
      return { pushes: 400, thawed, met };
    };
    for (const seed of [20260827, 4242, 987654]) {
      const r = run(seed);
      expect(r.met, `seed=${seed} 全程一颗冰都没见着`).toBeGreaterThan(0);
      expect(r.thawed, `seed=${seed} 的冰一颗都化不开——那是断路不是加压`).toBeGreaterThan(0);
      // 加了冰之后仍要撑得住。这里比测试员那条 survive 多带了一步「没得消就吹一口气重排」
      // ——那是游戏里真有的规矩,所以点得完美的玩家 400 推也顶不穿,这是对的。
      expect(r.pushes, `seed=${seed} 加了冰只撑了 ${r.pushes} 推`).toBe(400);
    }
  });

  it("挑冰不挑石头:泡泡海里一颗永远消不掉的石头都不许有", () => {
    const rand = mulberry32(31337);
    for (let n = 0; n <= 300; n++) {
      const empty = Array.from({ length: SEA_ROWS }, () => Array.from({ length: COLS }, () => -1));
      const fresh = pushUpRow(empty, COLS, seaColors(n), rand, seaFrozen(n)).grid[SEA_ROWS - 1];
      // 石头会跟着涨潮一路顶到警戒线,攒够十来颗就是必死
      expect(fresh.some((v) => v === 98), `第 ${n} 推混进了石头`).toBe(false);
      expect(fresh.some((v) => v === 99 || v === 97), `第 ${n} 推混进了彩虹/闪电`).toBe(false);
    }
  });
});
