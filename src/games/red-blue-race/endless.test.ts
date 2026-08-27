/**
 * 守门：跑不完的跑道要有一个「跑完了」的出口（第 2 轮测试员 W5R2-A-09，建议）。
 *
 * 测试员实测：机器人「见坑就跳」跑满 **91 秒 / 6950 步 / 511 次起跳**，
 * 密度到「每百米 6.3 个机关」仍未收工——因为规则只有「撞 3 次」这一个出口，不撞就不结束。
 * 而**不结束就不结算**：`finish()` 才写纪录、才发小星星，所以跑得再远也白跑。
 *
 * 这条不是「把无尽改成有限」，是给它补上第二个出口：
 * 这条跑道上每个旋钮都会封顶——陪跑星星的速度封在 1020 米、机关密度封在 810 米，
 * 过了那儿再跑就是同一段路原样重播。收在 1200 米，两条曲线都跑完整了。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ENDLESS_GOAL_M,
  ENDLESS_MAX_HITS,
  endlessChaserSpeed,
  endlessDensity,
  endlessGapMeters,
  endlessGoalReached,
  endlessRunOver,
} from "./logic";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("跑不完的跑道 · 跑满全程这个出口", () => {
  it("到线才算跑完，差一米都不算", () => {
    expect(endlessGoalReached(ENDLESS_GOAL_M - 1)).toBe(false);
    expect(endlessGoalReached(ENDLESS_GOAL_M)).toBe(true);
    expect(endlessGoalReached(ENDLESS_GOAL_M + 300)).toBe(true);
  });

  it("刚开跑、以及量出个 NaN 来，都不算跑完", () => {
    expect(endlessGoalReached(0)).toBe(false);
    expect(endlessGoalReached(Number.NaN)).toBe(false);
    expect(endlessGoalReached(-50)).toBe(false);
  });

  it("两个出口是并列的:摔够三跤算完,跑满全程也算完", () => {
    expect(endlessRunOver(ENDLESS_MAX_HITS, 0)).toBe(true);
    expect(endlessRunOver(0, ENDLESS_GOAL_M)).toBe(true);
    expect(endlessRunOver(ENDLESS_MAX_HITS - 1, ENDLESS_GOAL_M - 1)).toBe(false);
  });

  it("反例:老口径只认摔跤——「一跤没摔跑一千二百米」在老口径下永远不收工", () => {
    // 这正是测试员那台机器人卡住的样子:跳过每一个坑,于是永远等不到第三跤
    expect(endlessRunOver(0)).toBe(false);
    expect(endlessRunOver(2, 0)).toBe(false);
    expect(endlessRunOver(2, ENDLESS_GOAL_M)).toBe(true);
  });
});

describe("跑不完的跑道 · 收在哪儿才不算腰斩", () => {
  it("收线摆在陪跑星星提速封顶之后——速度那条曲线是完整跑过一遍的", () => {
    const capped = endlessChaserSpeed(1_000_000);
    let capAt = 0;
    for (let m = 0; m <= 4000; m += 6) {
      if (endlessChaserSpeed(m) >= capped) {
        capAt = m;
        break;
      }
    }
    expect(capAt).toBeGreaterThan(0);
    expect(ENDLESS_GOAL_M).toBeGreaterThan(capAt);
  });

  it("也摆在机关密度封顶之后——难度那条曲线也是完整的", () => {
    const tightest = endlessGapMeters(1_000_000);
    let capAt = 0;
    for (let m = 0; m <= 4000; m += 6) {
      if (endlessGapMeters(m) <= tightest) {
        capAt = m;
        break;
      }
    }
    expect(capAt).toBeGreaterThan(0);
    expect(ENDLESS_GOAL_M).toBeGreaterThan(capAt);
    // 测试员卡住时读到的就是这个封顶密度
    expect(endlessDensity(ENDLESS_GOAL_M)).toBeCloseTo(6.25, 2);
  });

  it("收线之后这条路真的只是原样重播,一个旋钮都不再动", () => {
    expect(endlessChaserSpeed(ENDLESS_GOAL_M)).toBe(endlessChaserSpeed(ENDLESS_GOAL_M * 5));
    expect(endlessGapMeters(ENDLESS_GOAL_M)).toBe(endlessGapMeters(ENDLESS_GOAL_M * 5));
  });
});

describe("跑不完的跑道 · 接线与说法（源码巡检）", () => {
  const endless = INDEX.slice(INDEX.indexOf("function mountEndless("));

  it("每一帧都看一眼到线没有,到了就走结算(结算才写纪录、才发小星星)", () => {
    const loop = endless.slice(endless.indexOf("function loop(now: number): void {"));
    expect(loop.slice(0, loop.indexOf("\n  }\n"))).toContain("endlessGoalReached(dist)");
    expect(endless).toContain("finish(true)");
    expect(endless).toContain("save.recordEndlessBest(meta.id, score)");
  });

  it("跑完全程给的是庆祝,不是「☁️ 这趟跑了」那一版", () => {
    expect(endless).toContain("跑完全程");
    expect(endless).toContain('const face = full ? "🎉"');
    // 一跤没摔跑到头,音效不许还是 oops
    expect(endless).toContain('api.play(full || record ? "win" : "oops")');
  });

  it("开跑那句话把两个出口都说清楚,不再写「跑道没有终点」", () => {
    expect(endless).toContain("撞 3 次收工,跑满 ${ENDLESS_GOAL_M} 米也收工");
    expect(INDEX).not.toContain("跑道没有终点");
  });

  it("摔够三跤那条老路一个字没改", () => {
    const hit = endless.slice(endless.indexOf("function takeHit("));
    expect(hit.slice(0, hit.indexOf("\n  }\n"))).toContain("endlessRunOver(hits)");
  });
});
