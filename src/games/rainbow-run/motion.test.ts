import { describe, expect, it } from "vitest";
import {
  FRAMERATE_TOLERANCE,
  GRAVITY,
  GLIDE_RESIDUAL,
  JUMP_RISE,
  JUMP_SPEED,
  LANE_GLIDE,
  LANE_GLIDE_MAX,
  LANE_GLIDE_MIN,
  MAX_TILT,
  SLIDE_LOCK,
  SLIDE_SHORTER_THAN_JUMP,
  glideLane,
  groundedBody,
  launchBody,
  relativeGap,
  renderLift,
  runStretch,
  shadowScale,
  slideCanCancel,
  stepDistance,
  stepJump,
  tiltFor,
} from "./motion";
import { COYOTE_TIME, INPUT_BUFFER } from "./controls";
import { JUMP_TIME } from "./logic";

/** 用固定步长把换道推进 seconds 秒,返回落在哪。 */
function glideFor(seconds: number, dt: number): number {
  let x = 0;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) x = glideLane(x, 1, dt);
  return x;
}

describe("彩虹跑跑 · 手感常量", () => {
  it("土狼时间 ~90ms、跳跃缓冲 ~120ms,都落在规格给的窗口里", () => {
    expect(COYOTE_TIME).toBeCloseTo(0.09, 3);
    expect(COYOTE_TIME).toBeGreaterThanOrEqual(0.07);
    expect(COYOTE_TIME).toBeLessThanOrEqual(0.11);
    expect(INPUT_BUFFER).toBeCloseTo(0.12, 3);
    expect(INPUT_BUFFER).toBeGreaterThanOrEqual(0.1);
    expect(INPUT_BUFFER).toBeLessThanOrEqual(0.14);
  });

  it("缓冲比土狼长:落地前按下的跳,过了土狼窗口也还记得住", () => {
    expect(INPUT_BUFFER).toBeGreaterThan(COYOTE_TIME);
  });

  it("换道走完一格要 80–120 毫秒,不快不慢", () => {
    expect(LANE_GLIDE).toBeGreaterThanOrEqual(LANE_GLIDE_MIN);
    expect(LANE_GLIDE).toBeLessThanOrEqual(LANE_GLIDE_MAX);
    expect(LANE_GLIDE_MIN).toBeCloseTo(0.08, 3);
    expect(LANE_GLIDE_MAX).toBeCloseTo(0.12, 3);
  });

  it("换道到点那一刻已经走完九成,残差正好是说好的那一点点", () => {
    // 60fps 走满 LANE_GLIDE 秒
    const at = glideFor(LANE_GLIDE, 1 / 60);
    expect(at).toBeGreaterThan(1 - GLIDE_RESIDUAL * 1.35);
    expect(at).toBeLessThan(1);
  });

  it("换道走到位就吸住,不会永远差一丝一直抖", () => {
    let x = 0;
    for (let i = 0; i < 60; i++) x = glideLane(x, 2, 1 / 60);
    expect(x).toBe(2);
  });

  it("dt 为 0 或负数时换道原地不动,不会因为坏帧突然瞬移", () => {
    expect(glideLane(0.4, 2, 0)).toBe(0.4);
    expect(glideLane(0.4, 2, -1)).toBe(0.4);
  });

  it("30fps 与 60fps 换到同一条道上的进度几乎一样", () => {
    const a = glideFor(LANE_GLIDE, 1 / 60);
    const b = glideFor(LANE_GLIDE, 1 / 30);
    expect(relativeGap(a, b)).toBeLessThan(FRAMERATE_TOLERANCE);
  });
});

describe("彩虹跑跑 · 换道侧倾", () => {
  it("往右换道往右倾、往左换道往左倾,幅度封顶", () => {
    expect(tiltFor(1, 2, false)).toBeCloseTo(MAX_TILT, 6);
    expect(tiltFor(1, 0, false)).toBeCloseTo(-MAX_TILT, 6);
    expect(Math.abs(tiltFor(0, 2, false))).toBeLessThanOrEqual(MAX_TILT);
  });

  it("站定了就不倾斜", () => {
    expect(tiltFor(2, 2, false)).toBe(0);
  });

  it("系统关掉动效之后一律不倾斜,位移照走", () => {
    expect(tiltFor(1, 2, true)).toBe(0);
    expect(tiltFor(1, 0, true)).toBe(0);
    // 位移函数完全没被 reduced-motion 影响
    expect(glideLane(0, 1, 1 / 60)).toBeGreaterThan(0);
  });
});

describe("彩虹跑跑 · 跳跃按初速与重力积分", () => {
  it("初速与重力是从 1.1 的滞空时长与高度反推的,两者对得上", () => {
    // 2·v0/g 就是滞空时长
    expect((2 * JUMP_SPEED) / GRAVITY).toBeCloseTo(JUMP_TIME, 6);
    // v0²/(2g) 就是最高点
    expect((JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)).toBeCloseTo(JUMP_RISE, 6);
  });

  it("一次跳的滞空时长与最高点,60fps 下与 1.1 那条抛物线一致", () => {
    const dt = 1 / 60;
    let body = launchBody();
    let t = 0;
    let peak = 0;
    while (body.airborne && t < 5) {
      body = stepJump(body, dt);
      t += dt;
      if (body.lift > peak) peak = body.lift;
    }
    expect(t).toBeGreaterThan(JUMP_TIME - dt * 1.5);
    expect(t).toBeLessThan(JUMP_TIME + dt * 1.5);
    expect(peak).toBeGreaterThan(JUMP_RISE * 0.97);
    expect(peak).toBeLessThanOrEqual(JUMP_RISE + 0.001);
  });

  it("落地那一帧高度归零,不会陷进地里", () => {
    let body = launchBody();
    for (let i = 0; i < 200 && body.airborne; i++) body = stepJump(body, 1 / 30);
    expect(body.airborne).toBe(false);
    expect(body.lift).toBe(0);
  });

  it("贴地的身体推进多少帧都还贴着地", () => {
    let body = groundedBody();
    for (let i = 0; i < 10; i++) body = stepJump(body, 1 / 60);
    expect(body).toEqual(groundedBody());
  });

  it("收藏册的弹跳加成只抬高画面上的高度,而且封顶", () => {
    const body = { lift: 50, vy: 0, airborne: true };
    expect(renderLift(body, 1)).toBe(50);
    expect(renderLift(body, 1.2)).toBeCloseTo(60, 6);
    // 再离谱的倍率也只抬到两倍
    expect(renderLift(body, 99)).toBe(100);
    expect(renderLift(body, -3)).toBe(25);
  });

  it("影子随高度收小,贴地最大、最高点最小", () => {
    expect(shadowScale(0)).toBeCloseTo(1, 6);
    expect(shadowScale(JUMP_RISE)).toBeLessThan(shadowScale(JUMP_RISE * 0.3));
    expect(shadowScale(JUMP_RISE * 4)).toBeGreaterThan(0.3);
  });
});

describe("彩虹跑跑 · 下滑锁定", () => {
  it("下滑锁定比一次跳跃短,滑过低梁能马上接上下一拍", () => {
    expect(SLIDE_LOCK).toBeLessThan(JUMP_TIME);
    expect(SLIDE_SHORTER_THAN_JUMP).toBe(true);
  });

  it("刚趴下打不断,贴够时间就放行", () => {
    expect(slideCanCancel(0)).toBe(false);
    expect(slideCanCancel(SLIDE_LOCK - 0.01)).toBe(false);
    expect(slideCanCancel(SLIDE_LOCK)).toBe(true);
  });
});

describe("彩虹跑跑 · 30fps 与 60fps 跑同一段路", () => {
  const speedAt = (dist: number): number => Math.min(500, 250 + dist * 0.02);

  it("一路平跑:位移差远小于 2%", () => {
    const a = runStretch({ dt: 1 / 60, seconds: 30, speedAt });
    const b = runStretch({ dt: 1 / 30, seconds: 30, speedAt });
    expect(relativeGap(a.dist, b.dist)).toBeLessThan(FRAMERATE_TOLERANCE);
  });

  it("一路跳着跑:位移、跳跃次数、滞空时长都对得上", () => {
    const a = runStretch({ dt: 1 / 60, seconds: 30, speedAt, jumpEvery: 0.9 });
    const b = runStretch({ dt: 1 / 30, seconds: 30, speedAt, jumpEvery: 0.9 });
    expect(relativeGap(a.dist, b.dist)).toBeLessThan(FRAMERATE_TOLERANCE);
    expect(Math.abs(a.jumps - b.jumps)).toBeLessThanOrEqual(1);
    expect(relativeGap(a.peakLift, b.peakLift)).toBeLessThan(0.05);
    // 单跳的滞空时长两边都贴着 JUMP_TIME。整段的累计值会差几个百分点,
    // 那是「一帧一记」的记账粒度(30fps 每一跳最多多记 33 毫秒),不是物理漂了
    expect(a.airSeconds / a.jumps).toBeGreaterThan(JUMP_TIME - 1 / 60);
    expect(a.airSeconds / a.jumps).toBeLessThan(JUMP_TIME + 1 / 60);
    expect(b.airSeconds / b.jumps).toBeGreaterThan(JUMP_TIME - 1 / 30);
    expect(b.airSeconds / b.jumps).toBeLessThan(JUMP_TIME + 1 / 30);
  });

  it("低到 20fps 的卡顿机上,一段路跑下来也没多也没少", () => {
    const a = runStretch({ dt: 1 / 60, seconds: 20, speedAt, jumpEvery: 1.2 });
    const c = runStretch({ dt: 1 / 20, seconds: 20, speedAt, jumpEvery: 1.2 });
    expect(relativeGap(a.dist, c.dist)).toBeLessThan(FRAMERATE_TOLERANCE);
  });

  it("位移只跟真实时间有关:跑两倍的时间就走差不多两倍的路", () => {
    const flat = (): number => 300;
    const one = runStretch({ dt: 1 / 60, seconds: 5, speedAt: flat });
    const two = runStretch({ dt: 1 / 60, seconds: 10, speedAt: flat });
    expect(one.dist).toBeCloseTo(1500, 0);
    expect(two.dist).toBeCloseTo(3000, 0);
  });

  it("单帧位移就是速度乘时间,负的 dt 不倒着走", () => {
    expect(stepDistance(100, 250, 0.5)).toBe(225);
    expect(stepDistance(100, 250, -1)).toBe(100);
  });

  it("相对差:两个数一样就是 0,差一半就是 0.5", () => {
    expect(relativeGap(0, 0)).toBe(0);
    expect(relativeGap(100, 100)).toBe(0);
    expect(relativeGap(100, 50)).toBeCloseTo(0.5, 6);
  });
});
