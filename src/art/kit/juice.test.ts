/** 共享美术套件 · 果汁液滴粒子单测(1.3 第 20 步 B 档配套)。 */
import { describe, expect, it } from "vitest";
import { JUICE_DROPS_PER_SLICE, JUICE_LIFE_MS, JuicePool, easeOutQuad } from "./juice";
import { ctx2d } from "../../qa-window2/canvasDom";

const ctx = ctx2d as CanvasRenderingContext2D;

describe("art/kit/juice · 果汁液滴", () => {
  it("一次切中正好 3 颗,300ms 内渐隐、到点全清", () => {
    expect(JUICE_DROPS_PER_SLICE).toBe(3);
    expect(JUICE_LIFE_MS).toBe(300);
    const pool = new JuicePool();
    pool.spawn(100, 100, Math.PI / 4, "#ffb3c1", false, () => 0.5);
    expect(pool.count()).toBe(3);
    pool.update(150);
    expect(pool.count()).toBe(3);
    expect(() => pool.draw(ctx)).not.toThrow();
    pool.update(150);
    expect(pool.count()).toBe(0);
  });

  it("reduced 一颗都不生成;clear 一把清空", () => {
    const pool = new JuicePool();
    pool.spawn(0, 0, 0, "#fff", true);
    expect(pool.count()).toBe(0);
    pool.spawn(0, 0, 0, "#fff", false);
    pool.spawn(0, 0, Math.PI, "#abc", false);
    expect(pool.count()).toBe(6);
    pool.clear();
    expect(pool.count()).toBe(0);
  });

  it("缓动 easeOutQuad:出手快收尾缓,两端钉死 0 和 1", () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
    expect(easeOutQuad(0.5)).toBeCloseTo(0.75, 5);
    // 前半段位移大于后半段(先快后慢)
    expect(easeOutQuad(0.5) - easeOutQuad(0)).toBeGreaterThan(easeOutQuad(1) - easeOutQuad(0.5));
  });
});
