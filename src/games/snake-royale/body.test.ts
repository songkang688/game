import { describe, expect, it } from "vitest";
import {
  K_B,
  MAX_NODES,
  MIN_LEN,
  R0,
  SPACING,
  START_LEN,
  TURN_RATE,
  angleDelta,
  dist,
  lenToRadius,
  lenToSpeed,
  nodeCount,
  normAngle,
  pushPath,
  sampleBody,
  steer,
  wallSlide,
  type Pt
} from "./body";

/** 一条从 (0,0) 往 +x 方向铺开的直线轨迹,path[0] 是头 */
function straightPath(len: number, step = 3): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < len; i++) out.push({ x: -i * step, y: 0 });
  return out;
}

describe("snake-royale · 长度与半径", () => {
  it("半径按 R0 + K_B√len 长,长度 0 就是 R0", () => {
    expect(lenToRadius(0)).toBeCloseTo(R0, 10);
    expect(lenToRadius(100)).toBeCloseTo(R0 + K_B * 10, 10);
    expect(lenToRadius(START_LEN)).toBeGreaterThan(R0);
  });

  it("越长越粗,而且是单调的", () => {
    let prev = -1;
    for (const len of [0, 10, 40, 90, 200, 600]) {
      const r = lenToRadius(len);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });

  it("坏数据不会算出 NaN 半径", () => {
    expect(lenToRadius(Number.NaN)).toBeCloseTo(R0, 10);
    expect(lenToRadius(-50)).toBeCloseTo(R0, 10);
    expect(Number.isFinite(lenToRadius(Number.POSITIVE_INFINITY))).toBe(true);
  });

  it("节点数有上下限,再长也不会画爆", () => {
    expect(nodeCount(0)).toBeGreaterThanOrEqual(3);
    expect(nodeCount(100000)).toBe(MAX_NODES);
    expect(nodeCount(100)).toBeGreaterThan(nodeCount(20));
  });

  it("越长越慢,但不会慢到走不动", () => {
    expect(lenToSpeed(10)).toBeGreaterThan(lenToSpeed(500));
    expect(lenToSpeed(100000)).toBeGreaterThan(0);
  });
});

describe("snake-royale · 轨迹等距采样", () => {
  it("相邻节点间距等于 spacing,误差 < 1e-6", () => {
    const nodes = sampleBody(straightPath(400), SPACING, 30);
    expect(nodes).toHaveLength(30);
    for (let i = 1; i < nodes.length; i++) {
      expect(Math.abs(dist(nodes[i - 1], nodes[i]) - SPACING)).toBeLessThan(1e-6);
    }
  });

  it("第一个节点距离头正好一个 spacing", () => {
    const path = straightPath(400);
    const nodes = sampleBody(path, SPACING, 5);
    expect(Math.abs(dist(path[0], nodes[0]) - SPACING)).toBeLessThan(1e-6);
  });

  it("拐弯的轨迹上也保持等距", () => {
    const path: Pt[] = [];
    for (let i = 0; i < 300; i++) {
      const t = i * 0.05;
      path.push({ x: Math.cos(t) * 120, y: Math.sin(t) * 120 });
    }
    const nodes = sampleBody(path, 6, 20);
    for (let i = 1; i < nodes.length; i++) {
      const chord = dist(nodes[i - 1], nodes[i]);
      // 沿轨迹的弧长严格是 6;两点直线距离(弦长)只会比弧长短一丁点
      expect(chord).toBeLessThanOrEqual(6 + 1e-9);
      expect(6 - chord).toBeLessThan(1e-3);
    }
  });

  it("轨迹不够长时尾巴收拢在末端,不抛错", () => {
    const nodes = sampleBody(straightPath(3, 2), SPACING, 10);
    expect(nodes).toHaveLength(10);
    const tail = nodes[nodes.length - 1];
    expect(Number.isFinite(tail.x)).toBe(true);
    expect(dist(tail, { x: -4, y: 0 })).toBeLessThan(1e-6);
  });

  it("空轨迹或者 0 个节点都返回空数组", () => {
    expect(sampleBody([], SPACING, 10)).toEqual([]);
    expect(sampleBody(straightPath(20), SPACING, 0)).toEqual([]);
  });

  it("轨迹里有重复点也不会卡死", () => {
    const path: Pt[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -100, y: 0 }
    ];
    const nodes = sampleBody(path, 10, 5);
    expect(nodes).toHaveLength(5);
    expect(Math.abs(dist(nodes[0], nodes[1]) - 10)).toBeLessThan(1e-6);
  });

  it("pushPath 把新头放在最前面并裁掉太旧的点", () => {
    const p0 = straightPath(10);
    const p1 = pushPath(p0, { x: 5, y: 5 }, 20);
    expect(p1[0]).toEqual({ x: 5, y: 5 });
    expect(p1.length).toBe(p0.length + 1);
    // 原数组不动
    expect(p0).toHaveLength(10);
    expect(p0[0].x).toBeCloseTo(0, 10);
    expect(p0[0].y).toBeCloseTo(0, 10);
    let long = straightPath(50);
    for (let i = 0; i < 4000; i++) long = pushPath(long, { x: i, y: 0 }, 20);
    expect(long.length).toBeLessThanOrEqual(1200);
  });
});

describe("snake-royale · 转向限速", () => {
  it("角度总是收在 (-π, π]", () => {
    expect(normAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10);
    expect(normAngle(-Math.PI * 3)).toBeCloseTo(Math.PI, 10);
    expect(normAngle(0)).toBe(0);
    expect(normAngle(Number.NaN)).toBe(0);
  });

  it("最短夹角走近路,不绕远", () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2, 10);
    expect(Math.abs(angleDelta(3, -3))).toBeLessThan(Math.PI);
  });

  it("一帧转不了 180 度 —— 禁止瞬间掉头", () => {
    const dt = 1 / 60;
    const next = steer(0, Math.PI, dt);
    expect(Math.abs(next)).toBeLessThanOrEqual(TURN_RATE * dt + 1e-9);
    expect(Math.abs(next)).toBeGreaterThan(0);
  });

  it("一帧最多转 TURN_RATE * dt", () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
      const next = steer(1, 1 + Math.PI * 0.9, dt);
      expect(Math.abs(angleDelta(1, next))).toBeLessThanOrEqual(TURN_RATE * dt + 1e-9);
    }
  });

  it("目标已经很近就直接对齐,不会来回抖", () => {
    const next = steer(0, 0.001, 1 / 60);
    expect(next).toBeCloseTo(0.001, 10);
  });

  it("掉头要好几帧才转得过来", () => {
    let a = 0;
    let frames = 0;
    while (Math.abs(angleDelta(a, Math.PI)) > 0.01 && frames < 500) {
      a = steer(a, Math.PI, 1 / 60);
      frames++;
    }
    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(500);
  });
});

describe("snake-royale · 撞围栏只是滑一下", () => {
  it("圈内不做任何处理", () => {
    const out = wallSlide({ x: 10, y: 0 }, 0, 100);
    expect(out.hit).toBe(false);
    expect(out.slowdown).toBe(1);
    expect(out.x).toBe(10);
  });

  it("出界会被贴回围栏内侧并减速,但不淘汰", () => {
    const out = wallSlide({ x: 150, y: 0 }, 0, 100);
    expect(out.hit).toBe(true);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(100, 6);
    expect(out.slowdown).toBeLessThan(1);
    expect(out.slowdown).toBeGreaterThan(0);
  });

  it("滑行方向是围栏的切线,不会直接反弹回头", () => {
    const out = wallSlide({ x: 150, y: 0 }, 0.2, 100);
    // 切线在 x=+R 处是 ±y 方向
    expect(Math.abs(Math.cos(out.angle))).toBeLessThan(1e-6);
    expect(Math.abs(Math.sin(out.angle))).toBeCloseTo(1, 6);
  });

  it("最短的蛇也不短于 MIN_LEN 这个下限常量", () => {
    expect(MIN_LEN).toBeGreaterThan(0);
    expect(START_LEN).toBeGreaterThan(MIN_LEN);
  });
});
