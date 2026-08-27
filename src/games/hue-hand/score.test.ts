import { describe, expect, it } from "vitest";
import { buildDeck, type Card } from "./deck";
import { addRound, handScore, leftoverLine, matchWinner, roundScore, scoreLine } from "./score";

const DECK = buildDeck();
const pick = (kind: Card["kind"], num?: number): Card =>
  DECK.find((c) => c.kind === kind && (num === undefined || c.num === num))!;

describe("手牌计分", () => {
  it("数字按面值,功能牌 20,万能牌 50", () => {
    const hand = [pick("num", 9), pick("num", 3), pick("skip"), pick("wild4")];
    expect(handScore(hand)).toBe(9 + 3 + 20 + 50);
  });

  it("空手是 0 分", () => {
    expect(handScore([])).toBe(0);
  });

  it("赢家收下其余所有人手上的分", () => {
    const hands = [[], [pick("num", 7)], [pick("draw2"), pick("wild")]];
    expect(roundScore(hands, 0)).toBe(7 + 20 + 50);
    expect(roundScore(hands, 1)).toBe(20 + 50);
  });
});

describe("积分赛", () => {
  it("分数累加进总分表,不改原来的表", () => {
    const totals = [10, 0];
    const next = addRound(totals, 1, 35);
    expect(next).toEqual([10, 35]);
    expect(totals).toEqual([10, 0]);
  });

  it("先到目标分的人赢下整场,都没到就是 -1", () => {
    expect(matchWinner([120, 60], 100)).toBe(0);
    expect(matchWinner([60, 90], 100)).toBe(-1);
    expect(matchWinner([160, 190], 100)).toBe(1);
  });

  it("结算文案说得清还差多少分", () => {
    expect(scoreLine(30, 70, 100)).toContain("还差 30 分");
    expect(scoreLine(30, 100, 100)).toContain("整场拿下");
  });

  it("没赢的时候只鼓励,不说难听话", () => {
    expect(leftoverLine(1)).toContain("差一张");
    expect(leftoverLine(6)).toContain("下一局");
    for (const n of [0, 1, 3, 8]) {
      expect(leftoverLine(n)).not.toMatch(/笨|差劲|真菜/);
    }
  });
});
