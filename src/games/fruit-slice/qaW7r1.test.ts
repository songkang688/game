/**
 * 水果切切乐 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 果身 = 专属剪影 + 高光渐变 + 描边(专项②);
 * ② 粒子预算:液滴每切 ≤ 3 颗 / 寿命 ≤ 400ms,星花 ≤ 2 帧(性能抽查);
 * ③ reduced 下液滴一颗不生成、星花保 1 帧功能反馈;
 * ④ destroy 一把清空 juice / sparkles(泄漏抽查)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JUICE_DROPS_PER_SLICE, JUICE_LIFE_MS, JuicePool } from "../../art/kit/juice";
import { SPARK_FRAMES, SPARK_FRAMES_REDUCED, SparklePool } from "../../art/kit/sparkle";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 · fruit-slice 专项②:果身体积三件套", () => {
  it("drawFruit 的果身有径向渐变 + 描边", () => {
    const seg = SRC.slice(SRC.indexOf("function drawFruit"), SRC.indexOf("function drawFruit") + 2600);
    expect(seg).toContain("createRadialGradient");
    expect(seg).toContain("stroke()");
  });
});

describe("窗口7 R1 · fruit-slice 性能抽查:粒子预算封顶", () => {
  it("液滴:每切 ≤ 3 颗、寿命 ≤ 400ms(300ms 自灭,无积压)", () => {
    expect(JUICE_DROPS_PER_SLICE).toBeLessThanOrEqual(3);
    expect(JUICE_LIFE_MS).toBeLessThanOrEqual(400);
  });

  it("星花:正常 ≤ 2 帧、reduced 恰 1 帧(功能反馈不删光)", () => {
    expect(SPARK_FRAMES).toBeLessThanOrEqual(2);
    expect(SPARK_FRAMES_REDUCED).toBe(1);
  });

  it("reduced 下液滴一颗不生成", () => {
    const pool = new JuicePool();
    pool.spawn(10, 10, 0, "#f00", true);
    expect(pool.count()).toBe(0);
    pool.spawn(10, 10, 0, "#f00", false, () => 0.5);
    expect(pool.count()).toBe(JUICE_DROPS_PER_SLICE);
  });

  it("clear() 一把归零(destroy 泄漏抽查)", () => {
    const juice = new JuicePool();
    juice.spawn(0, 0, 0, "#f00", false, () => 0.5);
    juice.clear();
    expect(juice.count()).toBe(0);
    const sparks = new SparklePool();
    sparks.spawn(0, 0, false);
    sparks.clear();
    expect(sparks.count()).toBe(0);
  });

  it("index.ts 的 destroy 路径清空 juice 与 sparkles", () => {
    expect(SRC).toContain("juice.clear()");
    expect(SRC).toContain("sparkles.clear()");
  });
});
