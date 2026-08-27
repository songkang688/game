/**
 * 接住小水果 · 窗口 4 档A · 第 1 轮学习优化员
 *
 * 落地项 **A-L01**：`simulateLevel` 把「生成器排链假定的速度」和「假玩家真跑的速度」拆开。
 *
 * 拆之前两者共用 `basketSpeed`：调低它，生成器会跟着把落点排得更近，
 * 假玩家于是照样一颗不漏——「手慢一点的孩子会怎样」这条路根本走不到，
 * 第 1 轮测试员只能自己手搓一个「篮子冻住」的小模拟来凑一次输局（W4A-04）。
 *
 * 拆之后 `basketSpeed` 只管出题、`playerSpeed` 只管答题，于是：
 *  - 真输的一局可以直接从正规模拟器里跑出来；
 *  - 顺带能量出每一关的「手速门槛」`needSpeed`，第 2 轮查难度曲线就有尺子了。
 */
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import {
  BASKET_SPEED,
  MAX_MISS,
  REACH_MARGIN,
  W,
  clampBasket,
  markReachable,
  minSpeedNeeded,
  planDrops,
  simulateLevel,
  type DropPlan
} from "./logic";

/** 直接手搓一张落点表，好让门槛速度是可以笔算的 */
function drop(landAt: number, x: number, extra: Partial<DropPlan> = {}): DropPlan {
  return { at: 0, x, vy: 120, kind: "fruit", landAt, bonus: false, ...extra };
}

describe("接住小水果 · R1 学习优化 · A-L01 生成速度与玩家速度分家", () => {
  it("不传 playerSpeed 时，模拟结果和拆分之前一模一样（默认路径没被动过）", () => {
    for (const lv of [0, 49, 99, 187]) {
      const a = simulateLevel(LEVELS[lv], { seed: 1000 + lv });
      const b = simulateLevel(LEVELS[lv], { seed: 1000 + lv, playerSpeed: BASKET_SPEED });
      expect(b.won, `第 ${lv + 1} 关`).toBe(a.won);
      expect(b.caught).toBe(a.caught);
      expect(b.missed).toBe(a.missed);
      expect(b.bestCombo).toBe(a.bestCombo);
    }
  });

  it("满速的假玩家照样一关不落：第 1 / 100 / 188 关都赢，且一次都没被辣椒擦到", () => {
    for (const lv of [0, 99, 187]) {
      const r = simulateLevel(LEVELS[lv], { seed: 777 + lv });
      expect(r.won, `第 ${lv + 1} 关`).toBe(true);
      expect(r.hazardHits, `第 ${lv + 1} 关`).toBe(0);
    }
  });

  it("把玩家调慢就能跑出一局真输：正规模拟器自己就能演输局了", () => {
    const r = simulateLevel(LEVELS[0], { playerSpeed: 12, seed: 4242, maxSeconds: 120 });
    expect(r.won).toBe(false);
    expect(r.missed).toBe(MAX_MISS);
    expect(r.caught).toBeLessThan(r.target);
    // 输了也不是被辣椒坑的——碰不得的东西始终离链 80px
    expect(r.hazardHits).toBe(0);
  });

  it("玩家越慢漏得越多：这条曲线单调，才说明速度真的接上了", () => {
    const missed = [260, 140, 70, 24].map(
      (v) => simulateLevel(LEVELS[9], { playerSpeed: v, seed: 606, maxSeconds: 160 }).missed
    );
    for (let i = 1; i < missed.length; i++) {
      expect(missed[i], `playerSpeed 第 ${i} 档`).toBeGreaterThanOrEqual(missed[i - 1]);
    }
    expect(missed[0]).toBe(0);
    expect(missed[missed.length - 1]).toBe(MAX_MISS);
  });

  it("慢玩家输掉的是水果，不是被判了「碰不得的东西」——失败只跟手速有关", () => {
    for (const lv of [0, 60, 120, 187]) {
      const r = simulateLevel(LEVELS[lv], { playerSpeed: 8, seed: 31 + lv, maxSeconds: 120 });
      expect(r.won, `第 ${lv + 1} 关`).toBe(false);
      expect(r.hazardHits, `第 ${lv + 1} 关`).toBe(0);
    }
  });
});

describe("接住小水果 · R1 学习优化 · A-L01 手速门槛 needSpeed", () => {
  it("手搓一张表，门槛速度就是「最赶的那一段」的速度", () => {
    // 从 180 出发：3 秒挪到 60（40 px/s），再 1 秒挪到 210（150 px/s）
    const need = minSpeedNeeded([drop(3, 60), drop(4, 210)], 180);
    expect(need).toBeCloseTo(150, 6);
  });

  it("奖励果和碰不得的东西不算进门槛：它们本来就不是「必接」", () => {
    const base = [drop(3, 60), drop(4, 210)];
    const withNoise = [...base, drop(3.05, 330, { bonus: true }), drop(3.5, 30, { kind: "chili" })];
    expect(minSpeedNeeded(withNoise, 180)).toBeCloseTo(minSpeedNeeded(base, 180), 6);
  });

  it("空表 / 单颗都不会算出 NaN 或 Infinity", () => {
    expect(minSpeedNeeded([], 180)).toBe(0);
    expect(Number.isFinite(minSpeedNeeded([drop(3, clampBasket(W / 2))], W / 2))).toBe(true);
  });

  it("188 关的门槛速度全都卡在 85% 极限之内：设计上人人够得着", () => {
    const ceiling = BASKET_SPEED * (1 - REACH_MARGIN);
    for (let lv = 0; lv < LEVELS.length; lv += 1) {
      const plan = markReachable(planDrops(LEVELS[lv], 1000 + lv, { count: 140, startX: W / 2 }), W / 2);
      const need = minSpeedNeeded(plan, W / 2);
      expect(need, `第 ${lv + 1} 关门槛 ${need.toFixed(1)} px/s`).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  it("模拟结果自己也带上门槛速度，第 2 轮量难度曲线直接读它", () => {
    const r = simulateLevel(LEVELS[187], { seed: 4242 });
    expect(r.needSpeed).toBeGreaterThan(0);
    expect(r.needSpeed).toBeLessThanOrEqual(BASKET_SPEED * (1 - REACH_MARGIN) + 1e-6);
    // 同一个种子读到的门槛必须一样（可复现）
    expect(simulateLevel(LEVELS[187], { seed: 4242 }).needSpeed).toBe(r.needSpeed);
  });
});
