import { describe, expect, it } from "vitest";
import {
  PETAL_GRAVITY,
  PETAL_LIFE_MS,
  RIBBON_COUNT,
  RIBBON_LIFE_MS,
  SPARKLE_COUNT_MAX,
  SPARKLE_COUNT_MIN,
  SPARKLE_LIFE_MS,
  drawParticles,
  easeOutBack,
  easeOutCubic,
  easeOutQuad,
  easeOutSine,
  particleAge,
  spawnPetals,
  spawnRibbons,
  spawnSparkles,
  stepParticles,
} from "./sparkle";

/** 定序随机:同一串输入永远同一串输出,粒子可复现 */
function seq(...vals: number[]): () => number {
  let i = 0;
  return () => vals[i++ % vals.length];
}

/** 只数调用的 2d 桩 */
function stubCtx(): { ctx: CanvasRenderingContext2D; calls: () => number } {
  let n = 0;
  const count = (): void => void n++;
  const ctx = {
    fillStyle: "",
    globalAlpha: 1,
    save: count,
    restore: count,
    translate: count,
    rotate: count,
    beginPath: count,
    closePath: count,
    moveTo: count,
    lineTo: count,
    ellipse: count,
    fill: count,
    fillRect: count,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls: () => n };
}

describe("art-kit · sparkle 粒子", () => {
  it("星屑默认 8–12 颗、寿命 300ms;丝带 3 条 420ms;花瓣 480ms", () => {
    expect(SPARKLE_COUNT_MIN).toBe(8);
    expect(SPARKLE_COUNT_MAX).toBe(12);
    expect(SPARKLE_LIFE_MS).toBe(300);
    expect(RIBBON_COUNT).toBe(3);
    expect(RIBBON_LIFE_MS).toBe(420);
    expect(PETAL_LIFE_MS).toBe(480);
    const stars = spawnSparkles(100, 100, { rand: seq(0.5, 0.2, 0.8) });
    expect(stars.length).toBeGreaterThanOrEqual(8);
    expect(stars.length).toBeLessThanOrEqual(12);
    for (const p of stars) expect(p.max).toBeCloseTo(0.3, 5);
    const ribbons = spawnRibbons(100, 100, { rand: seq(0.4) });
    expect(ribbons.length).toBe(3);
    for (const p of ribbons) expect(p.max).toBeCloseTo(0.42, 5);
    for (const p of spawnPetals(100, 100, { rand: seq(0.6) })) expect(p.max).toBeCloseTo(0.48, 5);
  });

  it("数量 / 寿命 / 重力全部可参数化,count 0 时一颗都不生成", () => {
    const list = spawnSparkles(0, 0, { count: 5, lifeMs: 200, gravity: 100, rand: seq(0.5) });
    expect(list.length).toBe(5);
    for (const p of list) {
      expect(p.max).toBeCloseTo(0.2, 5);
      expect(p.g).toBe(100);
    }
    expect(spawnSparkles(0, 0, { count: 0, rand: seq(0.5) }).length).toBe(0);
    expect(spawnRibbons(0, 0, { count: 0, rand: seq(0.5) }).length).toBe(0);
    expect(spawnPetals(0, 0, { count: 0, rand: seq(0.5) }).length).toBe(0);
  });

  it("stepParticles 推进位置、重力加速、寿命递减,寿终的清出去", () => {
    const [p0] = spawnPetals(50, 60, { count: 1, rand: seq(0.3, 0.8) });
    const stepped = stepParticles([p0], 0.1);
    expect(stepped.length).toBe(1);
    const p1 = stepped[0];
    expect(p1.x).not.toBe(p0.x);
    expect(p1.y).toBeCloseTo(p0.y + p0.vy * 0.1, 5);
    expect(p1.vy).toBeCloseTo(p0.vy + PETAL_GRAVITY * 0.1, 5);
    expect(p1.life).toBeCloseTo(p0.life - 0.1, 5);
    // 原数组不被改
    expect(p0.life).toBeCloseTo(0.48, 5);
    expect(stepParticles(stepped, 9).length).toBe(0);
  });

  it("particleAge 夹在 0..1;drawParticles 三种粒子都能画不抛", () => {
    const all = [
      ...spawnSparkles(10, 10, { count: 2, rand: seq(0.3) }),
      ...spawnRibbons(10, 10, { count: 1, rand: seq(0.3) }),
      ...spawnPetals(10, 10, { count: 1, rand: seq(0.3) }),
    ];
    for (const p of all) {
      expect(particleAge(p)).toBeGreaterThanOrEqual(0);
      expect(particleAge(p)).toBeLessThanOrEqual(1);
    }
    const { ctx, calls } = stubCtx();
    expect(() => drawParticles(ctx, stepParticles(all, 0.05))).not.toThrow();
    expect(calls()).toBeGreaterThan(0);
    expect(ctx.globalAlpha).toBe(1);
  });

  it("缓动曲线两端归位,easeOutBack 中段有过冲", () => {
    for (const fn of [easeOutQuad, easeOutCubic, easeOutSine, easeOutBack]) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
    expect(easeOutBack(0.7)).toBeGreaterThan(1);
    expect(easeOutQuad(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
  });
});
