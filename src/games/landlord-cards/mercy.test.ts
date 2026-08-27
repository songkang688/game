/**
 * 守门：输了重开不许让孩子连输一长串才翻到能赢的牌（第 2 轮测试员 W5R2-A-08，建议）。
 *
 * 测试员实测：让「完全照着 💡 教练提示打」的玩家把 188 关各打一局，输了就换一副再打——
 * 187 关都在 2 次以内翻到能赢的牌，只有**第 188 关要连输 5 次**，第 6 次才过第一次。
 * 本轮用同一套牌桌复算（`sim.runTable` 的 `coach` 座位 + 同档小牌灵），
 * 还多揪出第 81 关要连输 5 次，以及 150 / 153 / 167 / 170 / 177 各要 3 次。
 *
 * 收法不是「抬发牌照顾力度」：`boost` 抬上去只是换一手更强的牌，
 * 而「牌强」和「这一局赢不赢」不是一回事——实测把 `boost` 从 0 抬到 1 或 2，
 * 第 188 关是好了，却把第 150 / 153 / 165 关顶到连输 5–6 次，尾巴只是换了个地方长。
 * 所以直接按「能不能赢」挑：连输两次之后，发牌前替孩子试打一遍。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LEVELS, MERCY_AFTER_LOSSES, MERCY_SCAN, coachCanWin, levelDealSeed, mercyRedeal } from "./levels";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 照着教练提示打，这一关要连输几次才翻到能赢的牌；-1 表示试到头都没翻到 */
function lossesToWin(index: number, withMercy: boolean): number {
  const lv = LEVELS[index];
  for (let b = 0; b < 14; b++) if (coachCanWin(lv, withMercy ? mercyRedeal(lv, b) : b)) return b;
  return -1;
}

describe("朵朵抢地主 · 换一副牌这件事本身", () => {
  it("第一副就是关卡表里那一副,一个数没动", () => {
    for (const lv of LEVELS) expect(levelDealSeed(lv, 0)).toBe(lv.seed);
  });

  it("每重开一次都是全新的一副,不会撞回之前发过的", () => {
    const lv = LEVELS[187];
    const seen = new Set(Array.from({ length: 20 }, (_, n) => levelDealSeed(lv, n)));
    expect(seen.size).toBe(20);
  });

  it("脏参数（负数 / NaN / 小数）都当第一副处理", () => {
    const lv = LEVELS[0];
    expect(levelDealSeed(lv, -3)).toBe(lv.seed);
    expect(levelDealSeed(lv, Number.NaN)).toBe(lv.seed);
    expect(levelDealSeed(lv, 0.4)).toBe(lv.seed);
  });
});

describe("朵朵抢地主 · 连输两次之前不插手", () => {
  it("头两次原样换牌:摔两跤是塔的一部分", () => {
    expect(MERCY_AFTER_LOSSES).toBe(2);
    for (const i of [0, 80, 119, 187]) {
      for (let b = 0; b < MERCY_AFTER_LOSSES; b++) expect(mercyRedeal(LEVELS[i], b)).toBe(b);
    }
  });

  it("第一副牌一个字没改——没人因为这条兜底而变得更容易一把过", () => {
    let firstTry = 0;
    for (let i = 0; i < LEVELS.length; i++) if (coachCanWin(LEVELS[i], 0)) firstTry++;
    // 测试员那一轮的数字:188 关里 134 关照着提示打一把就过
    expect(firstTry).toBe(134);
  });

  it("脏参数不会误触发兜底", () => {
    expect(mercyRedeal(LEVELS[187], -5)).toBe(0);
    expect(mercyRedeal(LEVELS[187], Number.NaN)).toBe(0);
  });
});

describe("朵朵抢地主 · 连输两次之后帮着挑", () => {
  it("挑出来的那一副,照着教练提示打真的赢得下来", () => {
    for (const i of [80, 149, 152, 166, 169, 176, 187]) {
      const pick = mercyRedeal(LEVELS[i], MERCY_AFTER_LOSSES);
      expect(coachCanWin(LEVELS[i], pick), `第 ${i + 1} 关挑出来的牌照样赢不了`).toBe(true);
    }
  });

  it("只往后挑，不会把孩子退回已经打输过的那几副", () => {
    for (const i of [80, 149, 187]) {
      for (let b = MERCY_AFTER_LOSSES; b < 6; b++) expect(mercyRedeal(LEVELS[i], b)).toBeGreaterThanOrEqual(b);
    }
  });

  it("往后最多试 MERCY_SCAN 副,试不到就用原来那一副,绝不让孩子干等", () => {
    expect(MERCY_SCAN).toBeGreaterThan(0);
    for (const i of [0, 93, 187]) {
      for (let b = MERCY_AFTER_LOSSES; b < 6; b++) {
        expect(mercyRedeal(LEVELS[i], b)).toBeLessThan(b + MERCY_SCAN);
      }
    }
  });

  it("同一关同一次重开,挑出来的永远是同一副(不掺随机)", () => {
    for (const i of [80, 187]) {
      const a = mercyRedeal(LEVELS[i], 3);
      expect(mercyRedeal(LEVELS[i], 3)).toBe(a);
      expect(mercyRedeal(LEVELS[i], 3)).toBe(a);
    }
  });
});

describe("朵朵抢地主 · 全塔复算：连输次数的尾巴", () => {
  it("第 188 关不再要连输 5 次以上（测试员实测 5 次，本轮复算 6 次）", () => {
    expect(lossesToWin(187, false)).toBeGreaterThanOrEqual(5);
    expect(lossesToWin(187, true)).toBeLessThanOrEqual(MERCY_AFTER_LOSSES);
  });

  it("反例：本轮还揪出第 81 关也要连输 5 次，同一条兜底一起收掉", () => {
    expect(lossesToWin(80, false)).toBeGreaterThanOrEqual(5);
    expect(lossesToWin(80, true)).toBeLessThanOrEqual(MERCY_AFTER_LOSSES);
  });

  it("188 关一关不落：谁都不用连输超过 2 次", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const n = lossesToWin(i, true);
      if (n < 0 || n > MERCY_AFTER_LOSSES) bad.push(`第 ${i + 1} 关=${n}`);
    }
    expect(bad, `这些关还要连输超过 ${MERCY_AFTER_LOSSES} 次: ${bad.join(" ")}`).toEqual([]);
  });
});

describe("朵朵抢地主 · 接线（源码巡检）", () => {
  it("战役发牌走的是「换一副 + 连输两次帮着挑」这条路", () => {
    expect(INDEX).toContain("levelDealSeed(lv, mercyRedeal(lv, bump))");
  });

  it("关卡表本身一个字没改:兜底只发生在重开的那一刻", () => {
    expect(INDEX).not.toContain("boost: ");
    for (const lv of LEVELS) expect([0, 1, 2]).toContain(lv.boost);
  });

  it("♾️ 无尽与 ⚔️ 双人另有各自的换牌口径,没被这条兜底扫到", () => {
    expect(INDEX).toContain("endlessDealSeed(round.round, bump)");
    expect(INDEX).toContain("dealCards(920000 + round * 4523 + bump * 65537)");
  });
});
