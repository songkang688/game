/**
 * 果果合成 · 对战判局的回归网（`R3-PA-FS-3`）。
 *
 * 原来 `checkEnd` 是四个分支挨个问，`winner` 每一支都被显式改写，
 * 于是「同一帧两边都达标」永远算 0 号赢，`roundOver()` 里那句「这一局打平」够不着；
 * 「1 号收摊」还被记成 `cleared: true, reason: "goal"`（康康堆爆了却写成鸭梨达标过关）。
 */
import { describe, expect, it } from "vitest";
import { decideRound, type BowlEnd } from "./index";

const idle: BowlEnd = { won: false, lost: false, left: 10 };

describe("单座（战役 / 无尽）", () => {
  it("没到收场时机就不给结论", () => {
    expect(decideRound([idle])).toBeNull();
  });

  it("达标就是过关", () => {
    expect(decideRound([{ ...idle, won: true }])).toEqual({ winner: 0, cleared: true, reason: "goal" });
  });

  it("果子用完与堆过警戒线分得开", () => {
    expect(decideRound([{ won: false, lost: true, left: 0 }])?.reason).toBe("empty");
    expect(decideRound([{ won: false, lost: true, left: 5 }])?.reason).toBe("over");
    expect(decideRound([{ won: false, lost: true, left: 0 }])?.cleared).toBe(false);
  });
});

describe("两座并排（人机对战 / 双人同屏）", () => {
  it("同一帧两边都达标 → 真打平，winner 留 -1", () => {
    expect(decideRound([{ ...idle, won: true }, { ...idle, won: true }])).toEqual({
      winner: -1,
      cleared: true,
      reason: "goal",
    });
  });

  it("同一帧两边都收摊 → 也是打平，不硬判一个赢家", () => {
    const v = decideRound([{ won: false, lost: true, left: 0 }, { won: false, lost: true, left: 0 }]);
    expect(v?.winner).toBe(-1);
    expect(v?.reason).toBe("empty");
  });

  it("只有一边达标就判那一边赢", () => {
    expect(decideRound([{ ...idle, won: true }, idle])?.winner).toBe(0);
    expect(decideRound([idle, { ...idle, won: true }])?.winner).toBe(1);
  });

  it("1 号收摊判 0 号赢，但口径跟着输的那一边走，不再写成「达标过关」", () => {
    const v = decideRound([idle, { won: false, lost: true, left: 3 }]);
    expect(v).toEqual({ winner: 0, cleared: false, reason: "over" });
    const v2 = decideRound([idle, { won: false, lost: true, left: 0 }]);
    expect(v2).toEqual({ winner: 0, cleared: false, reason: "empty" });
  });

  it("0 号收摊判 1 号赢，理由按 0 号那边的实情写", () => {
    expect(decideRound([{ won: false, lost: true, left: 0 }, idle])).toEqual({
      winner: 1,
      cleared: false,
      reason: "empty",
    });
  });

  it("达标优先于收摊：同一帧一边达标一边堆爆，算达标那边赢", () => {
    expect(decideRound([{ ...idle, won: true }, { won: false, lost: true, left: 2 }])?.winner).toBe(0);
    expect(decideRound([{ won: false, lost: true, left: 2 }, { ...idle, won: true }])?.winner).toBe(1);
  });

  it("两边都还在玩就不收场", () => {
    expect(decideRound([idle, idle])).toBeNull();
  });
});
