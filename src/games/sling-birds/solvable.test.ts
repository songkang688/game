/**
 * 1.2 第 12 步 A 档:关卡可解性。
 *
 * 不是估算,是真的用 world.ts(线上同一套固定步长物理)把弹道打一遍:
 * sim.ts 按目标反解抛射角、配技能时机、再爬山微调,能把绿绿豆清空才算「这一关通得了」。
 * 抽样覆盖九个章节,并按规格点名验 100 / 145 / 188。
 */
import { describe, expect, it } from "vitest";
import { towerRound } from "./endless";
import { LEVELS, chapterOfId } from "./levels";
import { MAX_REACH_SPEED, aimAt, findSolution, playShot, velocityToDrag } from "./sim";
import { GROUND_Y, MAX_DRAG, SLING_X, SLING_Y } from "./physics";
import { beansAlive, createWorld } from "./world";

/** 抽样 24 关:九章都有,含点名的 100 / 145 / 188 与最后一章的硬骨头 */
const SAMPLE = [1, 8, 15, 22, 30, 38, 45, 52, 60, 71, 80, 88, 99, 100, 112, 118, 125, 133, 145, 150, 160, 172, 181, 188];

describe("sling-birds 1.2 抛射反解", () => {
  it("反解出来的两条弧线都真的能砸中目标(高抛与平射)", () => {
    // 云云的重力系数是 1,反解用同一个系数
    const target = { x: 380, y: GROUND_Y - 10 };
    const shots = aimAt(target.x, target.y, MAX_REACH_SPEED * 0.9, 1);
    expect(shots.length).toBe(2);
    for (const s of shots) {
      expect(Math.hypot(s.dragX, s.dragY)).toBeLessThanOrEqual(MAX_DRAG + 1e-9);
      const w = createWorld({ blocks: [], beans: [target] });
      playShot(w, "split", s, 4);
      expect(beansAlive(w)).toBe(0);
    }
  });

  it("同一个目标一般有两条弧线(高抛与平射),太远则一条都没有", () => {
    expect(aimAt(300, 240, MAX_REACH_SPEED, 1).length).toBe(2);
    expect(aimAt(300, 240, 40, 1).length).toBe(0);
  });

  it("超出拉弓上限的速度会被判定为「拉不到」", () => {
    expect(velocityToDrag(MAX_DRAG * 9.6 * 2, 0)).toBeNull();
    expect(velocityToDrag(100, -100)).not.toBeNull();
  });
});

describe("sling-birds 关卡可解性(抽样 24 关,含 100 / 145 / 188)", () => {
  it("抽样覆盖全部九个章节,且包含点名的三关", () => {
    expect(SAMPLE.length).toBeGreaterThanOrEqual(20);
    expect(SAMPLE).toContain(100);
    expect(SAMPLE).toContain(145);
    expect(SAMPLE).toContain(188);
    expect(new Set(SAMPLE.map((id) => chapterOfId(id))).size).toBe(9);
  });

  it.each(SAMPLE)("第 %i 关存在一条能通关的弹道", (id) => {
    const level = LEVELS.find((l) => l.id === id);
    expect(level, `找不到第 ${id} 关`).toBeTruthy();
    const sol = findSolution(level!);
    expect(sol.solved, `第 ${id} 关没找到解:还剩 ${sol.beansLeft} 颗豆`).toBe(true);
    // 给出的解必须是玩家真拉得出来的(不超过 MAX_DRAG)
    for (const s of sol.shots) {
      expect(Math.hypot(s.dragX, s.dragY)).toBeLessThanOrEqual(MAX_DRAG + 1e-9);
    }
    expect(sol.used).toBeLessThanOrEqual(level!.birds.length);
  }, 60000);

  it("解出来的弹道回放一遍还是能通关(确定性,不是撞大运)", () => {
    const level = LEVELS.find((l) => l.id === 145)!;
    const sol = findSolution(level);
    expect(sol.solved).toBe(true);
    const replay = createWorld(level);
    sol.shots.forEach((shot, i) => {
      if (beansAlive(replay) === 0) return;
      playShot(replay, level.birds[i], shot, 4.6);
    });
    expect(beansAlive(replay)).toBe(0);
  }, 60000);

  it("拿一发乱打的弹道当对照:清不了台(说明解算器不是随便返回 true)", () => {
    const level = LEVELS.find((l) => l.id === 188)!;
    const w = createWorld(level);
    const before = beansAlive(w);
    // 朝天上打,谁也碰不到
    playShot(w, level.birds[0], { dragX: 0.5, dragY: MAX_DRAG - 0.5, skillAt: null }, 4.6);
    expect(beansAlive(w)).toBe(before);
  });
});

describe("sling-birds 无尽打靶塔也要打得动", () => {
  it.each([1, 4, 8, 12])("第 %i 座塔用固定弹数能清台", (round) => {
    const sol = findSolution(towerRound(round));
    expect(sol.solved, `第 ${round} 座塔清不掉,还剩 ${sol.beansLeft} 颗`).toBe(true);
  }, 60000);

  it("弹弓够得到最远的一座塔的塔顶", () => {
    const round = towerRound(12);
    const far = round.beans[round.beans.length - 1];
    const shots = aimAt(far.x, far.y, MAX_REACH_SPEED, 1, SLING_X, SLING_Y);
    expect(shots.length).toBeGreaterThan(0);
  });
});
