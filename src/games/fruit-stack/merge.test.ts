import { describe, expect, it } from "vitest";
import {
  CHAIN,
  MAX_LEVEL,
  TOP_MERGE_BONUS,
  TOP_MERGE_MODE,
  chainMerges,
  chainMultiplier,
  highestLevel,
  nextFruit,
  scoreFor,
  totalScore,
  tryMerge,
} from "./merge";
import { addCircle, makeWorld, type Box } from "./physics";

const BOX: Box = { left: 0, right: 320, floor: 420, line: 80 };

function world() {
  return makeWorld(BOX);
}

describe("果果合成 · 合成链", () => {
  it("链上一共 11 级，半径逐级变大", () => {
    expect(CHAIN.length).toBe(11);
    expect(MAX_LEVEL).toBe(10);
    for (let i = 1; i < CHAIN.length; i++) {
      expect(CHAIN[i].r).toBeGreaterThan(CHAIN[i - 1].r);
      expect(CHAIN[i].score).toBeGreaterThan(CHAIN[i - 1].score);
    }
  });

  it("同级两果相碰合成下一级", () => {
    const w = world();
    addCircle(w, 1, 100, 300, CHAIN[1].r);
    addCircle(w, 1, 100 + CHAIN[1].r * 2 - 1, 300, CHAIN[1].r);
    const events = tryMerge(w);
    expect(events.length).toBe(1);
    expect(events[0].level).toBe(2);
    expect(w.circles.length).toBe(1);
    expect(w.circles[0].level).toBe(2);
  });

  it("不同级的两果不会合成", () => {
    const w = world();
    addCircle(w, 1, 100, 300, CHAIN[1].r);
    addCircle(w, 2, 100 + CHAIN[1].r + CHAIN[2].r - 1, 300, CHAIN[2].r);
    expect(tryMerge(w)).toEqual([]);
    expect(w.circles.length).toBe(2);
  });

  it("新果子出现在两颗的正中间", () => {
    const w = world();
    addCircle(w, 0, 100, 300, CHAIN[0].r);
    addCircle(w, 0, 112, 308, CHAIN[0].r);
    const events = tryMerge(w);
    expect(events.length).toBe(1);
    expect(events[0].x).toBeCloseTo(106, 5);
    expect(events[0].y).toBeCloseTo(304, 5);
  });

  it("离得远的同级果子不会隔空合成", () => {
    const w = world();
    addCircle(w, 3, 60, 300, CHAIN[3].r);
    addCircle(w, 3, 260, 300, CHAIN[3].r);
    expect(tryMerge(w)).toEqual([]);
  });

  it("连锁会一段一段结算，倍率逐段提高", () => {
    const w = world();
    // 四颗籽紧挨着排成一排：第一轮合出两颗莓，第二轮再合成一颗柑
    for (let i = 0; i < 4; i++) addCircle(w, 0, 100 + i * 15, 300, CHAIN[0].r);
    const rounds = chainMerges(w);
    expect(rounds.length).toBeGreaterThanOrEqual(2);
    expect(rounds[0].length).toBe(2);
    expect(totalScore(rounds)).toBeGreaterThan(0);
    expect(chainMultiplier(1)).toBeGreaterThan(chainMultiplier(0));
  });

  it("最高级相碰按常量走：合成一颗新的最高级并额外加大分", () => {
    const w = world();
    const r = CHAIN[MAX_LEVEL].r;
    addCircle(w, MAX_LEVEL, 120, 300, r);
    addCircle(w, MAX_LEVEL, 120 + r * 2 - 1, 300, r);
    const events = tryMerge(w);
    expect(TOP_MERGE_MODE).toBe("keepTop");
    expect(events.length).toBe(1);
    expect(events[0].level).toBe(MAX_LEVEL);
    expect(events[0].score).toBeGreaterThanOrEqual(TOP_MERGE_BONUS);
    expect(w.circles.length).toBe(1);
    expect(w.circles[0].level).toBe(MAX_LEVEL);
  });

  it("得分随等级和连锁段数提高", () => {
    expect(scoreFor(3, 0)).toBeGreaterThan(scoreFor(1, 0));
    expect(scoreFor(3, 2)).toBeGreaterThan(scoreFor(3, 0));
  });

  it("highestLevel 报告场上最高的一颗", () => {
    const w = world();
    addCircle(w, 2, 60, 300, CHAIN[2].r);
    addCircle(w, 6, 200, 300, CHAIN[6].r);
    expect(highestLevel(w)).toBe(6);
  });

  it("投放序列可种子化，同一个 seed 每次一样", () => {
    const a = Array.from({ length: 30 }, (_, i) => nextFruit(99, i, 4));
    const b = Array.from({ length: 30 }, (_, i) => nextFruit(99, i, 4));
    expect(a).toEqual(b);
    expect(Math.max(...a)).toBeLessThanOrEqual(4);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
  });

  it("投放序列里小果子明显比大果子多", () => {
    const seq = Array.from({ length: 400 }, (_, i) => nextFruit(7, i, 4));
    const zeros = seq.filter((x) => x === 0).length;
    const fours = seq.filter((x) => x === 4).length;
    expect(zeros).toBeGreaterThan(fours);
  });
});
