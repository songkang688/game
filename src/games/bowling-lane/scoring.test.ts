// 保龄球小馆 · 计分器单测。
//
// 计分是这款游戏的规则地基,所以这里钉得特别细:
// 300 分满分、全场补中、第十格的每一种收尾方式、以及打到一半时
// 「哪几格算得出分、哪几格还得等」都各来一条。
import { describe, expect, it } from "vitest";
import {
  cleanRoll,
  cleanRolls,
  frameMarks,
  maxRemaining,
  rollMark,
  scoreGame,
  totalScore,
  turnState,
} from "./scoring";

/** 把同一个数重复 n 次,拼投球记录用 */
function rep(v: number, n: number): number[] {
  return new Array<number>(n).fill(v);
}

describe("计分器 · 整局的经典分数", () => {
  it("十二个全中就是满分 300", () => {
    const game = scoreGame(rep(10, 12));
    expect(game.total).toBe(300);
    expect(game.complete).toBe(true);
    expect(game.frames).toHaveLength(10);
    expect(game.frames[0].score).toBe(30);
    expect(game.frames[9].score).toBe(30);
  });

  it("全场补中(每格 5 + 5)再加最后一球 5,总分 150", () => {
    const game = scoreGame(rep(5, 21));
    expect(game.total).toBe(150);
    expect(game.complete).toBe(true);
    for (const f of game.frames) expect(f.kind).toBe("spare");
  });

  it("每格都是 9 加 0 的失误球,总分 90,一分奖励都没有", () => {
    const rolls: number[] = [];
    for (let i = 0; i < 10; i++) rolls.push(9, 0);
    const game = scoreGame(rolls);
    expect(game.total).toBe(90);
    for (const f of game.frames) expect(f.kind).toBe("open");
  });

  it("洗澡球打满一整局是 0 分,但十格都算投完了", () => {
    const game = scoreGame(rep(0, 20));
    expect(game.total).toBe(0);
    expect(game.complete).toBe(true);
  });

  it("一个全中一个失误交替,奖励只加在全中那几格上", () => {
    // X 9- X 9- ... 共 5 组
    const rolls: number[] = [];
    for (let i = 0; i < 5; i++) rolls.push(10, 9, 0);
    const game = scoreGame(rolls);
    // 五个全中格各 10+9+0 = 19,五个失误格各 9 分
    expect(game.frames[0].score).toBe(19);
    expect(game.frames[1].score).toBe(9);
    expect(game.total).toBe(19 * 5 + 9 * 5);
  });

  it("补中后面跟一个全中:这一格拿到 20 分", () => {
    const game = scoreGame([4, 6, 10, 3, 2, ...rep(0, 12)]);
    expect(game.frames[0].kind).toBe("spare");
    expect(game.frames[0].score).toBe(20);
    expect(game.frames[1].score).toBe(15);
  });

  it("连着两个全中再补一个 5:第一格 25 分", () => {
    const game = scoreGame([10, 10, 5, 0, ...rep(0, 12)]);
    expect(game.frames[0].score).toBe(25);
    expect(game.frames[1].score).toBe(15);
    expect(game.frames[2].score).toBe(5);
  });
});

describe("计分器 · 第十格的各种收尾", () => {
  const nineOpens = (): number[] => {
    const rolls: number[] = [];
    for (let i = 0; i < 9; i++) rolls.push(0, 0);
    return rolls;
  };

  it("第十格三个全中,这一格 30 分", () => {
    const game = scoreGame([...nineOpens(), 10, 10, 10]);
    expect(game.frames[9].rolls).toEqual([10, 10, 10]);
    expect(game.frames[9].score).toBe(30);
    expect(game.total).toBe(30);
  });

  it("第十格全中之后没能再打光,三球照样相加", () => {
    const game = scoreGame([...nineOpens(), 10, 7, 2]);
    expect(game.frames[9].score).toBe(19);
    expect(game.frames[9].kind).toBe("strike");
  });

  it("第十格补中会多给一次加投", () => {
    const game = scoreGame([...nineOpens(), 6, 4, 8]);
    expect(game.frames[9].kind).toBe("spare");
    expect(game.frames[9].rolls).toEqual([6, 4, 8]);
    expect(game.frames[9].score).toBe(18);
  });

  it("第十格没打光就只有两球,不给加投", () => {
    const game = scoreGame([...nineOpens(), 6, 3, 9]);
    expect(game.frames[9].rolls).toEqual([6, 3]);
    expect(game.frames[9].score).toBe(9);
    expect(game.complete).toBe(true);
  });

  it("第十格全中后第二球没打完:第三球还是要投的", () => {
    const game = scoreGame([...nineOpens(), 10, 3]);
    expect(game.frames[9].done).toBe(false);
    expect(game.complete).toBe(false);
    const st = turnState([...nineOpens(), 10, 3]);
    expect(st).toEqual({ frame: 9, ball: 2, freshRack: false, standing: 7, over: false });
  });

  it("第九格全中要靠第十格的前两球算分", () => {
    const rolls: number[] = [];
    for (let i = 0; i < 8; i++) rolls.push(0, 0);
    const game = scoreGame([...rolls, 10, 10, 4, 0]);
    expect(game.frames[8].score).toBe(24);
    expect(game.frames[9].score).toBe(14);
  });

  it("第九格补中靠第十格第一球加分", () => {
    const rolls: number[] = [];
    for (let i = 0; i < 8; i++) rolls.push(0, 0);
    const game = scoreGame([...rolls, 7, 3, 9, 1, 10]);
    expect(game.frames[8].score).toBe(19);
    expect(game.frames[9].score).toBe(20);
  });
});

describe("计分器 · 打到一半的局", () => {
  it("刚投了一格的头一球,那一格还没算分", () => {
    const game = scoreGame([7]);
    expect(game.frames[0].rolls).toEqual([7]);
    expect(game.frames[0].done).toBe(false);
    expect(game.frames[0].score).toBeNull();
    expect(game.total).toBe(0);
    expect(game.complete).toBe(false);
  });

  it("刚打出全中,分数要等后面两球才结算", () => {
    const game = scoreGame([10]);
    expect(game.frames[0].kind).toBe("strike");
    expect(game.frames[0].done).toBe(true);
    expect(game.frames[0].score).toBeNull();
  });

  it("前面有一格没结算,后面的累计分先空着,总分只算已结算的", () => {
    const game = scoreGame([10, 4, 3]);
    expect(game.frames[0].score).toBe(17);
    expect(game.frames[1].score).toBe(7);
    expect(game.frames[1].running).toBe(24);
    expect(scoreGame([10, 4]).frames[1].running).toBeNull();
    expect(scoreGame([10, 4]).total).toBe(0);
  });

  it("一球都没投时十格全是空的", () => {
    const game = scoreGame([]);
    expect(game.frames).toHaveLength(10);
    expect(game.frames.every((f) => f.kind === "none" && f.rolls.length === 0)).toBe(true);
    expect(game.total).toBe(0);
  });
});

describe("计分器 · 短局与异常输入", () => {
  it("闯关一关只打三格,用的还是同一套规则", () => {
    // 三格制的最后一格照样有加投,所以全中打满要投五球
    const game = scoreGame([10, 10, 10, 10, 10], 3);
    expect(game.frames).toHaveLength(3);
    expect(game.frames[0].score).toBe(30);
    expect(game.frames[2].rolls).toEqual([10, 10, 10]);
    expect(game.total).toBe(90);
    expect(game.complete).toBe(true);
  });

  it("两格制:第一格全中要靠第二格的两球加分", () => {
    const game = scoreGame([10, 9, 1, 5], 2);
    expect(game.frames[0].score).toBe(20);
    expect(game.frames[1].score).toBe(15);
    expect(game.total).toBe(35);
  });

  it("负数、小数、超过 10 的瓶数都会被夹回合法范围", () => {
    expect(cleanRoll(-3)).toBe(0);
    expect(cleanRoll(11)).toBe(10);
    expect(cleanRoll(6.4)).toBe(6);
    expect(cleanRoll(Number.NaN)).toBe(0);
    expect(cleanRoll("七" as unknown)).toBe(0);
    expect(cleanRolls([-1, 3.6, 99])).toEqual([0, 4, 10]);
  });

  it("totalScore 是 scoreGame 的快捷方式", () => {
    expect(totalScore(rep(10, 12))).toBe(300);
    // 只打一格时这一格就是加投格:补中之后还能再投一球
    expect(totalScore([5, 5, 3], 1)).toBe(13);
  });
});

describe("下一球该怎么投", () => {
  it("开局就是第一格第一球,满架 10 瓶", () => {
    expect(turnState([])).toEqual({ frame: 0, ball: 0, freshRack: true, standing: 10, over: false });
  });

  it("第一球打倒 4 瓶,第二球接着打站着的 6 瓶,不重新摆", () => {
    expect(turnState([4])).toEqual({ frame: 0, ball: 1, freshRack: false, standing: 6, over: false });
  });

  it("全中之后直接进下一格,重新摆满一架", () => {
    expect(turnState([10])).toEqual({ frame: 1, ball: 0, freshRack: true, standing: 10, over: false });
  });

  it("第十格第一球全中,加投要重新摆满", () => {
    const rolls: number[] = [];
    for (let i = 0; i < 9; i++) rolls.push(10);
    expect(turnState([...rolls, 10])).toEqual({ frame: 9, ball: 1, freshRack: true, standing: 10, over: false });
  });

  it("整局投完之后 over 为真", () => {
    expect(turnState(rep(10, 12)).over).toBe(true);
    expect(turnState(rep(0, 20)).over).toBe(true);
    expect(turnState(rep(5, 21)).over).toBe(true);
  });

  it("maxRemaining 会随着局数推进一路降到 0", () => {
    expect(maxRemaining([])).toBe(300);
    expect(maxRemaining([10])).toBe(270);
    expect(maxRemaining(rep(10, 12))).toBe(0);
  });
});

describe("记分牌上的记号", () => {
  it("全中记 X,补中记 /,没打中记 -", () => {
    const game = scoreGame([10, 7, 3, 0, 4]);
    expect(frameMarks(game.frames[0])).toBe("X");
    expect(frameMarks(game.frames[1])).toBe("7 /");
    expect(frameMarks(game.frames[2])).toBe("- 4");
  });

  it("第十格连着两个全中,两球都记 X", () => {
    const rolls: number[] = [];
    for (let i = 0; i < 9; i++) rolls.push(0, 0);
    const game = scoreGame([...rolls, 10, 10, 3]);
    expect(frameMarks(game.frames[9])).toBe("X X 3");
  });

  it("没投的球没有记号", () => {
    const game = scoreGame([]);
    expect(rollMark(game.frames[0], 0)).toBe("");
    expect(frameMarks(game.frames[0])).toBe("");
  });
});
