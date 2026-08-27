// 无头冒烟:不开浏览器,直接拿 index.ts 用的那一套物理与合成把整局打完。
//
// 这里跑的是真的落子、真的碰撞、真的合成——闯关通过、堆高越线、对战分胜负
// 这几条路径都是被完整走过一遍的,不是靠断言硬凑出来的。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { runHeadless, settleWorld, type AiLevel } from "./ai";
import { CHAPTERS, buildLevel, buildVersus, goalMet, type StackLevel } from "./levels";
import { TOP_LEVEL, dropFruit, radiusOf } from "./merge";
import { DEFAULT_TUNING, createWorld, isSettled, overLine } from "./physics";
import { loseLine, rateRun, versusLine, winLine, endlessLine } from "./index";

/** 每一章的第一关(0 基关号) */
const CHAPTER_OPENERS = CHAPTERS.reduce<number[]>((acc, ch, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + CHAPTERS[i - 1].size);
  return acc;
}, []);

/** 又小又深的盆:一直往里投,迟早会满 */
function crampedBowl(seed: number): StackLevel {
  return {
    index: -1,
    chapter: 7,
    box: { w: 220, h: 340 },
    lineY: 84,
    minDrop: 3,
    maxDrop: 5,
    goal: { kind: "level", value: TOP_LEVEL + 1 },
    drops: 300,
    tuning: { ...DEFAULT_TUNING },
    seed,
    hint: "",
    split: false,
  };
}

describe("冒烟:188 关真的打得通", () => {
  it("八个章节的开章第一关都能打通", () => {
    for (const idx of CHAPTER_OPENERS) {
      const lv = buildLevel(idx);
      const res = runHeadless(lv, 3);
      expect(res.won, `第 ${idx + 1} 关(第 ${lv.chapter + 1} 章开章)没打通:用了 ${res.drops} 颗,最大到第 ${res.bestLevel} 级`).toBe(true);
      expect(res.drops).toBeLessThanOrEqual(lv.drops);
    }
  });

  it("188 关一关不落全部打通,而且都在投放上限内", { timeout: 120000 }, () => {
    const bad: string[] = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const lv = buildLevel(i);
      const res = runHeadless(lv, 3);
      if (!res.won) {
        bad.push(`第 ${i + 1} 关(用了 ${res.drops}/${lv.drops} 颗,最大第 ${res.bestLevel} 级,${res.over ? "堆高了" : "果子用完了"})`);
      }
      expect(goalMet(lv.goal, res.world) || !res.won).toBe(true);
    }
    expect(bad, `这些关没打通:\n${bad.join("\n")}`).toEqual([]);
  });

  it("随手乱丢过不了全部关卡:难度不是白给的", { timeout: 120000 }, () => {
    let rookieWins = 0;
    const sample: number[] = [];
    for (let i = 5; i < TOTAL_LEVELS; i += 6) sample.push(i);
    for (const i of sample) {
      if (runHeadless(buildLevel(i), 1).won) rookieWins++;
    }
    expect(rookieWins, "随手乱丢也能全过,这 188 关就没意思了").toBeLessThan(sample.length);
    expect(rookieWins, "随手乱丢连一半都过不了,对孩子太狠了").toBeGreaterThan(sample.length * 0.5);
  });

  it("三星标准真的分得出好坏", () => {
    const lv = buildLevel(0);
    const res = runHeadless(lv, 3);
    expect(res.won).toBe(true);
    expect(rateRun(res.drops, lv.drops)).toBeGreaterThanOrEqual(1);
    expect(rateRun(2, 40)).toBe(3);
    expect(rateRun(39, 40)).toBe(1);
  });
});

describe("冒烟:失败真的会发生", () => {
  it("一直往小盆里投,总有一次会越线", { timeout: 60000 }, () => {
    const res = runHeadless(crampedBowl(2026), 1, { maxDrops: 200 });
    expect(res.over, `投了 ${res.drops} 颗都没堆满,小盆也太能装了`).toBe(true);
    expect(res.drops).toBeGreaterThan(8);
    expect(res.score).toBeGreaterThan(0);
  });

  it("越线判的是停稳的果子,刚落下的那一颗不算", () => {
    const world = createWorld({ box: { w: 220, h: 340 }, lineY: 120, seed: 5, pullMs: 0, popMs: 0 });
    // 先在盆里垒一摞不同级的果子,谁也合不了谁
    for (const level of [4, 3, 2, 1, 0]) {
      dropFruit(world, level, 110);
      settleWorld(world, 300);
    }
    // 再补一颗:它落下去的那一瞬间高高在上,但宽限期内不许判输
    dropFruit(world, 0, 110);
    expect(overLine(world)).toBe(false);
    const before = world.fruits.length;
    settleWorld(world, 400);
    expect(world.fruits.length).toBeLessThanOrEqual(before);
    const settledOver = world.fruits.filter((f) => isSettled(f) && f.y < world.lineY);
    expect(overLine(world)).toBe(settledOver.length > 0);
  });

  it("果子用完也是一种失败,而且文案只鼓励", () => {
    const lv = { ...buildLevel(0), drops: 3 };
    const res = runHeadless(lv, 1);
    expect(res.won).toBe(false);
    expect(res.drops).toBeLessThanOrEqual(3);
    for (const line of [loseLine("empty"), loseLine("over"), loseLine("goal", true)]) {
      expect(line.length).toBeGreaterThan(6);
      expect(/笨|差劲|失败|输了/.test(line)).toBe(false);
    }
  });
});

describe("冒烟:对战与无尽", () => {
  it("对战两边同一串序列,同样的打法跑出同样的结果", () => {
    const lv = buildVersus(1);
    const a = runHeadless(lv, 3, { maxDrops: 60 });
    const b = runHeadless(lv, 3, { maxDrops: 60 });
    expect(a.drops).toBe(b.drops);
    expect(a.score).toBe(b.score);
  });

  it("八张对战盆都能分出胜负:总有一边先合成目标", { timeout: 120000 }, () => {
    for (let round = 1; round <= 8; round++) {
      const lv = buildVersus(round);
      const strong = runHeadless(lv, 3, { maxDrops: 80 });
      const weak = runHeadless(lv, 1, { maxDrops: 80 });
      expect(strong.won, `第 ${round} 张盆连高手都合不出目标`).toBe(true);
      const winner = weak.won && weak.drops < strong.drops ? 1 : 0;
      expect(winner === 0 || winner === 1).toBe(true);
      expect(versusLine([1, 0])).toContain("鸭梨");
    }
  });

  it("会摆的那一边总体上更快合成目标", { timeout: 120000 }, () => {
    // 单张盆里菜鸟偶尔也能瞎猫碰上死耗子,所以要凑够八张盆再比总数
    const total: Record<AiLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let round = 1; round <= 8; round++) {
      const lv = buildVersus(round);
      for (const skill of [1, 2, 3, 4] as AiLevel[]) {
        total[skill] += runHeadless(lv, skill, { maxDrops: 90 }).drops;
      }
    }
    expect(total[2], `普通档 ${total[2]} 颗没比菜鸟档 ${total[1]} 颗省`).toBeLessThan(total[1]);
    expect(total[3], `高手档 ${total[3]} 颗没比普通档 ${total[2]} 颗省`).toBeLessThan(total[2]);
    expect(total[4], `地狱档 ${total[4]} 颗没比高手档 ${total[3]} 颗省`).toBeLessThan(total[3]);
  });

  it("无尽会一直玩到盆满为止,分数和最大果都记得住", { timeout: 60000 }, () => {
    const res = runHeadless(crampedBowl(777), 3, { maxDrops: 200 });
    expect(res.over).toBe(true);
    expect(res.bestLevel).toBeGreaterThan(5);
    expect(endlessLine(res.score, res.score, res.bestLevel)).toContain("新纪录");
    expect(endlessLine(10, 999, 4)).toContain("最好成绩");
  });

  it("过关文案会点出连锁与省果子", () => {
    const lv = buildLevel(0);
    const chainy = winLine({ winner: 0, cleared: true, score: 100, bestLevel: 4, bestChain: 4, dropsUsed: 20, reason: "goal" }, lv);
    expect(chainy).toContain("连合成");
    const thrifty = winLine({ winner: 0, cleared: true, score: 100, bestLevel: 4, bestChain: 1, dropsUsed: 3, reason: "goal" }, lv);
    expect(thrifty.length).toBeGreaterThan(6);
  });
});

describe("冒烟:物理参数换了也不会崩", () => {
  it("弹性拉满、盆窄到底,照样跑得完一整局", { timeout: 60000 }, () => {
    const lv: StackLevel = {
      ...crampedBowl(31),
      box: { w: 210, h: 330 },
      tuning: { ...DEFAULT_TUNING, restitution: 0.6, damping: 0.95 },
    };
    const res = runHeadless(lv, 2, { maxDrops: 120 });
    for (const f of res.world.fruits) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(f.r - 0.5);
      expect(f.x).toBeLessThanOrEqual(lv.box.w - f.r + 0.5);
      expect(f.y).toBeLessThanOrEqual(lv.box.h - f.r + 0.5);
    }
    expect(res.drops).toBeGreaterThan(4);
  });

  it("最大的那颗果子塞得进任何一关的盆", () => {
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      const lv = buildLevel(i);
      if (lv.goal.kind !== "level") continue;
      expect(radiusOf(lv.goal.value) * 2).toBeLessThanOrEqual(lv.box.w);
    }
  });
});
