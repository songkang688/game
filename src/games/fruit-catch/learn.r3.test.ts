/**
 * 接住小水果 · 窗口 4 档A · 第 3 轮学习优化员（A-L15）。
 *
 * 漏球原来只按「这是第几颗」轮着说三句通用道理。可孩子漏球的原因分得很清：
 * 落点在屏幕另一头（起步晚）、这颗掉得快、差半个篮子、刚被沉水果压慢。
 * 四种原因四种做法，混成一句就改不到点子上。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASKET_HALF, BASKET_SPEED, HEAVY_SLOW_S, MAX_MISS, MISS_FAR_PX, MISS_FAST_VY, MISS_NEAR_PX, SNAP_PX, W,
  missReason, missWord, missWordFor, type MissReason
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜", "怎么又"];
const ALL: MissReason[] = ["far", "fast", "near", "slow"];

describe("接住小水果 · A-L15 · 漏球说得出为什么", () => {
  it("差半个篮子就是「差一点点」，不会说成起步晚", () => {
    for (const gap of [0, 10, BASKET_HALF, MISS_NEAR_PX - 1]) {
      expect(missReason(100 + gap, 100, 150), `差 ${gap}px`).toBe("near");
      expect(missReason(100 - gap, 100, 150), `差 ${gap}px`).toBe("near");
    }
    // 篮口边缘那一档一定归「差一点点」
    expect(MISS_NEAR_PX).toBeGreaterThan(BASKET_HALF + SNAP_PX);
  });

  it("落点在屏幕另一头就是「起步晚」，跟它掉得快不快无关", () => {
    for (const vy of [80, 150, 400]) {
      expect(missReason(10, W - 10, vy)).toBe("far");
      expect(missReason(W - 10, 10, vy)).toBe("far");
    }
    expect(MISS_FAR_PX).toBeGreaterThan(MISS_NEAR_PX);
    expect(MISS_FAR_PX).toBeLessThan(W);
  });

  it("不远不近的时候，看它掉得快不快：快的说快，慢的说差一点点", () => {
    const mid = (MISS_NEAR_PX + MISS_FAR_PX) / 2;
    expect(missReason(100 + mid, 100, MISS_FAST_VY + 30)).toBe("fast");
    expect(missReason(100 + mid, 100, MISS_FAST_VY - 30)).toBe("near");
    expect(missReason(100 + mid, 100, MISS_FAST_VY)).toBe("fast");
  });

  it("篮子正被沉水果压慢的时候，先认这一条——那才是真原因", () => {
    for (const gap of [0, 100, W - 20]) {
      expect(missReason(gap, 0, 300, HEAVY_SLOW_S)).toBe("slow");
      expect(missReason(gap, 0, 300, 0.01)).toBe("slow");
    }
    // 压慢过去了就照常判
    expect(missReason(10, W - 10, 300, 0)).toBe("far");
  });

  it("四句话各说各的做法，一句都不重样，也没有一句在数落", () => {
    const said = new Set<string>();
    for (const r of ALL) {
      for (let n = 1; n <= MAX_MISS; n++) {
        const w = missWordFor(r, n);
        expect(w.length, `${r}/${n}`).toBeGreaterThan(12);
        for (const b of BLAME_WORDS) expect(w, `${r} 不该说「${b}」`).not.toContain(b);
        expect(w, `${r} 不该提到血`).not.toContain("血");
      }
      said.add(missWordFor(r, 1));
    }
    expect(said.size).toBe(ALL.length);
  });

  it("最后一颗爱心时先提醒一句稳住，前面两颗不啰嗦", () => {
    for (const r of ALL) {
      expect(missWordFor(r, MAX_MISS)).toContain("最后一颗爱心");
      expect(missWordFor(r, 1)).not.toContain("最后一颗爱心");
      expect(missWordFor(r, MAX_MISS - 1)).not.toContain("最后一颗爱心");
      // 提醒是加在前面的，后面那条做法一个字没少
      expect(missWordFor(r, MAX_MISS)).toContain(missWordFor(r, 1));
    }
  });

  it("每一条做法都对得上它那个原因，不是四句通用话换了皮", () => {
    expect(missWordFor("far", 1)).toContain("起步");
    expect(missWordFor("fast", 1)).toContain("快");
    expect(missWordFor("near", 1)).toContain("站");
    expect(missWordFor("slow", 1)).toContain("沉水果");
  });

  it("老的 missWord 还在，没有把别处用它的地方拆坏", () => {
    for (let n = 1; n <= MAX_MISS + 2; n++) {
      expect(missWord(n).length).toBeGreaterThan(10);
      for (const b of BLAME_WORDS) expect(missWord(n), `不该说「${b}」`).not.toContain(b);
    }
  });

  it("战役和水果雨两处都换上了新话术，战役那处还认得出被压慢", () => {
    expect(SRC).toContain("missWordFor(missReason(");
    // 战役那处传了 slowLeft，水果雨那处没有沉水果压慢这回事
    expect(SRC).toContain("it.plan.vy, slowLeft");
    const hits = [...SRC.matchAll(/missWordFor\(missReason\(/g)];
    expect(hits.length).toBe(2);
    // 挑离得最近的那只篮子来算距离：双篮关不会拿远的那只误判成「起步晚」
    expect(SRC).toContain("basketXs().reduce");
    expect(BASKET_SPEED).toBeGreaterThan(0);
  });
});
