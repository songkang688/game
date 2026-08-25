import { describe, expect, it } from "vitest";
import {
  GRAVITY,
  MAX_BUFFER_RATIO,
  MAX_LAUNCH,
  WORLD_H,
  WORLD_W,
  calcStars,
  canvasBufferHeight,
  circleRectHit,
  circleSlopeHit,
  impactDamage,
  launchVelocity,
  makeRng,
  padSplit,
  simulateTrajectory,
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

describe("sling-birds 竖屏画布自适应", () => {
  it("横屏(舞台比世界扁)保持原始世界高度,不延展", () => {
    expect(canvasBufferHeight(800, 400)).toBe(WORLD_H);
    expect(canvasBufferHeight(WORLD_W, WORLD_H)).toBe(WORLD_H);
  });
  it("竖屏按舞台宽高比向上取,填满舞台", () => {
    // 412×915 手机:舞台约 380×760 → 760/380*540 = 1080,超过上限被夹住
    expect(canvasBufferHeight(380, 570)).toBe(Math.round((570 / 380) * WORLD_W));
    expect(canvasBufferHeight(380, 570)).toBeGreaterThan(WORLD_H);
  });
  it("再高也不超过上限倍数,避免无限拉天空", () => {
    const max = Math.round(WORLD_H * MAX_BUFFER_RATIO);
    expect(canvasBufferHeight(380, 5000)).toBe(max);
  });
  it("空间量不出来(0/负数)时退回原始高度", () => {
    expect(canvasBufferHeight(0, 500)).toBe(WORLD_H);
    expect(canvasBufferHeight(400, 0)).toBe(WORLD_H);
  });
  it("延展高度拆成天空大头 + 泥土装饰,合计守恒", () => {
    expect(padSplit(WORLD_H)).toEqual({ sky: 0, ground: 0 });
    const p = padSplit(WORLD_H + 200);
    expect(p.sky + p.ground).toBe(200);
    expect(p.sky).toBeGreaterThan(p.ground);
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

describe("sling-birds 弹道预览与实弹一致(simulateTrajectory)", () => {
  it("与飞行积分逐子步一致(半隐式欧拉:先加重力再挪位置)", () => {
    // 手工复现 stepBirds 的积分顺序,预览必须逐点吻合
    const sub = 1 / 180;
    let x = 74;
    let y = 236;
    let vx = 300;
    let vy = -260;
    const expected: Array<{ x: number; y: number }> = [];
    let acc = 0;
    while (expected.length < 6) {
      vy += GRAVITY * sub;
      x += vx * sub;
      y += vy * sub;
      acc += sub;
      if (acc >= 0.07 - 1e-9) {
        expected.push({ x, y });
        acc = 0;
      }
    }
    const pts = simulateTrajectory(74, 236, 300, -260, 1, [], 6, 0.07, sub);
    expect(pts.length).toBe(6);
    pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i].x, 6);
      expect(p.y).toBeCloseTo(expected[i].y, 6);
    });
  });

  it("重力系数小的小鸟(糯糯 0.75)同时刻下坠更少", () => {
    const heavy = simulateTrajectory(74, 236, 300, -200, 1, [], 10, 0.07);
    const floaty = simulateTrajectory(74, 236, 300, -200, 0.75, [], 10, 0.07);
    expect(floaty[9].y).toBeLessThan(heavy[9].y);
    // 水平速度不受重力系数影响
    expect(floaty[9].x).toBeCloseTo(heavy[9].x, 6);
  });

  it("穿过风区时被风推着走,预览终点明显偏移", () => {
    const wind = { x: 0, y: 0, w: 540, h: 340, fx: 400, fy: 0 };
    const calm = simulateTrajectory(74, 236, 200, -220, 1, [], 12, 0.07);
    const windy = simulateTrajectory(74, 236, 200, -220, 1, [wind], 12, 0.07);
    expect(windy[11].x).toBeGreaterThan(calm[11].x + 30);
    // 纯横向风不改变纵向运动
    expect(windy[11].y).toBeCloseTo(calm[11].y, 6);
  });

  it("风区只在区域内生效,区域外弹道不受影响", () => {
    const farWind = { x: 5000, y: 5000, w: 10, h: 10, fx: 900, fy: 900 };
    const calm = simulateTrajectory(74, 236, 200, -220, 1, [], 12, 0.07);
    const unaffected = simulateTrajectory(74, 236, 200, -220, 1, [farWind], 12, 0.07);
    unaffected.forEach((p, i) => {
      expect(p.x).toBeCloseTo(calm[i].x, 9);
      expect(p.y).toBeCloseTo(calm[i].y, 9);
    });
  });

  it("同参数两次调用完全一致(确定性,预览即实弹)", () => {
    const wind = { x: 100, y: 0, w: 200, h: 300, fx: -180, fy: 60 };
    const a = simulateTrajectory(74, 236, 320, -300, 0.75, [wind], 13, 0.07);
    const b = simulateTrajectory(74, 236, 320, -300, 0.75, [wind], 13, 0.07);
    expect(a).toEqual(b);
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
