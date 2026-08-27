/** 共享美术套件 · 白闪星花单测(1.3 第 20 步 B 档配套)。 */
import { describe, expect, it } from "vitest";
import { SPARK_FRAMES, SPARK_FRAMES_REDUCED, SparklePool, traceStar } from "./sparkle";
import { ctx2d } from "../../qa-window2/canvasDom";

const ctx = ctx2d as CanvasRenderingContext2D;

describe("art/kit/sparkle · 白闪星花", () => {
  it("按帧计寿命:普通 2 帧、reduced 保留 1 帧(切中反馈不能全删)", () => {
    expect(SPARK_FRAMES).toBe(2);
    expect(SPARK_FRAMES_REDUCED).toBe(1);
    const pool = new SparklePool();
    pool.spawn(10, 10, false);
    pool.draw(ctx);
    expect(pool.count()).toBe(1);
    pool.draw(ctx);
    expect(pool.count()).toBe(0);
    pool.spawn(10, 10, true);
    pool.draw(ctx);
    expect(pool.count()).toBe(0);
  });

  it("星形路径可描、池子可清", () => {
    expect(() => traceStar(ctx, 0, 0, 12)).not.toThrow();
    const pool = new SparklePool();
    pool.spawn(1, 1, false);
    pool.spawn(2, 2, false);
    expect(pool.count()).toBe(2);
    pool.clear();
    expect(pool.count()).toBe(0);
  });
});
