import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  COIN_RACE_TARGET,
  MAX_SPEED,
  createTrackGen,
  endlessWinner,
  isObstacle,
  makeRng,
  speedAt,
  survives,
  trackIsFair,
} from "./logic";

describe("种子随机", () => {
  it("同种子序列完全一致", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it("不同种子序列不同", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });

  it("输出在 [0,1) 区间", () => {
    const r = makeRng(999);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("速度曲线", () => {
  it("起步是基础速度", () => {
    expect(speedAt(0)).toBe(BASE_SPEED);
  });

  it("随距离上升", () => {
    expect(speedAt(500)).toBeGreaterThan(speedAt(100));
  });

  it("永远不超过封顶速度", () => {
    expect(speedAt(1e9)).toBe(MAX_SPEED);
  });
});

describe("碰撞规则", () => {
  it("石头跳不过去", () => {
    expect(survives("rock", true)).toBe(false);
    expect(survives("rock", false)).toBe(false);
  });

  it("木栏和泥坑跳过去就安全", () => {
    expect(survives("hurdle", true)).toBe(true);
    expect(survives("hurdle", false)).toBe(false);
    expect(survives("pit", true)).toBe(true);
    expect(survives("pit", false)).toBe(false);
  });
});

describe("赛道生成", () => {
  it("同种子生成一模一样的赛道（双人公平）", () => {
    const a = createTrackGen(777).ensure(3000);
    const b = createTrackGen(777).ensure(3000);
    expect(a).toEqual(b);
  });

  it("前 60 米是热身段，没有障碍", () => {
    const track = createTrackGen(42).ensure(2000);
    const early = track.filter((e) => e.at < 60 && isObstacle(e.kind));
    expect(early.length).toBe(0);
  });

  it("赛道有金币也有障碍", () => {
    const track = createTrackGen(42).ensure(2000);
    expect(track.some((e) => e.kind === "coin")).toBe(true);
    expect(track.some((e) => isObstacle(e.kind))).toBe(true);
  });

  it("任意种子的赛道永远留有活路", () => {
    for (const seed of [1, 7, 42, 999, 31415]) {
      const track = createTrackGen(seed).ensure(5000);
      expect(trackIsFair(track)).toBe(true);
    }
  });

  it("实体按距离排序且能持续生成", () => {
    const gen = createTrackGen(5);
    const firstLen = gen.ensure(500).length;
    const more = gen.ensure(1500);
    expect(more.length).toBeGreaterThan(firstLen);
    for (let i = 1; i < more.length; i++) {
      expect(more[i].at).toBeGreaterThanOrEqual(more[i - 1].at);
    }
  });
});

describe("无尽模式结算", () => {
  it("距离远的赢", () => {
    expect(endlessWinner(
      { dist: 500, coins: 3, crashed: true },
      { dist: 300, coins: 30, crashed: true },
    )).toBe(0);
  });

  it("距离相同比金币", () => {
    expect(endlessWinner(
      { dist: 400, coins: 5, crashed: true },
      { dist: 400, coins: 9, crashed: true },
    )).toBe(1);
  });

  it("完全打平是平局", () => {
    expect(endlessWinner(
      { dist: 400.2, coins: 5, crashed: true },
      { dist: 400.8, coins: 5, crashed: true },
    )).toBe(-1);
  });

  it("金币赛目标是正数", () => {
    expect(COIN_RACE_TARGET).toBeGreaterThan(0);
  });
});
