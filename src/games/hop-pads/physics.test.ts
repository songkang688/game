/**
 * 跳跳台 · 蓄力与飞行的回归。
 *
 * 规格第十三节点名要的:powerFromHold 单调且封顶、landPoint 与力度单调、分数公式。
 */
import { describe, expect, it } from "vitest";
import {
  BASE_SCORE,
  COMBO_CAP,
  MAX_APEX,
  MAX_DIST,
  MAX_HOLD,
  MIN_APEX,
  MIN_DIST,
  PERFECT_R,
  REACH_MAX,
  REACH_MIN,
  comboMultiplier,
  dist2d,
  flightPoint,
  flightTime,
  jumpApex,
  jumpDistance,
  landPoint,
  powerForDistance,
  powerFromHold,
  score,
  yawTo,
} from "./physics";

describe("蓄力映射 powerFromHold", () => {
  it("按住越久力度越大,一路严格单调", () => {
    let prev = -1;
    for (let ms = 0; ms <= MAX_HOLD; ms += 30) {
      const p = powerFromHold(ms);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it("蓄满就封顶,按到天荒地老也只有 1", () => {
    expect(powerFromHold(MAX_HOLD)).toBe(1);
    expect(powerFromHold(MAX_HOLD * 3)).toBe(1);
    expect(powerFromHold(999_999)).toBe(1);
  });

  it("没按住、乱传值都当 0,不会冒出 NaN", () => {
    expect(powerFromHold(0)).toBe(0);
    expect(powerFromHold(-500)).toBe(0);
    expect(powerFromHold(Number.NaN)).toBe(0);
  });

  it("是线性的:按住一半时间正好拿到一半力度", () => {
    expect(powerFromHold(MAX_HOLD / 2)).toBeCloseTo(0.5, 10);
    expect(powerFromHold(MAX_HOLD / 4)).toBeCloseTo(0.25, 10);
  });
});

describe("射程 / 高度 / 飞行时长", () => {
  it("三样都随力度单调增加(蓄得久就跳得远、跳得高、飞得久)", () => {
    let d = -1;
    let h = -1;
    let t = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      expect(jumpDistance(p)).toBeGreaterThan(d);
      expect(jumpApex(p)).toBeGreaterThan(h);
      expect(flightTime(p)).toBeGreaterThan(t);
      d = jumpDistance(p);
      h = jumpApex(p);
      t = flightTime(p);
    }
  });

  it("两头正好是写死的常量", () => {
    expect(jumpDistance(0)).toBe(MIN_DIST);
    expect(jumpDistance(1)).toBe(MAX_DIST);
    expect(jumpApex(0)).toBe(MIN_APEX);
    expect(jumpApex(1)).toBe(MAX_APEX);
  });

  it("powerForDistance 是 jumpDistance 的精确反函数", () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      expect(powerForDistance(jumpDistance(p))).toBeCloseTo(Math.min(1, p), 10);
    }
  });

  it("可达区间对应的射程区间是明确的,两头都留得出手", () => {
    expect(jumpDistance(REACH_MIN)).toBeGreaterThan(MIN_DIST);
    expect(jumpDistance(REACH_MAX)).toBeLessThan(MAX_DIST);
    expect(powerForDistance(jumpDistance(REACH_MIN))).toBeCloseTo(REACH_MIN, 10);
    expect(powerForDistance(jumpDistance(REACH_MAX))).toBeCloseTo(REACH_MAX, 10);
  });
});

describe("落点 landPoint", () => {
  const p0 = { x: 0, z: 0 };

  it("力度越大落点越远,严格单调", () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const d = dist2d(p0, landPoint(p0, p, 0));
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });

  it("笔直往前跳时只有纵深变化", () => {
    const hit = landPoint(p0, 0.5, 0);
    expect(hit.x).toBeCloseTo(0, 10);
    expect(hit.z).toBeCloseTo(jumpDistance(0.5), 10);
  });

  it("偏航角把落点甩到侧面,但离起点的距离不变", () => {
    const straight = landPoint(p0, 0.6, 0);
    const angled = landPoint(p0, 0.6, 0.4);
    expect(angled.x).toBeGreaterThan(straight.x);
    expect(dist2d(p0, angled)).toBeCloseTo(dist2d(p0, straight), 8);
  });

  it("yawTo 求出来的方向,正好把落点送到目标上", () => {
    const from = { x: 12, z: -30 };
    const to = { x: 60, z: 90 };
    const yaw = yawTo(from, to);
    const power = powerForDistance(dist2d(from, to));
    const hit = landPoint(from, power, yaw);
    expect(dist2d(hit, to)).toBeLessThan(1e-9);
  });

  it("飞行轨迹是抛物线:两头贴地、正中间最高", () => {
    const power = 0.7;
    expect(flightPoint(p0, power, 0, 0).y).toBeCloseTo(0, 10);
    expect(flightPoint(p0, power, 0, 1).y).toBeCloseTo(0, 10);
    expect(flightPoint(p0, power, 0, 0.5).y).toBeCloseTo(jumpApex(power), 10);
    // 上半程一路升高
    let prev = -1;
    for (let u = 0; u <= 0.5; u += 0.05) {
      const y = flightPoint(p0, power, 0, u).y;
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
    // 终点就是 landPoint
    const end = flightPoint(p0, power, 0.3, 1);
    const land = landPoint(p0, power, 0.3);
    expect(end.x).toBeCloseTo(land.x, 10);
    expect(end.z).toBeCloseTo(land.z, 10);
  });
});

describe("分数公式 score", () => {
  it("只是站住(边缘)永远只拿基础分", () => {
    expect(score(0, false)).toBe(BASE_SCORE);
    expect(score(7, false)).toBe(BASE_SCORE);
  });

  it("完美按连击翻倍:基础分 × 连击倍数", () => {
    expect(score(1, true)).toBe(BASE_SCORE * 1);
    expect(score(2, true)).toBe(BASE_SCORE * 2);
    expect(score(5, true)).toBe(BASE_SCORE * 5);
  });

  it("连击倍数封顶在 COMBO_CAP,分数不会爆掉", () => {
    expect(comboMultiplier(COMBO_CAP + 40)).toBe(COMBO_CAP);
    expect(score(999, true)).toBe(BASE_SCORE * COMBO_CAP);
  });

  it("完美永远不比边缘差", () => {
    for (let c = 0; c <= 12; c++) {
      expect(score(Math.max(1, c), true)).toBeGreaterThanOrEqual(score(c, false));
    }
  });

  it("完美圈半径是个正数常量,比最小台面还小", () => {
    expect(PERFECT_R).toBeGreaterThan(0);
    expect(PERFECT_R).toBeLessThan(MIN_DIST / 2);
  });
});
