/**
 * 窗口4 · 档B · 第 1 轮学习优化员 —— 地鼠嘭嘭的落地覆盖。
 *
 * 落地内容:夜市谱面原来是「先限流,再展开群鼠」。
 * 群鼠一展开就是同刻三只,早期波次的台面预算只有一两只,
 * 多出来的那些在 `spawnNote` 里被静悄悄丢掉,还会被随机塞进别的洞;
 * 于是「排了 46 个音符」和「真能打到的音符」对不上,
 * 同一个洞甚至会被排上两只(后一只顶掉前一只)。
 * 现在改成「够三只的波次才塞群鼠 + 展开后再限一次流」,
 * 谱面写成什么样,台上就演什么样。
 */
import { describe, expect, it } from "vitest";
import { endlessWave } from "./levels";
import {
  SWARM_SIZE,
  capConcurrency,
  chartMaxPoints,
  maxConcurrentOf,
  moleTimeline,
  nightMarketChart,
  type ChartNote,
} from "./rhythm";

/** 同一个洞在同一段时间里被排了两只的次数 */
function holeClashes(chart: readonly ChartNote[]): number {
  let clash = 0;
  for (let i = 0; i < chart.length; i++) {
    for (let j = i + 1; j < chart.length; j++) {
      if (chart[i].hole !== chart[j].hole) continue;
      const a = moleTimeline(chart[i].at, chart[i].upMs);
      const b = moleTimeline(chart[j].at, chart[j].upMs);
      if (chart[i].at < b.goneAt && a.goneAt > chart[j].at) clash++;
    }
  }
  return clash;
}

describe("档B R1 落地 · 地鼠嘭嘭 · 夜市谱面照台面预算排", () => {
  it("连逛 24 摊:同刻只数一次都不超这一波的 maxConcurrent", () => {
    for (let wave = 1; wave <= 24; wave++) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 31 + 7);
      expect(maxConcurrentOf(chart), `第 ${wave} 摊排爆了台面`).toBeLessThanOrEqual(cfg.maxConcurrent);
    }
  });

  it("连逛 24 摊:同一个洞不会被排上两只(改之前第 8 摊起就有)", () => {
    for (let wave = 1; wave <= 24; wave++) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 31 + 7);
      expect(holeClashes(chart), `第 ${wave} 摊有洞被挤了`).toBe(0);
    }
  });

  it("换一批种子也一样守规矩", () => {
    for (const seed of [1, 7, 2024, 88888]) {
      for (const wave of [3, 9, 15, 30]) {
        const cfg = endlessWave(wave);
        const chart = nightMarketChart(cfg, wave, seed);
        expect(maxConcurrentOf(chart)).toBeLessThanOrEqual(cfg.maxConcurrent);
        expect(holeClashes(chart)).toBe(0);
      }
    }
  });

  it("群鼠没被砍掉:台面放得下三只的波次里,同刻三只照样出现", () => {
    let triples = 0;
    for (let wave = 9; wave <= 30; wave++) {
      const chart = nightMarketChart(endlessWave(wave), wave, wave * 17 + 3);
      const byTime = new Map<number, number>();
      for (const n of chart) byTime.set(n.at, (byTime.get(n.at) ?? 0) + 1);
      for (const count of byTime.values()) if (count >= SWARM_SIZE) triples++;
    }
    expect(SWARM_SIZE).toBe(3);
    expect(triples, "群鼠被限流限没了").toBeGreaterThan(0);
  });

  it("越逛越热闹这条没被限流限没:第 20 摊仍旧明显多过第 1 摊", () => {
    const first = nightMarketChart(endlessWave(1), 1, 99);
    const late = nightMarketChart(endlessWave(20), 20, 99);
    expect(late.length).toBeGreaterThan(first.length);
    expect(chartMaxPoints(late)).toBeGreaterThan(chartMaxPoints(first));
  });

  it("限流函数本身:同刻同洞两只只留一只", () => {
    const crowded: ChartNote[] = [
      { at: 1000, hole: 4, kind: "normal", upMs: 800 },
      { at: 1100, hole: 4, kind: "normal", upMs: 800 },
      { at: 1200, hole: 5, kind: "normal", upMs: 800 },
    ];
    const kept = capConcurrency(crowded, 3);
    expect(kept).toHaveLength(2);
    expect(holeClashes(kept)).toBe(0);
  });
});
