/**
 * 窗口 4 · 档B · 第 2 轮学习优化员 —— 地鼠嘭嘭
 *
 * 落地 B2-03：夜市第 25 摊之后接着加压，场地招牌也不再卡死。
 */
import { describe, expect, it } from "vitest";
import {
  ENDLESS_CAP_WAVE,
  ENDLESS_CONCURRENT_MAX,
  ENDLESS_FIELDS,
  endlessFieldName,
  endlessWave,
} from "./levels";
import { chartMaxPoints, maxConcurrentOf, nightMarketChart } from "./rhythm";

describe("档B R2 学习优化员 · 地鼠嘭嘭 · 夜市封顶之后还在走", () => {
  it("场地招牌逛完一圈就从头再来：不会第 21 摊起永远是「熔岩地洞」", () => {
    // 一圈是 5 片场地 × 每片 5 摊 = 25 摊
    expect(endlessFieldName(1)).toBe(ENDLESS_FIELDS[0]);
    expect(endlessFieldName(21)).toBe(ENDLESS_FIELDS[4]);
    expect(endlessFieldName(26)).toBe(ENDLESS_FIELDS[0]);
    for (const wave of [3, 12, 28, 77]) {
      expect(endlessFieldName(wave + 25), `第 ${wave} 摊和第 ${wave + 25} 摊该是同一片场地`).toBe(
        endlessFieldName(wave),
      );
    }
    const seen = new Set(Array.from({ length: 50 }, (_, i) => endlessFieldName(i + 26)));
    expect([...seen].sort()).toEqual([...ENDLESS_FIELDS].sort());
  });

  it("第 25 摊之前那条基础曲线一个数都没动", () => {
    // 加压只从 over > 0 起算，前 25 摊必须与改动前逐项一致
    expect(endlessWave(1)).toMatchObject({ target: 6, gapMs: 820, maxConcurrent: 1, bunnyChance: 0 });
    expect(endlessWave(ENDLESS_CAP_WAVE)).toMatchObject({
      target: 18,
      upMsMin: 480,
      upMsMax: 882,
      gapMs: 340,
      maxConcurrent: 3,
      bunnyChance: 0.14,
      shieldChance: 0.18,
    });
  });

  it("第 25 摊之后第二批旋钮接着走：目标分、间隔、台面预算都还在动", () => {
    // 改之前：第 25 摊与第 300 摊的配置逐项相等
    const a = endlessWave(ENDLESS_CAP_WAVE);
    const b = endlessWave(100);
    expect(b.target).toBeGreaterThan(a.target);
    expect(b.gapMs).toBeLessThan(a.gapMs);
    expect(b.upMsMin).toBeLessThan(a.upMsMin);
    expect(b.maxConcurrent).toBeGreaterThan(a.maxConcurrent);
    expect(b.bunnyChance).toBeGreaterThan(a.bunnyChance);
    expect(b.shieldChance).toBeGreaterThan(a.shieldChance);
  });

  it("越守越难也永远守得住：每一摊的满分打法都够得着目标分", () => {
    for (const wave of [1, 25, 40, 60, 90, 150, 300]) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 733 + 19);
      expect(chart.length, `第 ${wave} 摊谱面是空的`).toBeGreaterThan(0);
      expect(maxConcurrentOf(chart), `第 ${wave} 摊排爆了台面`).toBeLessThanOrEqual(cfg.maxConcurrent);
      expect(chartMaxPoints(chart), `第 ${wave} 摊全打中也够不着目标分`).toBeGreaterThanOrEqual(cfg.target);
    }
  });

  it("台面预算再涨也留得下反应时间：最多 5 只，9 个洞不会挤满", () => {
    for (let wave = 1; wave <= 400; wave++) {
      expect(endlessWave(wave).maxConcurrent).toBeLessThanOrEqual(ENDLESS_CONCURRENT_MAX);
    }
    expect(endlessWave(400).maxConcurrent).toBe(ENDLESS_CONCURRENT_MAX);
  });

  it("加压之后夜市谱面还是 seeded 可复现的", () => {
    for (const wave of [30, 77, 200]) {
      const cfg = endlessWave(wave);
      expect(nightMarketChart(cfg, wave, 4242)).toEqual(nightMarketChart(cfg, wave, 4242));
    }
  });
});
