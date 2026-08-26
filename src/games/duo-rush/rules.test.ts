/**
 * 1.1 第 6 步 C 档新增的纯规则单测。
 * 老的 `logic.test.ts` 一条不动,新规则(下滑、横杆、可通过性、竞速结算、幽灵)放这里。
 */
import { describe, expect, it } from "vitest";
import {
  BASE_SPEED,
  CRASH_LIMIT,
  GHOST_MIN_DIST,
  LANE_CHANGE_SECONDS,
  MAX_SPEED,
  type Entity,
  baselineDistAt,
  betterGhost,
  createTrackGen,
  ghostDistAt,
  isObstacle,
  makeGhostRecord,
  maxLaneShift,
  parseGhostRecord,
  passBy,
  rushWinner,
  serializeGhostRecord,
  speedAt,
  survives,
  survivesMove,
  trackClusters,
  trackHasRoute,
  trackIsFair,
} from "./logic";

const at = (kind: Entity["kind"], lane: 0 | 1 | 2, m: number): Entity => ({ kind, lane, at: m });

describe("三种动作对上三种障碍", () => {
  it("每种障碍只认一种过法", () => {
    expect(passBy("rock")).toBe("lane");
    expect(passBy("hurdle")).toBe("jump");
    expect(passBy("pit")).toBe("jump");
    expect(passBy("gate")).toBe("slide");
  });

  it("横杆要下滑钻过去,跳起来反而撞得更结实", () => {
    expect(survivesMove("gate", { jumping: false, sliding: true })).toBe(true);
    expect(survivesMove("gate", { jumping: true, sliding: false })).toBe(false);
    expect(survivesMove("gate", { jumping: false, sliding: false })).toBe(false);
  });

  it("木栏和泥坑要跳,趴下去没用", () => {
    expect(survivesMove("hurdle", { jumping: true, sliding: false })).toBe(true);
    expect(survivesMove("hurdle", { jumping: false, sliding: true })).toBe(false);
    expect(survivesMove("pit", { jumping: true, sliding: false })).toBe(true);
    expect(survivesMove("pit", { jumping: false, sliding: true })).toBe(false);
  });

  it("石头还是只能换道,跳也不行滑也不行", () => {
    expect(survivesMove("rock", { jumping: true, sliding: true })).toBe(false);
    expect(survives("rock", true)).toBe(false);
  });

  it("老的 survives 接口只认跳跃,横杆在它眼里也过不去", () => {
    expect(survives("hurdle", true)).toBe(true);
    expect(survives("gate", true)).toBe(false);
  });

  it("横杆算障碍,金币和加速带不算", () => {
    expect(isObstacle("gate")).toBe(true);
    expect(isObstacle("coin")).toBe(false);
    expect(isObstacle("boost")).toBe(false);
  });
});

describe("障碍排与可通过性", () => {
  it("距离相近的障碍聚成同一排", () => {
    const clusters = trackClusters([
      at("rock", 0, 100),
      at("hurdle", 1, 101),
      at("gate", 2, 102.5),
      at("rock", 1, 140),
    ]);
    expect(clusters.length).toBe(2);
    expect(clusters[0].lanes).toEqual([null, "jump", "slide"]);
    expect(clusters[1].lanes).toEqual(["lane", null, "lane"]);
  });

  it("同一条道又要跳又要滑就是死路(一个动作办不到)", () => {
    const clusters = trackClusters([at("hurdle", 1, 200), at("gate", 1, 201)]);
    expect(clusters[0].lanes[1]).toBeNull();
  });

  it("三条道全堵死的一排会被判成走不通", () => {
    const dead = [at("rock", 0, 300), at("rock", 1, 300), at("rock", 2, 300)];
    expect(trackHasRoute(dead)).toBe(false);
    expect(trackIsFair(dead)).toBe(false);
  });

  it("速度越快,两排之间来得及横移的道数越少", () => {
    expect(maxLaneShift(30, BASE_SPEED)).toBe(2);
    expect(maxLaneShift(4, MAX_SPEED)).toBe(0);
    expect(maxLaneShift(0, MAX_SPEED)).toBe(0);
    expect(LANE_CHANGE_SECONDS).toBeGreaterThan(0);
  });

  it("挨太近又要连换两条道的组合会被判成走不通", () => {
    const cramped = [
      at("rock", 1, 500),
      at("rock", 2, 500),
      at("rock", 0, 503),
      at("rock", 1, 503),
    ];
    expect(trackHasRoute(cramped, MAX_SPEED)).toBe(false);
  });

  it("按最坏速度算,任意种子跑 8000 米都存在一条走得通的路线", () => {
    for (const seed of [1, 7, 42, 128, 999, 20260826, 31415]) {
      const track = createTrackGen(seed).ensure(8000);
      expect(trackHasRoute(track, MAX_SPEED), `种子 ${seed} 出现了走不通的路段`).toBe(true);
    }
  });

  it("赛道里真的会出现要下滑的横杆", () => {
    const track = createTrackGen(2026).ensure(6000);
    expect(track.some((e) => e.kind === "gate")).toBe(true);
    expect(track.some((e) => e.kind === "hurdle")).toBe(true);
    expect(track.some((e) => e.kind === "rock")).toBe(true);
  });
});

describe("无尽竞速结算", () => {
  it("先撞满三次的人输,跑得再远也没用", () => {
    expect(
      rushWinner({ dist: 2000, coins: 40, crashes: CRASH_LIMIT }, { dist: 300, coins: 1, crashes: 2 }),
    ).toBe(1);
    expect(
      rushWinner({ dist: 300, coins: 1, crashes: 0 }, { dist: 2000, coins: 40, crashes: CRASH_LIMIT }),
    ).toBe(0);
  });

  it("撞了两次还没出局,照旧算数", () => {
    expect(rushWinner({ dist: 900, coins: 3, crashes: 2 }, { dist: 400, coins: 9, crashes: 0 })).toBe(0);
  });

  it("两个人都没出局就退回比距离、比金币", () => {
    expect(rushWinner({ dist: 500, coins: 2, crashes: 1 }, { dist: 500, coins: 7, crashes: 0 })).toBe(1);
    expect(rushWinner({ dist: 500.2, coins: 5, crashes: 1 }, { dist: 500.9, coins: 5, crashes: 1 })).toBe(-1);
  });

  it("三次是硬规矩", () => {
    expect(CRASH_LIMIT).toBe(3);
  });
});

describe("幽灵对战", () => {
  it("标准配速曲线是一直往前、越跑越快的", () => {
    expect(baselineDistAt(0)).toBe(0);
    expect(baselineDistAt(-5)).toBe(0);
    const d1 = baselineDistAt(10);
    const d2 = baselineDistAt(20);
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(2 * d1); // 后 10 秒比前 10 秒跑得多
  });

  it("配速曲线开头的瞬时速度就是基础速度", () => {
    const v = (baselineDistAt(0.02) - baselineDistAt(0)) / 0.02;
    expect(v).toBeCloseTo(BASE_SPEED, 0);
    expect(speedAt(0)).toBe(BASE_SPEED);
  });

  it("幽灵按自己那次的成绩配速,到点就停住", () => {
    const rec = makeGhostRecord(1200, 30)!;
    expect(ghostDistAt(rec, 0)).toBe(0);
    expect(ghostDistAt(rec, 15)).toBeGreaterThan(0);
    expect(ghostDistAt(rec, 15)).toBeLessThan(1200);
    expect(ghostDistAt(rec, 30)).toBeCloseTo(1200, 6);
    expect(ghostDistAt(rec, 999)).toBe(1200);
  });

  it("跑太短的一段不值得存成幽灵", () => {
    expect(makeGhostRecord(GHOST_MIN_DIST - 1, 5)).toBeNull();
    expect(makeGhostRecord(500, 0)).toBeNull();
    expect(makeGhostRecord(Number.NaN, 10)).toBeNull();
    expect(makeGhostRecord(500, 12.345)).toEqual({ dist: 500, seconds: 12.35 });
  });

  it("只留跑得远的那一次,一样远就留用时短的", () => {
    const a = makeGhostRecord(900, 22)!;
    const b = makeGhostRecord(1300, 31)!;
    const c = makeGhostRecord(1300, 28)!;
    expect(betterGhost(a, b)).toBe(b);
    expect(betterGhost(b, c)).toBe(c);
    expect(betterGhost(null, a)).toBe(a);
    expect(betterGhost(a, null)).toBe(a);
    expect(betterGhost(null, null)).toBeNull();
  });

  it("幽灵存档写出去再读回来还是同一份", () => {
    const rec = makeGhostRecord(1234.6, 27.5)!;
    expect(parseGhostRecord(serializeGhostRecord(rec))).toEqual(rec);
  });

  it("坏存档一律当成还没有幽灵,不把游戏搞崩", () => {
    expect(parseGhostRecord(null)).toBeNull();
    expect(parseGhostRecord("")).toBeNull();
    expect(parseGhostRecord("{ 这不是 JSON")).toBeNull();
    expect(parseGhostRecord("[1,2,3]")).toBeNull();
    expect(parseGhostRecord('{"dist":"远","seconds":10}')).toBeNull();
    expect(parseGhostRecord('{"dist":10,"seconds":3}')).toBeNull();
  });
});
