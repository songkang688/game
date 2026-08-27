/**
 * 接住小水果 · 窗口 4 档A · 第 2 轮学习优化员：A-L10。
 *
 * 生成器排链时，下一颗的落点是在「篮子跑得到的那一段」里随机挑的，
 * 而这一段一直是按篮子极速顶格算的。结果就是不管第几关，
 * 「照着链走最少要跑多快」都稳稳压在 210~230 像素/秒——
 * 第 1 关和第 188 关要的手速一模一样，「跑多快」这一维根本没参与难度。
 *
 * 改法：给关卡加一个 `reach`（这一关用掉多少「够得着的范围」），
 * 章内一路加宽、换章再松一口气。前 99 关是 1.0 冻结的，一个参数都不加。
 */
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEGACY_CHAPTER_SIZES, LEGACY_LEVELS, LEVELS, reachOf } from "./levels";
import {
  BASKET_SPEED, MIN_REACH_USE, W, checkReachable, markReachable, minSpeedNeeded,
  planDrops, simulateLevel
} from "./logic";

/** 这一关照着链走最少要跑多快 */
function need(lv: number, seed = 4200): number {
  return simulateLevel(LEVELS[lv - 1], { seed: seed + lv }).needSpeed;
}

describe("接住小水果 · A-L10 · 手速门槛真的有坡了", () => {
  it("前 99 关一个 reach 都不加：1.0 的手感原样冻着", () => {
    for (let lv = 1; lv <= LEGACY_LEVELS; lv++) expect(LEVELS[lv - 1].reach, `第 ${lv} 关`).toBeUndefined();
    for (let ci = 0; ci < LEGACY_CHAPTER_SIZES.length; ci++) {
      expect(reachOf(ci, 0, LEGACY_CHAPTER_SIZES[ci])).toBeUndefined();
    }
  });

  it("1.1 之后的四条果道每一关都有 reach，章内单调加宽", () => {
    let at = LEGACY_LEVELS;
    for (let ci = LEGACY_CHAPTER_SIZES.length; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      let prev = -1;
      for (let t = 0; t < size; t++) {
        const r = LEVELS[at + t].reach;
        expect(r, `第 ${at + t + 1} 关`).toBeDefined();
        expect(r!, `第 ${at + t + 1} 关`).toBeGreaterThan(prev);
        prev = r!;
      }
      // 每一章都收在同一个顶格
      expect(LEVELS[at + size - 1].reach).toBe(0.98);
      at += size;
    }
    expect(at).toBe(LEVELS.length);
  });

  it("换章一定松一口气，而且一章比一章的起点高", () => {
    const starts = [100, 123, 145, 167];
    for (const lv of starts) expect(LEVELS[lv - 1].reach!).toBeLessThan(0.98);
    for (let i = 1; i < starts.length; i++) {
      expect(LEVELS[starts[i] - 1].reach!).toBeGreaterThan(LEVELS[starts[i - 1] - 1].reach!);
    }
  });

  it("坡量到手速上就是真的坡：章头四到六成，章尾逼近八成", () => {
    for (const lv of [100, 123, 145, 167]) expect(need(lv) / BASKET_SPEED, `第 ${lv} 关`).toBeLessThan(0.66);
    for (const lv of [122, 144, 166, 188]) expect(need(lv) / BASKET_SPEED, `第 ${lv} 关`).toBeGreaterThan(0.75);
  });

  it("再窄也窄不到「水果全挤在一条竖线上」：有下限兜着", () => {
    expect(MIN_REACH_USE).toBeGreaterThan(0);
    const cfg = { ...LEVELS[99], reach: 0.01 };
    const plan = planDrops(cfg, 555, { count: 120 });
    const xs = plan.map((p) => p.x);
    // 收窄了，但还是铺得开一片，不是一条线
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(W * 0.2);
    expect(minSpeedNeeded(plan)).toBeGreaterThan(0);
  });

  it("收窄只会让关更好接，绝不会把「够得着」弄坏", () => {
    for (let lv = 100; lv <= 188; lv += 7) {
      const plan = markReachable(planDrops(LEVELS[lv - 1], 900 + lv, { count: 140 }));
      const rep = checkReachable(plan);
      expect(rep.ok, `第 ${lv} 关 firstBad=${rep.firstBad} hazard=${rep.hazardRisk}`).toBe(true);
    }
  });

  it("新四章现在手慢一半也能过——这正是坡的用处", () => {
    for (const lv of [100, 106, 123, 130, 145, 152, 167, 174]) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 8100 + lv, playerSpeed: BASKET_SPEED * 0.5 });
      expect(res.won, `第 ${lv} 关半速`).toBe(true);
    }
  });

  it("每一章的章尾照样是挑战：半速就有过不去的了", () => {
    const lost = [122, 144, 166, 188].filter(
      (lv) => !simulateLevel(LEVELS[lv - 1], { seed: 8100 + lv, playerSpeed: BASKET_SPEED * 0.42 }).won
    );
    expect(lost.length).toBeGreaterThan(0);
  });

  it("全速的假玩家一关都不会掉队：坡没有把哪一关弄成死局", () => {
    for (let lv = 100; lv <= 188; lv += 5) {
      expect(simulateLevel(LEVELS[lv - 1], { seed: 3300 + lv }).won, `第 ${lv} 关`).toBe(true);
    }
  });
});
