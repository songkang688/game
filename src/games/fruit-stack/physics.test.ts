import { describe, expect, it } from "vitest";
import {
  DROP_GRACE_MS,
  SETTLE_MS,
  SETTLE_SPEED,
  addCircle,
  allSettled,
  isSettled,
  kineticEnergy,
  makeWorld,
  massOf,
  nearLine,
  overLine,
  resolveBounds,
  resolveCircles,
  stackTop,
  stepPhysics,
  substep,
  type Box,
} from "./physics";

const BOX: Box = { left: 0, right: 300, floor: 400, line: 80 };

describe("果果合成 · 自写物理", () => {
  it("质量随半径平方增长", () => {
    expect(massOf(20)).toBeGreaterThan(massOf(10));
    expect(massOf(20) / massOf(10)).toBeCloseTo(4, 5);
  });

  it("两个重叠的圆会被推开", () => {
    const world = makeWorld(BOX);
    const a = addCircle(world, 0, 100, 200, 20);
    const b = addCircle(world, 0, 110, 200, 20);
    expect(resolveCircles(a, b, 0.2)).toBe(true);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(10);
  });

  it("完全重合的两个圆也能安全分开（不会出 NaN）", () => {
    const world = makeWorld(BOX);
    const a = addCircle(world, 0, 100, 200, 20);
    const b = addCircle(world, 0, 100, 200, 20);
    resolveCircles(a, b, 0.2);
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(b.x)).toBe(true);
    expect(a.x).not.toBe(b.x);
  });

  it("没碰上的两个圆不会互相影响", () => {
    const world = makeWorld(BOX);
    const a = addCircle(world, 0, 50, 200, 20);
    const b = addCircle(world, 0, 200, 200, 20);
    expect(resolveCircles(a, b, 0.2)).toBe(false);
  });

  it("容器不漏球：任何一颗都被夹在边界里", () => {
    const world = makeWorld(BOX);
    for (let i = 0; i < 12; i++) {
      const c = addCircle(world, 2, 20 + i * 22, 100 + i * 6, 20);
      c.vx = (i % 2 === 0 ? 1 : -1) * 900;
      c.vy = 600;
    }
    for (let i = 0; i < 400; i++) stepPhysics(world, 16);
    for (const c of world.circles) {
      expect(c.x).toBeGreaterThanOrEqual(BOX.left + c.r - 0.5);
      expect(c.x).toBeLessThanOrEqual(BOX.right - c.r + 0.5);
      expect(c.y).toBeLessThanOrEqual(BOX.floor - c.r + 0.5);
    }
  });

  it("固定步长下总动能不会增长（关掉重力后跑 100 个子步）", () => {
    const world = makeWorld({ ...BOX }, { gravity: 0 });
    for (let i = 0; i < 8; i++) {
      const c = addCircle(world, 3, 40 + i * 30, 200 + (i % 3) * 18, 22);
      c.vx = (i % 2 === 0 ? 1 : -1) * 240;
      c.vy = (i % 3 === 0 ? 1 : -1) * 180;
    }
    const start = kineticEnergy(world);
    let prev = start;
    for (let i = 0; i < 100; i++) {
      substep(world, 1 / 120);
      const now = kineticEnergy(world);
      expect(now).toBeLessThanOrEqual(prev + 1e-6);
      prev = now;
    }
    expect(prev).toBeLessThanOrEqual(start);
  });

  it("落地之后会被判定为静止", () => {
    const world = makeWorld(BOX);
    addCircle(world, 1, 150, 100, 18);
    for (let i = 0; i < 300; i++) stepPhysics(world, 16);
    expect(allSettled(world)).toBe(true);
    expect(isSettled(world.circles[0])).toBe(true);
    expect(world.circles[0].restMs).toBeGreaterThanOrEqual(SETTLE_MS);
  });

  it("越线只看已经静止的果子", () => {
    const world = makeWorld(BOX);
    const c = addCircle(world, 5, 150, BOX.line - 20, 30);
    // 还在宽限期 + 还没静止：不算越线
    expect(overLine(world)).toEqual([]);
    c.graceMs = 0;
    c.restMs = 0;
    expect(overLine(world)).toEqual([]);
    c.restMs = SETTLE_MS;
    expect(overLine(world)).toEqual([c.id]);
  });

  it("刚落下的果子有宽限期，宽限期内不判越线", () => {
    const world = makeWorld(BOX);
    const c = addCircle(world, 5, 150, BOX.line - 20, 30);
    c.restMs = SETTLE_MS;
    expect(c.graceMs).toBe(DROP_GRACE_MS);
    expect(overLine(world)).toEqual([]);
  });

  it("警戒线预警在接近时就亮起来", () => {
    const world = makeWorld(BOX);
    addCircle(world, 4, 150, BOX.line + 40, 24);
    expect(nearLine(world, 30)).toBe(true);
    expect(nearLine(world, 2)).toBe(false);
  });

  it("stackTop 报告容器里最高的一点", () => {
    const world = makeWorld(BOX);
    addCircle(world, 2, 100, 380, 18);
    addCircle(world, 2, 200, 300, 18);
    expect(stackTop(world)).toBe(300 - 18);
  });

  it("边界解算会吃掉法向速度，不会越弹越高", () => {
    const world = makeWorld(BOX);
    const c = addCircle(world, 2, 150, BOX.floor - 6, 18);
    c.vy = 500;
    resolveBounds(c, BOX, 0.22, 0.06);
    expect(Math.abs(c.vy)).toBeLessThan(500);
    expect(c.y).toBeLessThanOrEqual(BOX.floor - c.r + 1e-6);
  });

  it("速度低于阈值才开始累计静止时间", () => {
    const world = makeWorld({ ...BOX }, { gravity: 0 });
    const c = addCircle(world, 1, 150, 200, 16);
    c.vx = SETTLE_SPEED * 10;
    stepPhysics(world, 16);
    expect(c.restMs).toBe(0);
    c.vx = 0;
    c.vy = 0;
    stepPhysics(world, 16);
    expect(c.restMs).toBeGreaterThan(0);
  });
});
