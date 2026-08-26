// 自写圆碰撞物理的硬指标:不爆能量、不漏球、静止与越线判得准。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  GRACE_MS,
  MAX_SUBSTEPS,
  SETTLE_MS,
  SETTLE_SPEED,
  SUB_DT,
  addFruit,
  allSettled,
  createWorld,
  heightMap,
  inGrace,
  isSettled,
  kineticEnergy,
  massOf,
  nearLine,
  overLine,
  resolveBounds,
  resolveCircles,
  stackTop,
  stepPhysics,
  substep,
  type World,
} from "./physics";

function emptyWorld(over: Partial<Parameters<typeof createWorld>[0]> = {}): World {
  return createWorld({ box: { w: 300, h: 430 }, lineY: 96, seed: 7, ...over });
}

/** 一盆随机方向乱飞的果子:重力和阻尼都关掉,只剩碰撞在起作用 */
function chaosWorld(): World {
  const world = emptyWorld({
    tuning: { gravity: 0, damping: 1, restitution: 0.9, friction: 0.28, wallFriction: 0.2 },
  });
  const rand = mulberry32(20260826);
  for (let i = 0; i < 14; i++) {
    addFruit(world, {
      level: i % 4,
      x: 30 + rand() * 240,
      y: 40 + rand() * 340,
      r: 12 + (i % 4) * 5,
      vx: (rand() - 0.5) * 900,
      vy: (rand() - 0.5) * 900,
      graceMs: 0,
    });
  }
  return world;
}

describe("固定步长下不会爆能量", () => {
  it("关掉重力,连续 100 个子步总动能一步都不许往上走", () => {
    const world = chaosWorld();
    let prev = kineticEnergy(world);
    expect(prev).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) {
      substep(world, SUB_DT);
      const now = kineticEnergy(world);
      expect(now, `第 ${i + 1} 个子步动能从 ${prev} 涨到了 ${now}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = now;
    }
  });

  it("完全弹性(e=1)也不许涨:这是最容易算出能量的一档", () => {
    const world = chaosWorld();
    world.tuning.restitution = 1;
    world.tuning.friction = 0;
    let prev = kineticEnergy(world);
    for (let i = 0; i < 100; i++) {
      substep(world, SUB_DT);
      const now = kineticEnergy(world);
      expect(now).toBeLessThanOrEqual(prev + 1e-9);
      prev = now;
    }
  });

  it("开着重力堆一整盆,速度也不会跑飞", () => {
    const world = emptyWorld();
    for (let i = 0; i < 16; i++) {
      addFruit(world, { level: 1, x: 40 + (i % 5) * 50, y: 40 + Math.floor(i / 5) * 46, r: 16, graceMs: 0 });
    }
    for (let i = 0; i < 900; i++) substep(world, SUB_DT);
    for (const f of world.fruits) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
      expect(Math.abs(f.vx)).toBeLessThan(400);
      expect(Math.abs(f.vy)).toBeLessThan(400);
    }
  });
});

describe("圆与圆", () => {
  it("两颗叠在一起会被推开,推完不再重叠那么多", () => {
    const world = emptyWorld();
    const a = addFruit(world, { level: 2, x: 150, y: 200, r: 20, graceMs: 0 });
    const b = addFruit(world, { level: 2, x: 158, y: 200, r: 20, graceMs: 0 });
    const before = Math.abs(b.x - a.x);
    for (let i = 0; i < 30; i++) resolveCircles(a, b, world.tuning);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(before);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(38);
  });

  it("没碰上就什么都不做", () => {
    const world = emptyWorld();
    const a = addFruit(world, { level: 0, x: 60, y: 200, r: 10, graceMs: 0 });
    const b = addFruit(world, { level: 0, x: 200, y: 200, r: 10, graceMs: 0 });
    expect(resolveCircles(a, b, world.tuning)).toBe(false);
    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it("迎面相撞之后是分开的,不会互相穿过去", () => {
    const world = emptyWorld();
    const a = addFruit(world, { level: 3, x: 140, y: 200, r: 18, vx: 200, graceMs: 0 });
    const b = addFruit(world, { level: 3, x: 174, y: 200, r: 18, vx: -200, graceMs: 0 });
    resolveCircles(a, b, world.tuning);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("轻的那颗被撞得更远:冲量按质量分", () => {
    const world = emptyWorld();
    const heavy = addFruit(world, { level: 8, x: 150, y: 200, r: 42, vx: 300, graceMs: 0 });
    const light = addFruit(world, { level: 0, x: 198, y: 200, r: 9, graceMs: 0 });
    resolveCircles(heavy, light, world.tuning);
    expect(light.vx).toBeGreaterThan(Math.abs(heavy.vx - 300));
  });

  it("质量正比于半径的平方", () => {
    expect(massOf(20) / massOf(10)).toBeCloseTo(4, 6);
  });
});

describe("墙与地面", () => {
  it("左右两堵墙都夹得住", () => {
    const world = emptyWorld();
    const a = addFruit(world, { level: 1, x: -30, y: 100, r: 11, vx: -400, graceMs: 0 });
    expect(resolveBounds(a, world.box, world.tuning)).toBe(true);
    expect(a.x).toBe(11);
    expect(a.vx).toBeGreaterThan(0);
    const b = addFruit(world, { level: 1, x: 999, y: 100, r: 11, vx: 400, graceMs: 0 });
    resolveBounds(b, world.box, world.tuning);
    expect(b.x).toBe(300 - 11);
    expect(b.vx).toBeLessThan(0);
  });

  it("地面接得住,一整盆果子跑很久也没有一颗漏出去", () => {
    const world = emptyWorld();
    for (let i = 0; i < 12; i++) {
      addFruit(world, { level: 2, x: 20 + i * 22, y: 20 + i * 9, r: 13.5, vx: (i % 2 ? 1 : -1) * 420, vy: 500, graceMs: 0 });
    }
    for (let i = 0; i < 1200; i++) substep(world, SUB_DT);
    for (const f of world.fruits) {
      expect(f.x).toBeGreaterThanOrEqual(f.r - 0.01);
      expect(f.x).toBeLessThanOrEqual(world.box.w - f.r + 0.01);
      expect(f.y).toBeLessThanOrEqual(world.box.h - f.r + 0.01);
    }
  });

  it("弹性越大反弹越高", () => {
    const soft = emptyWorld({ tuning: { restitution: 0.1 } });
    const hard = emptyWorld({ tuning: { restitution: 0.8 } });
    const a = addFruit(soft, { level: 2, x: 150, y: 420, r: 13.5, vy: 400, graceMs: 0 });
    const b = addFruit(hard, { level: 2, x: 150, y: 420, r: 13.5, vy: 400, graceMs: 0 });
    resolveBounds(a, soft.box, soft.tuning);
    resolveBounds(b, hard.box, hard.tuning);
    expect(Math.abs(b.vy)).toBeGreaterThan(Math.abs(a.vy));
  });
});

describe("静止与宽限期", () => {
  it("连续低速够久才算停稳", () => {
    const world = emptyWorld({ tuning: { gravity: 0 } });
    const f = addFruit(world, { level: 1, x: 150, y: 400, r: 11, graceMs: 0 });
    expect(isSettled(f)).toBe(false);
    for (let i = 0; i < 20; i++) substep(world, SUB_DT);
    expect(f.restMs).toBeGreaterThan(0);
    expect(isSettled(f)).toBe(false);
    for (let i = 0; i < 40; i++) substep(world, SUB_DT);
    expect(f.restMs).toBeGreaterThanOrEqual(SETTLE_MS);
    expect(isSettled(f)).toBe(true);
  });

  it("还在飞的果子不算停稳", () => {
    const world = emptyWorld({ tuning: { gravity: 0, damping: 1 } });
    const f = addFruit(world, { level: 1, x: 150, y: 200, r: 11, vx: SETTLE_SPEED * 6, graceMs: 0 });
    for (let i = 0; i < 60; i++) substep(world, SUB_DT);
    expect(isSettled(f)).toBe(false);
  });

  it("刚落下的果子有宽限期,时间到了自动解除", () => {
    const world = emptyWorld();
    const f = addFruit(world, { level: 0, x: 150, y: 40, r: 9 });
    expect(inGrace(f)).toBe(true);
    expect(f.graceMs).toBe(GRACE_MS);
    for (let i = 0; i < 130; i++) substep(world, SUB_DT);
    expect(inGrace(f)).toBe(false);
  });
});

describe("越线只看停稳的果子", () => {
  it("停稳的果子圆心过线才算输", () => {
    const world = emptyWorld({ tuning: { gravity: 0 } });
    const f = addFruit(world, { level: 4, x: 150, y: 60, r: 20, graceMs: 0 });
    expect(overLine(world)).toBe(false);
    for (let i = 0; i < 60; i++) substep(world, SUB_DT);
    expect(isSettled(f)).toBe(true);
    expect(overLine(world)).toBe(true);
  });

  it("圆心还在线下面就不算,哪怕上半个身子冒出去了", () => {
    const world = emptyWorld({ tuning: { gravity: 0 } });
    addFruit(world, { level: 6, x: 150, y: 100, r: 29, graceMs: 0 });
    for (let i = 0; i < 60; i++) substep(world, SUB_DT);
    expect(overLine(world)).toBe(false);
  });

  it("宽限期里的果子不参与判定", () => {
    const world = emptyWorld({ tuning: { gravity: 0 } });
    const f = addFruit(world, { level: 4, x: 150, y: 50, r: 20, graceMs: GRACE_MS });
    for (let i = 0; i < 60; i++) substep(world, SUB_DT);
    expect(isSettled(f)).toBe(true);
    expect(inGrace(f)).toBe(true);
    expect(overLine(world)).toBe(false);
  });

  it("快贴到线了会先给警告", () => {
    const world = emptyWorld();
    expect(nearLine(world)).toBe(false);
    const f = addFruit(world, { level: 5, x: 150, y: 118, r: 24, graceMs: GRACE_MS });
    // 刚投下的那一颗天生就在线上方,宽限期里不该让警戒线闪
    expect(nearLine(world)).toBe(false);
    f.graceMs = 0;
    expect(nearLine(world)).toBe(true);
  });
});

describe("推进与工具", () => {
  it("同样的输入推出同样的结果:回放才复现得了", () => {
    const build = (): World => {
      const w = emptyWorld();
      for (let i = 0; i < 8; i++) addFruit(w, { level: 1, x: 40 + i * 28, y: 30 + i * 12, r: 11, graceMs: 0 });
      return w;
    };
    const a = build();
    const b = build();
    for (let i = 0; i < 200; i++) {
      stepPhysics(a, 16);
      stepPhysics(b, 16);
    }
    for (let i = 0; i < a.fruits.length; i++) {
      expect(a.fruits[i].x).toBe(b.fruits[i].x);
      expect(a.fruits[i].y).toBe(b.fruits[i].y);
    }
  });

  it("巨大的 dt 会被钳住,一帧最多跑 MAX_SUBSTEPS 个子步", () => {
    const world = emptyWorld();
    addFruit(world, { level: 1, x: 150, y: 60, r: 11, graceMs: 0 });
    expect(stepPhysics(world, 5000)).toBe(MAX_SUBSTEPS);
    expect(stepPhysics(world, 4)).toBe(0);
  });

  it("高度图能看出哪一列低洼", () => {
    const world = emptyWorld();
    addFruit(world, { level: 5, x: 30, y: 200, r: 24, graceMs: 0 });
    const map = heightMap(world, 6);
    expect(map[0]).toBeLessThan(map[5]);
    expect(map[5]).toBe(world.box.h);
  });

  it("空盆的堆顶就是盆底,全场停稳的判断也对", () => {
    const world = emptyWorld({ tuning: { gravity: 0 } });
    expect(stackTop(world)).toBe(world.box.h);
    expect(allSettled(world)).toBe(true);
    addFruit(world, { level: 1, x: 150, y: 300, r: 11, graceMs: 0 });
    expect(allSettled(world)).toBe(false);
    for (let i = 0; i < 60; i++) substep(world, SUB_DT);
    expect(allSettled(world)).toBe(true);
    expect(stackTop(world)).toBeCloseTo(300 - 11, 3);
  });
});
