/**
 * 一局对战的状态机测试。重头戏是**公平性**:
 * 两个人共用同一份赛道,给一模一样的操作就必须跑出一模一样的成绩。
 */
import { describe, expect, it } from "vitest";
import type { Action } from "./keys";
import {
  COIN_RACE_TARGET,
  CRASH_LIMIT,
  JUMP_SECONDS,
  MAX_HEARTS,
  SLIDE_SECONDS,
  createTrackGen,
  makeGhostRecord,
} from "./logic";
import {
  FIXED_STEP,
  MAX_FRAME_SECONDS,
  type MatchState,
  applyAction,
  createMatch,
  drainEvents,
  forceSettle,
  isJumping,
  isSliding,
  livesLeft,
  stepMatch,
  trackFor,
} from "./match";

function run(state: MatchState, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps && !state.over; i++) stepMatch(state, dt);
}

/** 同一串操作同时发给两个人,时间点也完全一样 */
function runMirrored(state: MatchState, script: Array<[number, Action]>, seconds: number): void {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  let next = 0;
  for (let i = 0; i < steps && !state.over; i++) {
    const t = i * dt;
    while (next < script.length && script[next][0] <= t) {
      applyAction(state, 0, script[next][1]);
      applyAction(state, 1, script[next][1]);
      next++;
    }
    stepMatch(state, dt);
  }
}

describe("赛道对称性(公平性红线)", () => {
  it("两个人拿到的是同一份实体表,不是各生成各的", () => {
    const state = createMatch({ mode: "rush", seed: 20260826 });
    run(state, 6);
    const a = trackFor(state, 0);
    const b = trackFor(state, 1);
    expect(a).toBe(b); // 同一个对象,不可能不一样
    expect(a.length).toBeGreaterThan(0);
  });

  it("这份实体表和同种子单独生成的赛道逐个字段一致", () => {
    const seed = 987654;
    const state = createMatch({ mode: "rush", seed });
    run(state, 8);
    const shared = trackFor(state, 0);
    const solo = createTrackGen(seed).ensure(shared[shared.length - 1].at);
    expect(solo.slice(0, shared.length)).toEqual(shared);
  });

  it("两人操作完全相同时,跑出来的成绩一个数都不差", () => {
    const script: Array<[number, Action]> = [
      [1.2, "left"],
      [2.0, "jump"],
      [3.1, "right"],
      [3.9, "slide"],
      [5.2, "right"],
      [6.4, "jump"],
      [7.7, "left"],
      [9.0, "slide"],
      [10.5, "left"],
      [12.0, "jump"],
    ];
    for (const seed of [1, 55, 3141, 20260826]) {
      const state = createMatch({ mode: "rush", seed });
      runMirrored(state, script, 20);
      const [a, b] = state.runners;
      expect(a.dist).toBe(b.dist);
      expect(a.coins).toBe(b.coins);
      expect(a.crashes).toBe(b.crashes);
      expect(a.lane).toBe(b.lane);
      expect(a.resolved).toBe(b.resolved);
      expect(state.winner === null || state.winner === -1).toBe(true);
    }
  });

  it("两人都不操作时也完全同步(连撞的位置都一样)", () => {
    const state = createMatch({ mode: "rush", seed: 424242 });
    run(state, 40);
    const [a, b] = state.runners;
    expect(a.crashes).toBe(b.crashes);
    expect(a.dist).toBe(b.dist);
    expect(a.crashes).toBeGreaterThan(0);
  });

  it("同一个种子重跑一遍,结果一模一样(可复现)", () => {
    const snap = (): string => {
      const s = createMatch({ mode: "rush", seed: 777, aiLevel: 1 });
      run(s, 25);
      const [a, b] = s.runners;
      return JSON.stringify([a.dist, a.coins, a.crashes, b.dist, b.coins, b.crashes, s.winner]);
    };
    expect(snap()).toBe(snap());
  });
});

describe("操作", () => {
  it("左右换道,到边上就停住不越界", () => {
    const state = createMatch({ mode: "rush", seed: 5 });
    expect(state.runners[0].lane).toBe(1);
    applyAction(state, 0, "left");
    expect(state.runners[0].lane).toBe(0);
    expect(applyAction(state, 0, "left")).toBe(false);
    expect(state.runners[0].lane).toBe(0);
    applyAction(state, 0, "right");
    applyAction(state, 0, "right");
    expect(state.runners[0].lane).toBe(2);
    expect(applyAction(state, 0, "right")).toBe(false);
  });

  it("两个人各动各的,一个人换道不会带着另一个人跑", () => {
    const state = createMatch({ mode: "rush", seed: 5 });
    applyAction(state, 0, "left");
    applyAction(state, 1, "right");
    expect(state.runners[0].lane).toBe(0);
    expect(state.runners[1].lane).toBe(2);
  });

  it("跳跃期间不能再跳,也不能改成下滑", () => {
    const state = createMatch({ mode: "rush", seed: 5 });
    expect(applyAction(state, 0, "jump")).toBe(true);
    expect(isJumping(state, state.runners[0])).toBe(true);
    expect(applyAction(state, 0, "jump")).toBe(false);
    expect(applyAction(state, 0, "slide")).toBe(false);
    run(state, JUMP_SECONDS + 0.1);
    expect(isJumping(state, state.runners[0])).toBe(false);
  });

  it("下滑有固定时长,滑完才能再动作", () => {
    const state = createMatch({ mode: "rush", seed: 5 });
    expect(applyAction(state, 0, "slide")).toBe(true);
    expect(isSliding(state, state.runners[0])).toBe(true);
    expect(applyAction(state, 0, "jump")).toBe(false);
    run(state, SLIDE_SECONDS + 0.1);
    expect(isSliding(state, state.runners[0])).toBe(false);
    expect(applyAction(state, 0, "jump")).toBe(true);
  });

  it("换道会记一条事件,拿去放音效", () => {
    const state = createMatch({ mode: "rush", seed: 5 });
    drainEvents(state);
    applyAction(state, 0, "left");
    applyAction(state, 0, "jump");
    expect(drainEvents(state)).toEqual(["lane", "jump"]);
    expect(drainEvents(state)).toEqual([]);
  });
});

describe("无尽竞速:先撞满三次的人输", () => {
  it("一个人撞满三次,比赛立刻结束,对手赢", () => {
    const state = createMatch({ mode: "rush", seed: 31, aiLevel: 2 });
    run(state, 200);
    expect(state.over).toBe(true);
    expect(state.winner).toBe(1);
    expect(state.runners[0].out).toBe(true);
    expect(state.runners[0].crashes).toBe(CRASH_LIMIT);
    expect(state.runners[1].crashes).toBeLessThan(CRASH_LIMIT);
  });

  it("输的那个人可以跑得更远,照样输", () => {
    const state = createMatch({ mode: "rush", seed: 31, aiLevel: 2 });
    run(state, 200);
    // 电脑一直在躲,人一直不动,人反而先撞满三次
    expect(state.runners[0].crashes).toBeGreaterThan(state.runners[1].crashes);
  });

  it("剩几条命一目了然", () => {
    const state = createMatch({ mode: "rush", seed: 909 });
    expect(livesLeft(state, 0)).toBe(CRASH_LIMIT);
    run(state, 40);
    expect(livesLeft(state, 0)).toBe(CRASH_LIMIT - state.runners[0].crashes);
  });

  it("比赛结束以后按键一律不生效", () => {
    const state = createMatch({ mode: "rush", seed: 31, aiLevel: 2 });
    run(state, 200);
    expect(state.over).toBe(true);
    expect(applyAction(state, 0, "left")).toBe(false);
    expect(applyAction(state, 1, "jump")).toBe(false);
  });
});

describe("老赛制照旧", () => {
  it("无尽对战还是等两个人都跑完才比距离", () => {
    const state = createMatch({ mode: "endless", seed: 66, aiLevel: 2 });
    while (!state.runners[0].out && !state.over) stepMatch(state, 1 / 60);
    expect(state.runners[0].out).toBe(true);
    expect(state.runners[1].out).toBe(false);
    expect(state.over).toBe(false); // 电脑还在跑
    run(state, 300);
    expect(state.over).toBe(true);
    expect(state.winner).toBe(1);
    expect(livesLeft(state, 0)).toBe(0);
  });

  it("无尽对战每人三颗心", () => {
    const state = createMatch({ mode: "endless", seed: 66 });
    expect(state.runners[0].hearts).toBe(MAX_HEARTS);
  });

  it("抢金币赛撞了不掉命,只会绊一下", () => {
    const state = createMatch({ mode: "coins", seed: 66 });
    run(state, 40);
    expect(state.runners[0].crashes).toBeGreaterThan(0);
    expect(state.runners[0].out).toBe(false);
    expect(livesLeft(state, 0)).toBe(MAX_HEARTS);
  });

  it("抢金币赛先到目标枚数就赢", () => {
    const state = createMatch({ mode: "coins", seed: 66, aiLevel: 2 });
    run(state, 400);
    expect(state.over).toBe(true);
    expect(state.winner).toBe(1);
    expect(state.runners[1].coins).toBeGreaterThanOrEqual(COIN_RACE_TARGET);
  });
});

describe("幽灵对战", () => {
  it("幽灵按上一次的成绩配速往前跑,不参与碰撞", () => {
    const ghost = makeGhostRecord(1200, 30)!;
    const state = createMatch({ mode: "ghost", seed: 8, ghost });
    run(state, 10);
    expect(state.runners[1].ghost).toBe(true);
    expect(state.runners[1].crashes).toBe(0);
    expect(state.runners[1].dist).toBeGreaterThan(0);
    expect(state.runners[1].dist).toBeLessThan(1200);
  });

  it("幽灵是录像,不接受操作", () => {
    const state = createMatch({ mode: "ghost", seed: 8, ghost: makeGhostRecord(1200, 30) });
    expect(applyAction(state, 1, "left")).toBe(false);
    expect(state.runners[1].lane).toBe(1);
  });

  it("幽灵模式不配电脑大脑(对手就是上次的自己)", () => {
    const state = createMatch({ mode: "ghost", seed: 8, aiLevel: 2, ghost: makeGhostRecord(600, 15) });
    expect(state.ai).toBeNull();
    expect(state.runners[1].name).toContain("自己");
  });

  it("追过幽灵的终点成绩就当场获胜", () => {
    const state = createMatch({ mode: "ghost", seed: 8, ghost: makeGhostRecord(90, 2) });
    run(state, 200);
    expect(state.over).toBe(true);
    expect(state.winner).toBe(0); // 上次只跑了 90 米,这次随便都能超过
    expect(state.runners[0].out).toBe(false);
  });

  it("自己撞满三次就定格,追不上就算输", () => {
    const state = createMatch({ mode: "ghost", seed: 8, ghost: makeGhostRecord(9000, 120) });
    run(state, 300);
    expect(state.over).toBe(true);
    expect(state.runners[0].out).toBe(true);
    expect(state.runners[0].crashes).toBe(CRASH_LIMIT);
    expect(state.winner).toBe(1);
  });

  it("还没有上一次的成绩时,幽灵就停在起点,自己刷纪录", () => {
    const state = createMatch({ mode: "ghost", seed: 8, ghost: null });
    run(state, 3);
    expect(state.runners[1].dist).toBe(0);
    expect(state.runners[1].out).toBe(true);
    expect(state.over).toBe(false);
  });
});

describe("时间推进", () => {
  it("60fps 与 30fps 跑出来的距离几乎一样(按真实时间走,不按帧走)", () => {
    const a = createMatch({ mode: "rush", seed: 4321 });
    const b = createMatch({ mode: "rush", seed: 4321 });
    for (let i = 0; i < 600; i++) stepMatch(a, 1 / 60);
    for (let i = 0; i < 300; i++) stepMatch(b, 1 / 30);
    expect(a.time).toBeCloseTo(b.time, 6);
    expect(Math.abs(a.runners[0].dist - b.runners[0].dist)).toBeLessThan(1);
  });

  it("切后台再回来不会一口气冲出去", () => {
    const state = createMatch({ mode: "rush", seed: 4321 });
    stepMatch(state, 30);
    expect(state.time).toBeLessThanOrEqual(MAX_FRAME_SECONDS + 1e-9);
    expect(FIXED_STEP).toBeLessThan(MAX_FRAME_SECONDS);
  });

  it("中途退出也能按当前成绩判个胜负出来", () => {
    const state = createMatch({ mode: "rush", seed: 4321, aiLevel: 2 });
    run(state, 4);
    expect(state.over).toBe(false);
    expect([0, 1, -1]).toContain(forceSettle(state));
  });
});
