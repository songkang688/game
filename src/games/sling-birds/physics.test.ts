import { describe, expect, it } from "vitest";
import {
  MAX_LAUNCH,
  calcStars,
  circleRectHit,
  circleSlopeHit,
  impactDamage,
  launchVelocity,
  makeRng,
  slopeSurfaceY,
  trajectoryPoints
} from "./physics";

describe("sling-birds 评分", () => {
  it("剩 2 只鸟以上 3 星", () => {
    expect(calcStars(2, 0)).toBe(3);
    expect(calcStars(3, 0.2)).toBe(3);
  });
  it("剩 1 只鸟:破坏率高补 3 星,否则 2 星", () => {
    expect(calcStars(1, 0.9)).toBe(3);
    expect(calcStars(1, 0.84)).toBe(2);
    expect(calcStars(1, 0)).toBe(2);
  });
  it("鸟用光:破坏率 60% 以上 2 星,否则 1 星", () => {
    expect(calcStars(0, 0.65)).toBe(2);
    expect(calcStars(0, 0.5)).toBe(1);
    expect(calcStars(0, 0)).toBe(1);
  });
});

describe("sling-birds 弹弓", () => {
  it("发射方向与拖拽方向相反", () => {
    const v = launchVelocity(20, 15); // 往右下拉
    expect(v.vx).toBeLessThan(0);
    expect(v.vy).toBeLessThan(0);
  });
  it("速度有上限", () => {
    const v = launchVelocity(500, 500);
    expect(Math.hypot(v.vx, v.vy)).toBeLessThanOrEqual(MAX_LAUNCH + 0.001);
  });
  it("弹道预览受重力往下弯", () => {
    const pts = trajectoryPoints(0, 0, 100, -100, 20, 0.1);
    expect(pts.length).toBe(20);
    expect(pts[19].y).toBeGreaterThan(pts[0].y);
    expect(pts[19].x).toBeGreaterThan(pts[0].x);
  });
});

describe("sling-birds 碰撞", () => {
  it("圆从左边撞矩形", () => {
    const hit = circleRectHit(95, 50, 10, 100, 0, 50, 100);
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(-1);
    expect(hit!.depth).toBeCloseTo(5);
  });
  it("离得远就不撞", () => {
    expect(circleRectHit(50, 50, 10, 100, 100, 40, 40)).toBeNull();
  });
  it("圆心在矩形内部也能推出去", () => {
    const hit = circleRectHit(120, 10, 8, 100, 0, 40, 100);
    expect(hit).not.toBeNull();
    expect(hit!.ny).toBe(-1);
  });

  const slope = { x: 0, y: 100, w: 100, h: 100, dir: "up-right" as const };
  it("斜坡表面高度", () => {
    expect(slopeSurfaceY(slope, 0)).toBe(200);
    expect(slopeSurfaceY(slope, 100)).toBe(100);
    expect(slopeSurfaceY(slope, 50)).toBe(150);
  });
  it("圆压到斜坡表面会被朝上推出", () => {
    const hit = circleSlopeHit(50, 140, 12, slope);
    expect(hit).not.toBeNull();
    expect(hit!.ny).toBeLessThan(0);
    expect(hit!.depth).toBeGreaterThan(0);
  });
  it("圆在斜坡上方够远就不撞", () => {
    expect(circleSlopeHit(50, 120, 12, slope)).toBeNull();
  });
  it("圆陷进斜坡内部会被整体顶出来", () => {
    const hit = circleSlopeHit(50, 180, 10, slope);
    expect(hit).not.toBeNull();
    expect(hit!.ny).toBeLessThan(0);
    expect(hit!.depth).toBeGreaterThan(10);
  });
});

describe("sling-birds 伤害与随机数", () => {
  it("轻轻蹭一下不掉血", () => {
    expect(impactDamage(50, 1, 1)).toBe(0);
    expect(impactDamage(200, 1, 1)).toBeGreaterThan(0);
  });
  it("玻璃比石头脆", () => {
    expect(impactDamage(300, 1, 2.6)).toBeGreaterThan(impactDamage(300, 1, 0.55));
  });
  it("同种子随机序列一致,且都在 [0,1)", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});
