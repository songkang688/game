/**
 * 冰冰火火森林 · 全部 188 关的可解性验证(本步的硬性验收项)。
 *
 * 做法是把一整局压成 `(凛凛格号, 焰焰格号, 拉杆开关)` 的整数状态,BFS 穷举:
 *  1. **逐关**证明两人能同时站上各自的门(不是抽样,是 0 到 187 全跑一遍);
 *  2. **逐关**证明每一颗宝石都有它的主人捡得到 —— 不然三星就成了画饼;
 *  3. **逐关**再跑一遍「一颗一颗把宝石捡完、最后一起进门」的整局模拟,
 *     证明三星路线是真的走得出来的,而且走得完还在时限之内。
 *
 * 求解器只按「一次动一个人」搜;实时游戏里两人可以同时走,所以这里搜出来的解
 * 在真机上必然也照着走得通,是个偏保守的证明。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { analyzeLevel, buildGrid, resetAnalysisCache } from "./levels";
import {
  MOVE_SECONDS,
  gemOwner,
  gemsAllReachable,
  initialState,
  isWin,
  parseLevel,
  searchFrom,
  solveLevel,
  threeStarSeconds,
  timeLimitSeconds,
  twoStarSeconds,
  type GameState,
  type ParsedLevel,
} from "./logic";

/** 一整局模拟:先把宝石一颗一颗捡完,再两人一起进门 */
function fullRun(level: ParsedLevel): { ok: boolean; steps: number; picked: number } {
  let st: GameState = initialState(level);
  let steps = 0;
  let picked = 0;
  const left = new Map(level.gems.map((g) => [g.pos, g.kind]));

  while (left.size > 0) {
    const targets = left;
    const res = searchFrom(level, st, (s) => {
      for (const [pos, kind] of targets) {
        const owner = gemOwner(kind);
        if ((owner === "ice" || owner === "both") && s.ice === pos) return true;
        if ((owner === "fire" || owner === "both") && s.fire === pos) return true;
      }
      return false;
    });
    if (!res.found || !res.state) return { ok: false, steps, picked };
    st = res.state;
    steps += res.steps;
    // 走到的那一步上可能同时踩到两颗,一并收掉
    for (const pos of [st.ice, st.fire]) {
      const kind = left.get(pos);
      if (!kind) continue;
      const owner = gemOwner(kind);
      const who = pos === st.ice ? "ice" : "fire";
      if (owner === "both" || owner === who) {
        left.delete(pos);
        picked++;
      }
    }
  }

  const home = searchFrom(level, st, (s) => isWin(level, s));
  if (!home.found) return { ok: false, steps, picked };
  return { ok: true, steps: steps + home.steps, picked };
}

describe("全部 188 关都走得通", () => {
  resetAnalysisCache();

  it("逐关 BFS:两人都能站上自己的门", () => {
    const unsolved: number[] = [];
    const fellBack: number[] = [];
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const a = analyzeLevel(level);
      if (a.fallback) fellBack.push(level + 1);
      const parsed = parseLevel(a.grid);
      if (!solveLevel(parsed).solvable) unsolved.push(level + 1);
    }
    expect(unsolved).toEqual([]);
    expect(fellBack).toEqual([]);
  }, 180000);

  it("逐关校验:每一颗宝石都有它的主人捡得到", () => {
    const bad: number[] = [];
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const parsed = parseLevel(analyzeLevel(level).grid);
      if (!gemsAllReachable(parsed, solveLevel(parsed))) bad.push(level + 1);
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("逐关整局模拟:宝石全收完还能一起进门,而且没超时", () => {
    const failed: number[] = [];
    const overtime: number[] = [];
    let worstRatio = 0;
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const a = analyzeLevel(level);
      const parsed = parseLevel(a.grid);
      const run = fullRun(parsed);
      if (!run.ok || run.picked !== a.totalGems) {
        failed.push(level + 1);
        continue;
      }
      const seconds = run.steps * MOVE_SECONDS;
      if (seconds > a.limitSeconds) overtime.push(level + 1);
      worstRatio = Math.max(worstRatio, seconds / a.limitSeconds);
    }
    expect(failed).toEqual([]);
    expect(overtime).toEqual([]);
    // 最吃紧的一关也只用掉时限的一小半,给孩子留足思考与走错路的余地
    expect(worstRatio).toBeLessThan(0.5);
  }, 300000);

  it("最优步数与三星线成对增长,时限永远够宽", () => {
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const a = analyzeLevel(level);
      expect(a.steps, `第 ${level + 1} 关`).toBeGreaterThan(0);
      expect(a.limitSeconds).toBe(timeLimitSeconds(a.steps));
      expect(threeStarSeconds(a.steps)).toBeLessThan(twoStarSeconds(a.steps));
      expect(twoStarSeconds(a.steps)).toBeLessThan(a.limitSeconds);
      expect(a.steps * MOVE_SECONDS).toBeLessThan(a.limitSeconds);
    }
  }, 120000);

  it("难度是往上走的:后四章的平均最优步数明显高于前四章", () => {
    const avg = (from: number, to: number): number => {
      let sum = 0;
      for (let level = from; level <= to; level++) sum += analyzeLevel(level).steps;
      return sum / (to - from + 1);
    };
    const early = avg(0, 95);
    const late = avg(96, TOTAL_LEVELS - 1);
    expect(late).toBeGreaterThan(early);
  }, 120000);

  it("生成器第一次尝试就拼得出来,不靠反复换种子", () => {
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      expect(buildGrid(level, 0), `第 ${level + 1} 关`).not.toBeNull();
      expect(analyzeLevel(level).attempts, `第 ${level + 1} 关`).toBe(1);
    }
  }, 120000);
});
