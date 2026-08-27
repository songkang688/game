// 档C · 第 2 轮学习优化员 · L2-02:推箱小仓鼠的无尽仓不再第 15 仓就冻住。
//
// 原状:buildEndless 的 ramp 是 min(1, r / 14),尺寸、箱子数、墙密度、冰面、漩涡
// 五样在第 15 仓同时爬满,第 15 仓和第 60 仓除了名字完全一样。
// 改法:第一段一个数都不动,第 15 仓起换慢档,每 6 仓多一段冰或多一对漩涡——
// 这两样在战役第 4 / 5 章已经验证过能到 4 段 / 2 对,是生成器手上还没用完的余量。
// 墙密度按兵不动:0.26 以上没验证过,密到一定程度求解器会退回兜底关,反而更简单。
import { describe, expect, it } from "vitest";
import {
  ENDLESS_LATE_STEP,
  ENDLESS_MAX_ICE,
  ENDLESS_MAX_PORTALS,
  ENDLESS_PEAK_ROUND,
  ENDLESS_RAMP_ROUNDS,
  buildEndless,
  endlessDifficulty,
  endlessIceRuns,
  endlessPortalPairs,
} from "./levels";
import { applyMoves, hasIce, hasPortal, initialState, isSolved } from "./logic";

describe("档C R2 学习优化 · L2-02 无尽仓的曲线延到第 31 仓", () => {
  it("难度分 0~120 仓一路不降", () => {
    for (let r = 1; r <= 120; r++) {
      expect(
        endlessDifficulty(r),
        `第 ${r + 1} 仓的难度分比上一仓还低`
      ).toBeGreaterThanOrEqual(endlessDifficulty(r - 1));
    }
  });

  it("第 15 仓不再是终点:第 15 / 23 / 27 / 31 仓的难度分严格往上走", () => {
    const marks = [ENDLESS_RAMP_ROUNDS, 22, 26, 30];
    for (let i = 1; i < marks.length; i++) {
      expect(
        endlessDifficulty(marks[i]),
        `第 ${marks[i] + 1} 仓和第 ${marks[i - 1] + 1} 仓一样难`
      ).toBeGreaterThan(endlessDifficulty(marks[i - 1]));
    }
  });

  it("第 31 仓到顶,再往后是同一个分数(机关用到战役验证过的上限为止)", () => {
    const peak = endlessDifficulty(ENDLESS_PEAK_ROUND);
    for (const r of [ENDLESS_PEAK_ROUND, 36, 80, 300]) {
      expect(endlessDifficulty(r), `第 ${r + 1} 仓`).toBe(peak);
    }
    expect(endlessIceRuns(999)).toBe(ENDLESS_MAX_ICE);
    expect(endlessPortalPairs(999)).toBe(ENDLESS_MAX_PORTALS);
  });

  it("第一段(前 15 仓)的机关数一个都没动", () => {
    for (let r = 0; r <= ENDLESS_RAMP_ROUNDS; r++) {
      expect(endlessIceRuns(r), `第 ${r + 1} 仓的冰面`).toBe(r >= 6 ? 2 : 0);
      expect(endlessPortalPairs(r), `第 ${r + 1} 仓的漩涡`).toBe(r >= 10 ? 1 : 0);
    }
  });

  it("冰面和漩涡都只增不减,而且不超过战役里验证过的上限", () => {
    for (let r = 1; r <= 200; r++) {
      expect(endlessIceRuns(r)).toBeGreaterThanOrEqual(endlessIceRuns(r - 1));
      expect(endlessPortalPairs(r)).toBeGreaterThanOrEqual(endlessPortalPairs(r - 1));
      expect(endlessIceRuns(r)).toBeLessThanOrEqual(ENDLESS_MAX_ICE);
      expect(endlessPortalPairs(r)).toBeLessThanOrEqual(ENDLESS_MAX_PORTALS);
    }
  });

  it("慢档是每 4 仓一档,不是每仓都加", () => {
    expect(ENDLESS_LATE_STEP).toBe(4);
    for (let r = ENDLESS_RAMP_ROUNDS; r < ENDLESS_RAMP_ROUNDS + ENDLESS_LATE_STEP; r++) {
      expect(endlessIceRuns(r)).toBe(endlessIceRuns(ENDLESS_RAMP_ROUNDS));
      expect(endlessPortalPairs(r)).toBe(endlessPortalPairs(ENDLESS_RAMP_ROUNDS));
    }
  });

  it("造出来的仓和公式对得上,而且每一仓都带得动求解器给的参考解", () => {
    for (let r = 0; r <= 48; r++) {
      const def = buildEndless(r);
      expect(def.kind).toBe("endless");
      // 冰面是逐仓兑现的
      expect(hasIce(def), `第 ${r + 1} 仓的冰面`).toBe(endlessIceRuns(r) > 0);
      // 没点漩涡的仓绝不会自己长出漩涡
      if (endlessPortalPairs(r) === 0) expect(hasPortal(def), `第 ${r + 1} 仓`).toBe(false);
      expect(def.reference.length, `第 ${r + 1} 仓没有参考解`).toBeGreaterThan(0);
      expect(def.bestPushes, `第 ${r + 1} 仓一步都不用推`).toBeGreaterThan(0);
    }
  });

  it("点了漩涡的仓大多真有漩涡(生成器是尽量满足,不是保证满足)", () => {
    // bestOfAttempts 攒不够分就把这一路上分最高的那张交出去,
    // 所以「配方点了漩涡」不等于「一定摆得下漩涡」。实测漏的不到两成——
    // 这条断言把现状钉住,漏得更多就是回归。L2-07 记的就是这件事。
    let want = 0;
    let got = 0;
    for (let r = 10; r <= 48; r++) {
      if (endlessPortalPairs(r) === 0) continue;
      want++;
      if (hasPortal(buildEndless(r))) got++;
    }
    expect(want).toBeGreaterThan(20);
    expect(got / want).toBeGreaterThanOrEqual(0.8);
  });

  it("第 15 仓之后照走参考解就能推完,没有造出死局", () => {
    for (const r of [14, 22, 26, 30, 36, 44, 60]) {
      const def = buildEndless(r);
      const { state } = applyMoves(def, initialState(def), def.reference);
      expect(isSolved(def, state), `第 ${r + 1} 仓的参考解走完还没归位`).toBe(true);
    }
  });

  it("步数上限跟着解走,难仓不会反而给得更松", () => {
    for (let r = 0; r <= 45; r += 5) {
      const def = buildEndless(r);
      expect(def.parMoves).toBeGreaterThanOrEqual(def.bestMoves);
      expect(def.twoStarMoves).toBeGreaterThan(def.parMoves);
    }
  });

  it("仓号越界不会算出负数机关", () => {
    for (const r of [-9, -1, 0, 0.4]) {
      expect(endlessIceRuns(r)).toBeGreaterThanOrEqual(0);
      expect(endlessPortalPairs(r)).toBeGreaterThanOrEqual(0);
      expect(endlessDifficulty(r)).toBe(endlessDifficulty(0));
    }
  });

  it("同一仓反复造出来一模一样(无尽也得是确定性的)", () => {
    for (const r of [3, 17, 33, 41]) {
      expect(JSON.stringify(buildEndless(r))).toBe(JSON.stringify(buildEndless(r)));
    }
  });
});
