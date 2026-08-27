/**
 * 跳跳台 · 幽灵对战的口径对齐（QA 第 2 轮 · 包 B · R2B-2）。
 *
 * 修之前两边的「16」不是同一个 16:玩家看的是**站住的座数**(`run.hops >= goal` 就冻结),
 * 幽灵数的却是**起跳次数**,弹簧台白送的台数只算给幽灵 —— 一路踩圆心的满分玩家在最高两档
 * 反而要输几十到一百分。另一半是 `TIER_NOISE` 里高手 ±5% 与大师 ±1.5% 的误差整个落在完美圈里,
 * 两档逐局同分,选哪一档都一样。
 *
 * 这里守住:两边站的座数一样多、满分玩家最差也是平局、四档逐局分得开、故意打偏不会把幽灵摔下去。
 */
import { describe, expect, it } from "vitest";
import {
  AI_TIERS,
  SLIP_AT,
  TIER_NOISE,
  TIER_SLIP_EVERY,
  playGhost,
  slipPower,
  type AiTier,
} from "./ai";
import { MATCH_HOPS } from "./index";
import { matchDifficulty, matchSeed } from "./levels";
import { padTick, perfectRadius, type Difficulty } from "./pads";
import { createRun, currentPad, hop, requiredPower, targetPadDef, type RunState } from "./run";
import { flightTime, landPoint, yawTo } from "./physics";

/** 一路踩圆心、站满 goal 座就收手的满分玩家 —— 界面上 `frozen` 那一刻的等价物 */
function perfectPlayer(seed: number, difficulty: Difficulty, goal: number): RunState {
  let run = createRun(seed, difficulty);
  while (run.alive && run.hops < goal) {
    run = hop(run, requiredPower(run)).state;
  }
  return run;
}

const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe("幽灵对战 · 两边数的是同一件事", () => {
  it("满分玩家和大师幽灵站住的座数一样多", () => {
    for (const round of ROUNDS) {
      const seed = matchSeed(round);
      const diff = matchDifficulty(round);
      const me = perfectPlayer(seed, diff, MATCH_HOPS);
      const ghost = playGhost(seed, diff, "hell", MATCH_HOPS);
      expect(me.hops, `第 ${round} 局玩家站住的座数`).toBeGreaterThanOrEqual(MATCH_HOPS);
      expect(ghost.cleared, `第 ${round} 局幽灵比玩家多站了几座`).toBe(me.hops);
    }
  });

  it("满分玩家在任何一档面前都不会被白送掉几十分", () => {
    for (const round of ROUNDS) {
      const seed = matchSeed(round);
      const diff = matchDifficulty(round);
      const mine = perfectPlayer(seed, diff, MATCH_HOPS).score;
      for (const tier of AI_TIERS) {
        const ghost = playGhost(seed, diff, tier, MATCH_HOPS);
        expect(mine, `第 ${round} 局 ${tier} 幽灵反超了踩满圆心的玩家`).toBeGreaterThanOrEqual(
          ghost.score
        );
      }
    }
  });

  it("对战还是有得打:最高档要打满圆心才追得平,不是必赢", () => {
    let drawn = 0;
    for (const round of ROUNDS) {
      const seed = matchSeed(round);
      const diff = matchDifficulty(round);
      const mine = perfectPlayer(seed, diff, MATCH_HOPS).score;
      if (mine === playGhost(seed, diff, "hell", MATCH_HOPS).score) drawn += 1;
    }
    expect(drawn, "大师档变成随手就赢了").toBeGreaterThanOrEqual(4);
  });

  it("四档从第 1 局起就逐局分得开,高手不再和大师同分", () => {
    for (const round of ROUNDS) {
      const seed = matchSeed(round);
      const diff = matchDifficulty(round);
      const scores = AI_TIERS.map((t) => playGhost(seed, diff, t, MATCH_HOPS).score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i], `第 ${round} 局 ${AI_TIERS[i]} 没比 ${AI_TIERS[i - 1]} 高`).toBeGreaterThan(
          scores[i - 1]
        );
      }
    }
  });

  it("同一个 seed 跑两遍完全一样,对战才比得出高下", () => {
    const seed = matchSeed(5);
    const diff = matchDifficulty(5);
    for (const tier of AI_TIERS) {
      expect(playGhost(seed, diff, tier, MATCH_HOPS)).toEqual(playGhost(seed, diff, tier, MATCH_HOPS));
    }
  });
});

describe("故意打偏 · 掉分不掉人", () => {
  it("大师一次都不偏,前三档偏得一档比一档勤", () => {
    expect(TIER_SLIP_EVERY.hell).toBe(0);
    expect(TIER_SLIP_EVERY.rookie).toBeLessThan(TIER_SLIP_EVERY.normal);
    expect(TIER_SLIP_EVERY.normal).toBeLessThan(TIER_SLIP_EVERY.expert);
    expect(SLIP_AT).toBeGreaterThan(0);
    expect(SLIP_AT).toBeLessThan(1);
  });

  it("偏出来的落点落在完美圈外、台面内", () => {
    let checked = 0;
    for (const round of [1, 4, 8, 12, 20]) {
      const diff = matchDifficulty(round);
      let run = createRun(matchSeed(round), diff);
      for (let i = 0; i < 20 && run.alive; i++) {
        const base = requiredPower(run);
        const p = slipPower(run, base);
        const def = targetPadDef(run);
        if (def && p !== base) {
          const from = currentPad(run);
          const yaw = yawTo(from, padTick(def, run.time));
          const pad = padTick(def, run.time + flightTime(p));
          const pt = landPoint(from, p, yaw);
          const d = Math.hypot(pt.x - pad.x, pt.z - pad.z);
          expect(d, "打偏之后还是踩在圆心里,分照拿不误").toBeGreaterThan(perfectRadius(pad));
          expect(d, "打偏打到台子外面去了").toBeLessThanOrEqual(pad.r);
          checked += 1;
        }
        run = hop(run, base).state;
      }
    }
    expect(checked, "一次都没偏出来,这条用例白跑了").toBeGreaterThan(20);
  });

  it("中间两档长跑 40 座也不会因为故意打偏而掉下去", () => {
    let falls = 0;
    let runs = 0;
    for (let round = 1; round <= 24; round++) {
      const diff = matchDifficulty(round);
      for (const seed of [matchSeed(round), 11, 909, 31337]) {
        for (const tier of ["normal", "expert"] as AiTier[]) {
          runs += 1;
          if (playGhost(seed, diff, tier, 40).fell) falls += 1;
        }
      }
    }
    expect(runs).toBeGreaterThan(100);
    expect(falls, "故意打偏把幽灵摔下去了").toBe(0);
  });

  it("噪声还是规格里那四个数,一个没动", () => {
    expect(TIER_NOISE.rookie).toBeCloseTo(0.25, 10);
    expect(TIER_NOISE.normal).toBeCloseTo(0.12, 10);
    expect(TIER_NOISE.expert).toBeCloseTo(0.05, 10);
    expect(TIER_NOISE.hell).toBeCloseTo(0.015, 10);
  });
});
