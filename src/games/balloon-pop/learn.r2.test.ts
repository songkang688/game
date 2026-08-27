/**
 * 戳戳小气球 · 窗口 4 档A · 第 2 轮学习优化员：A-L09。
 *
 * 气球节里每颗气球的上升速度原来读的是「现在已经出到第几个」（`planAt - 1`），
 * 而位置是拿这个速度乘气球的**全部年龄**算出来的。于是每出一个新球，
 * 天上所有老球的 y 就整体挪一截——飘了 5 秒的球一次跳 5.5 像素，
 * 密的时候一秒出两三个，看上去就是「气球在抽搐」，而且实际逃逸得比设计的更早。
 *
 * 改法：气球记住自己出场时是第几个，速度按它自己的波次算。
 * `index.ts` 里的那一行是 DOM 代码，Node 环境下测不了，
 * 所以这里从两头夹：① 用 `floatAt` 复现「按全局波次算会跳多少」；
 * ② 断言源码里已经不再从全局波次取速度。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { floatAt, festRiseSpeed, festPlan, festSpawnMs, SKY_H, ESCAPE_Y, GIFT_RISE_MUL } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("戳戳小气球 · A-L09 · 上升速度按气球自己的波次算", () => {
  it("源码里不再有「拿当前 planAt 当波次」这一行", () => {
    expect(SRC).not.toContain("const wave = Math.max(0, planAt - 1)");
    expect(SRC).toContain("festRiseSpeed(b.wave)");
  });

  it("气球出场时就把自己的波次记下来了", () => {
    expect(SRC).toMatch(/wave: number;/);
    expect(SRC).toMatch(/const wave = planAt;/);
  });

  it("同一个波次算出来的位置随时间平滑下降，不会跳", () => {
    const f = { x0: 50, y0: SKY_H + 40, born: 0, phase: 0 };
    const rise = festRiseSpeed(40);
    let prev = Infinity;
    for (let t = 0; t <= 6; t += 0.1) {
      const y = floatAt(f, { riseSpeed: rise }, t).y;
      expect(y).toBeLessThan(prev + 1e-9);
      prev = y;
    }
  });

  it("换波次会让位置跳一截——这正是原来每出一个新球都会发生的事", () => {
    const f = { x0: 50, y0: SKY_H + 40, born: 0, phase: 0 };
    const jump = (age: number) =>
      floatAt(f, { riseSpeed: festRiseSpeed(40) }, age).y - floatAt(f, { riseSpeed: festRiseSpeed(41) }, age).y;
    expect(jump(5)).toBeGreaterThan(jump(1));
    expect(jump(5)).toBeCloseTo(5.5, 5);
  });

  it("按自己的波次算之后，先出场的气球一直比后出场的慢——顺序不会乱", () => {
    for (const [a, b] of [[0, 10], [10, 40], [40, 79]]) {
      expect(festRiseSpeed(a)).toBeLessThan(festRiseSpeed(b));
    }
    // 封顶之后就都一样快了，也不会互相超车
    expect(festRiseSpeed(80)).toBe(festRiseSpeed(200));
  });

  it("礼物气球照样比同波次的普通气球飘得慢，护得住", () => {
    for (const wave of [0, 30, 90]) {
      expect(festRiseSpeed(wave) * GIFT_RISE_MUL).toBeLessThan(festRiseSpeed(wave));
    }
  });

  it("出场表里每个球的波次就是它在表里的下标，一一对得上", () => {
    const plan = festPlan(31, 120);
    let at = plan[0].at;
    for (let i = 1; i < plan.length; i++) {
      at += festSpawnMs(i - 1) / 1000;
      expect(plan[i].at).toBeCloseTo(at, 6);
    }
  });

  it("气球在天上待的时间只由自己的波次决定，算得出来", () => {
    const life = (wave: number) => (SKY_H + 40 - ESCAPE_Y) / festRiseSpeed(wave);
    expect(life(0)).toBeGreaterThan(life(40));
    expect(life(80)).toBe(life(999));
    expect(life(999)).toBeGreaterThan(3.5);
  });
});
