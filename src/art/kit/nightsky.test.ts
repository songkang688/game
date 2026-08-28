// 美术套件 · nightsky:亮星两级闪烁、流星 8~14s 可 seed 复现、destroy 归零、丘陵确定性。
import { describe, expect, it } from "vitest";
import {
  METEOR_LIFE_MS,
  METEOR_MAX_GAP_MS,
  METEOR_MIN_GAP_MS,
  STAR_COUNT,
  TWINKLE_FAST_MS,
  TWINKLE_SLOW_MS,
  createMeteor,
  hillPoints,
  makeStars,
  meteorFrame,
  nextMeteorGap,
  resetMeteor,
  skyRng,
  starAlpha,
  stepMeteor,
} from "./nightsky";

describe("亮星", () => {
  it("默认 12 颗、两级大小、闪烁周期只有 1800/2600 两档", () => {
    expect(STAR_COUNT).toBe(12);
    expect(TWINKLE_FAST_MS).toBe(1800);
    expect(TWINKLE_SLOW_MS).toBe(2600);
    const stars = makeStars(42, 1000, 640);
    expect(stars).toHaveLength(12);
    expect(new Set(stars.map((s) => s.r)).size).toBe(2);
    for (const s of stars) expect([TWINKLE_FAST_MS, TWINKLE_SLOW_MS]).toContain(s.periodMs);
  });

  it("同 seed 同一批星;只落在上半片天", () => {
    expect(makeStars(7, 1000, 640)).toEqual(makeStars(7, 1000, 640));
    for (const s of makeStars(7, 1000, 640)) {
      expect(s.y).toBeLessThanOrEqual(640 * 0.5);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1000);
    }
  });

  it("闪烁亮度在 0.45..1 之间摆;reduced 恒亮", () => {
    const star = makeStars(1, 1000, 640)[0];
    for (const t of [0, 300, 700, 1300, 2100]) {
      const a = starAlpha(star, t, false);
      expect(a).toBeGreaterThanOrEqual(0.45);
      expect(a).toBeLessThanOrEqual(1);
      expect(starAlpha(star, t, true)).toBe(1);
    }
  });
});

describe("流星:间隔 [8s,14s]、seed 复现、reduced 不生成、destroy 归零", () => {
  it("间隔常量与抽样都落在 [8000,14000]", () => {
    expect(METEOR_MIN_GAP_MS).toBe(8000);
    expect(METEOR_MAX_GAP_MS).toBe(14000);
    const rng = skyRng(99);
    for (let i = 0; i < 200; i++) {
      const gap = nextMeteorGap(rng);
      expect(gap).toBeGreaterThanOrEqual(8000);
      expect(gap).toBeLessThanOrEqual(14000);
    }
  });

  it("同 seed 的两条时间线:同样步进,流星出现在同一毫秒同一位置", () => {
    const a = createMeteor(2026);
    const b = createMeteor(2026);
    expect(a.waitMs).toBe(b.waitMs);
    let spawnedAtA = -1;
    let spawnedAtB = -1;
    for (let ms = 0; ms < 20000; ms += 16) {
      stepMeteor(a, 16, 1000, 640, false);
      if (spawnedAtA < 0 && a.lifeMs > 0) spawnedAtA = ms;
    }
    for (let ms = 0; ms < 20000; ms += 16) {
      stepMeteor(b, 16, 1000, 640, false);
      if (spawnedAtB < 0 && b.lifeMs > 0) spawnedAtB = ms;
    }
    expect(spawnedAtA).toBeGreaterThan(0);
    expect(spawnedAtA).toBe(spawnedAtB);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });

  it("reduced:怎么步进都不出流星", () => {
    const st = createMeteor(5);
    for (let i = 0; i < 2000; i++) stepMeteor(st, 16, 1000, 640, true);
    expect(st.lifeMs).toBe(0);
    expect(meteorFrame(st)).toBeNull();
  });

  it("流星 700ms 渐隐:活着时 alpha 单调往下掉", () => {
    expect(METEOR_LIFE_MS).toBe(700);
    const st = createMeteor(11);
    st.lifeMs = METEOR_LIFE_MS;
    st.x = 200;
    st.y = 80;
    st.dx = 220;
    st.dy = 140;
    const a0 = meteorFrame(st)!.alpha;
    stepMeteor(st, 350, 1000, 640, false);
    const a1 = meteorFrame(st)!.alpha;
    expect(a1).toBeLessThan(a0);
  });

  it("resetMeteor(destroy 用):计时与在天上的那条全部归零", () => {
    const st = createMeteor(3);
    for (let i = 0; i < 700; i++) stepMeteor(st, 16, 1000, 640, false);
    resetMeteor(st);
    expect(st.waitMs).toBe(0);
    expect(st.lifeMs).toBe(0);
    expect(st.x).toBe(0);
    expect(st.dx).toBe(0);
    expect(meteorFrame(st)).toBeNull();
    // reset 之后就算继续步进也不会再生成
    for (let i = 0; i < 700; i++) stepMeteor(st, 16, 1000, 640, false);
    expect(st.lifeMs).toBe(0);
  });
});

describe("丘陵剪影", () => {
  it("同 seed 同一条天际线,采样点覆盖整个宽度", () => {
    const a = hillPoints(8, 1000, 430, 44, 5);
    expect(a).toEqual(hillPoints(8, 1000, 430, 44, 5));
    expect(a[0].x).toBe(0);
    expect(a[a.length - 1].x).toBe(1000);
    for (const p of a) expect(Math.abs(p.y - 430)).toBeLessThanOrEqual(44 + 1);
  });

  it("不同 seed 长得不一样(视差的两层不能是同一条线)", () => {
    expect(hillPoints(8, 1000, 430, 44, 5)).not.toEqual(hillPoints(9, 1000, 430, 44, 5));
  });
});
