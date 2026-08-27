/**
 * 碰碰砖块 · 窗口 4 档A · 第 1 轮学习优化员
 *
 * 落地项 **A-L04**：无尽「砖塔」里的爆米花砖，连带的一圈改成按穿透算，
 * 和战役里的爆米花砖用同一套规矩。
 *
 * 改之前两边不一样：战役 `index.ts` 的 `breakAt(nr, nc, true)` 是穿透，
 * 砖塔 `towerBreak` 的 `queue.push([nr, nc, false])` 不是。后果不只是「不一致」——
 * 砖塔从第 8 排起开始掺钢砖，而钢砖只有穿透球清得动。爆米花清不掉钢砖，
 * 钢砖就会一排排堆着往下压，撑到后面整面墙拆不开，无尽模式被一堵死墙叫停。
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  KIND,
  TOWER_COLS,
  damageBrick,
  makeTowerRow,
  popcornTargets,
  towerBreak,
  type TowerState
} from "./logic";

function tower(rows: number[][]): TowerState {
  return { rows, drop: 0, spawned: rows.length, rowsCleared: 0, bricksBroken: 0, score: 0, elapsed: 0, over: false };
}

const E = KIND.EMPTY;

describe("碰碰砖块 · R1 学习优化 · A-L04 砖塔的爆米花与战役同规矩", () => {
  it("爆米花连带得掉旁边的钢砖（原来清不掉，钢砖会一直堆着）", () => {
    const st = tower([[KIND.STEEL, KIND.POPCORN, KIND.STEEL, E, E, E, E, E]]);
    const res = towerBreak(st, 0, 1);
    expect(res.state.rows[0]?.[0] ?? E).toBe(E);
    expect(res.state.rows[0]?.[2] ?? E).toBe(E);
    expect(res.broke.length).toBe(3);
  });

  it("连带的一圈把多层砖一次打穿，和战役里踩爆米花的手感一致", () => {
    const st = tower([
      [E, KIND.THREE, E, E, E, E, E, E],
      [E, KIND.POPCORN, E, E, E, E, E, E]
    ]);
    const res = towerBreak(st, 1, 1);
    expect(res.state.rows.flat().every((v) => v === E)).toBe(true);
    // 战役那边同样是 pierce=true，一下就清完
    expect(damageBrick(KIND.THREE, true).broken).toBe(true);
  });

  it("只是连带按穿透，直接打上去的规矩没变：普通球依然打不动钢砖", () => {
    const st = tower([[KIND.STEEL, KIND.NORMAL, E, E, E, E, E, E]]);
    const plain = towerBreak(st, 0, 0);
    expect(plain.state.rows[0][0]).toBe(KIND.STEEL);
    expect(plain.broke).toHaveLength(0);
    // 多层砖被直接打中还是掉一层，不是一下碎
    const two = towerBreak(tower([[KIND.TWO, E, E, E, E, E, E, E]]), 0, 0);
    expect(two.state.rows[0]?.[0]).toBe(KIND.NORMAL);
    expect(two.broke).toHaveLength(0);
  });

  it("连带只走界内那一圈，边角不会越界，也不会自己炸自己没完", () => {
    const st = tower([[KIND.POPCORN, KIND.NORMAL, E, E, E, E, E, E]]);
    const res = towerBreak(st, 0, 0);
    expect(res.state.rows.flat().every((v) => v === E)).toBe(true);
    expect(popcornTargets(0, 0, 1, TOWER_COLS)).toHaveLength(1);
  });

  it("砖塔真能一直拆下去：随机 60 排里，爆米花挨着的钢砖都清得掉", () => {
    let steelClearedSomewhere = 0;
    for (let seed = 0; seed < 60; seed++) {
      const rand = mulberry32(seed * 977 + 13);
      const row = makeTowerRow(rand, 30);
      const withCorn = row.slice();
      // 在一颗钢砖紧挨着的格子摆一块爆米花，看它拆不拆得动
      const steelAt = seed % (TOWER_COLS - 1);
      withCorn[steelAt] = KIND.STEEL;
      withCorn[steelAt + 1] = KIND.POPCORN;
      const res = towerBreak(tower([withCorn]), 0, steelAt + 1);
      expect(res.state.rows[0]?.[steelAt] ?? E, `种子 ${seed}`).toBe(E);
      steelClearedSomewhere++;
    }
    expect(steelClearedSomewhere).toBe(60);
  });

  it("清完整排照样加分，砖塔的计分口径没被这次改动带歪", () => {
    const st = tower([[KIND.NORMAL, KIND.POPCORN, KIND.STEEL, E, E, E, E, E]]);
    const res = towerBreak(st, 0, 1);
    expect(res.clearedRows).toBe(1);
    expect(res.state.score).toBeGreaterThan(0);
    expect(res.state.rowsCleared).toBe(1);
    expect(res.state.over).toBe(false);
  });
});
