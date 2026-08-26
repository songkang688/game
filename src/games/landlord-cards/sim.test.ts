import { describe, expect, it } from "vitest";
import { dealCards, parsePlay } from "./logic";
import type { AiLevel } from "./ai";
import {
  createGame,
  findWinningLine,
  isFarmer,
  nextSeat,
  replayLine,
  runBidding,
  runTable,
  settleGame,
  simulateGame,
  tryMove,
  winRate,
  MAX_STEPS,
  type ProveInput,
  type SeatPolicy,
} from "./sim";

const RANK_OF: Record<string, number> = {
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  "2": 15,
};

function cards(spec: string): number[] {
  const used = new Map<number, number>();
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const r = RANK_OF[tok];
      const n = used.get(r) ?? 0;
      used.set(r, n + 1);
      return (r - 3) * 4 + n;
    });
}

/** 搭一个小局面:三家手牌自己指定,地主是 0 号位 */
function tinyGame(hands: number[][], bottom: number[] = []) {
  return createGame({ hands, bottom, landlord: 0, base: 2 });
}

describe("座位", () => {
  it("下一家是循环的", () => {
    expect(nextSeat(0)).toBe(1);
    expect(nextSeat(2)).toBe(0);
  });

  it("除了地主都是农民", () => {
    expect(isFarmer(0, 0)).toBe(false);
    expect(isFarmer(1, 0)).toBe(true);
  });
});

describe("叫分", () => {
  it("三家里最想当地主的那家当地主", () => {
    const hands = [cards("3 4 5 6 7"), cards("2 2 2 2 A A A"), cards("3 3 4 4 5 5")];
    const bid = runBidding(hands, 0);
    expect(bid?.landlord).toBe(1);
    expect(bid?.base).toBeGreaterThan(0);
  });

  it("三家都不想叫就流局", () => {
    const hands = [cards("3 4 5 6 7"), cards("3 4 5 6 7"), cards("3 4 5 6 7")];
    expect(runBidding(hands, 0)).toBeNull();
  });

  it("同一副牌叫分结果永远一样", () => {
    const d = dealCards(555);
    expect(runBidding(d.hands, 0)).toEqual(runBidding(d.hands, 0));
  });
});

describe("开局", () => {
  it("底牌进地主手里,地主先出", () => {
    const d = dealCards(2024);
    const g = createGame({ hands: d.hands, bottom: d.bottom, landlord: 1, base: 2 });
    expect(g.hands[1]).toHaveLength(20);
    expect(g.hands[0]).toHaveLength(17);
    expect(g.turn).toBe(1);
    expect(g.prev).toBeNull();
  });

  it("底分会被夹到 1..3", () => {
    const d = dealCards(1);
    expect(createGame({ hands: d.hands, bottom: d.bottom, landlord: 0, base: 9 }).base).toBe(3);
    expect(createGame({ hands: d.hands, bottom: d.bottom, landlord: 0, base: 0 }).base).toBe(1);
  });
});

describe("出牌规则", () => {
  it("先手不能「不要」", () => {
    const g = tinyGame([cards("3 4"), cards("5"), cards("6")]);
    const res = tryMove(g, []);
    expect(res.ok).toBe(false);
    expect(g.turn).toBe(0);
  });

  it("手里没有的牌出不了", () => {
    const g = tinyGame([cards("3 4"), cards("5"), cards("6")]);
    expect(tryMove(g, cards("A")).ok).toBe(false);
  });

  it("凑不成牌型出不了", () => {
    const g = tinyGame([cards("3 4"), cards("5"), cards("6")]);
    expect(tryMove(g, g.hands[0]).ok).toBe(false);
  });

  it("压不住上一手就出不了", () => {
    const g = tinyGame([cards("9 9"), cards("3 3"), cards("6 6")]);
    expect(tryMove(g, cards("9 9")).ok).toBe(true);
    expect(tryMove(g, [g.hands[1][0], g.hands[1][1]]).ok).toBe(false);
  });

  it("两家连着「不要」,出牌权回到最后出牌的那家", () => {
    const g = tinyGame([cards("9 9 3"), cards("3 3 4"), cards("6 6 5")]);
    expect(tryMove(g, cards("9 9")).ok).toBe(true);
    expect(g.turn).toBe(1);
    expect(tryMove(g, []).ok).toBe(true);
    expect(tryMove(g, []).ok).toBe(true);
    expect(g.turn).toBe(0);
    expect(g.prev).toBeNull();
  });

  it("出完最后一张牌就赢了", () => {
    const g = tinyGame([cards("9"), cards("3 3"), cards("6 6")]);
    tryMove(g, cards("9"));
    expect(g.finished).toBe(true);
    expect(g.winner).toBe(0);
  });

  it("结束之后再出牌会被拦住", () => {
    const g = tinyGame([cards("9"), cards("3 3"), cards("6 6")]);
    tryMove(g, cards("9"));
    expect(tryMove(g, cards("3 3")).ok).toBe(false);
  });

  it("炸弹会被记下来算翻倍", () => {
    const g = tinyGame([cards("5 5 5 5 3"), cards("3 3 4"), cards("6 6 7")]);
    tryMove(g, cards("5 5 5 5"));
    expect(g.bombs).toBe(1);
  });

  it("每一手都进战报", () => {
    const g = tinyGame([cards("9 9 3"), cards("3 3 4"), cards("6 6 5")]);
    tryMove(g, cards("9 9"));
    tryMove(g, []);
    expect(g.history).toHaveLength(2);
    expect(g.history[0].play?.type).toBe("pair");
    expect(g.history[1].play).toBeNull();
  });
});

describe("结算", () => {
  it("地主一口气走完 = 春天,倍数翻上去", () => {
    const g = tinyGame([cards("3 4 5 6 7"), cards("9 9"), cards("10 10")]);
    tryMove(g, cards("3 4 5 6 7"));
    const s = settleGame(g);
    expect(s.landlordWon).toBe(true);
    expect(s.spring).toBe(true);
    expect(s.multiplier).toBe(2);
    expect(s.score).toBe(4);
  });

  it("地主只出了第一手就被农民走完 = 反春天", () => {
    const g = tinyGame([cards("3 9 9"), cards("4"), cards("5")]);
    tryMove(g, cards("3"));
    expect(tryMove(g, cards("4")).ok).toBe(true);
    const s = settleGame(g);
    expect(s.landlordWon).toBe(false);
    expect(s.antiSpring).toBe(true);
    expect(s.score).toBe(-4);
  });

  it("农民出过牌就没有春天", () => {
    const g = tinyGame([cards("3 4 5 6 7 9 2"), cards("10 J"), cards("Q K")]);
    tryMove(g, cards("9"));
    tryMove(g, cards("10"));
    tryMove(g, cards("Q"));
    tryMove(g, cards("2"));
    tryMove(g, []);
    tryMove(g, []);
    tryMove(g, cards("3 4 5 6 7"));
    const s = settleGame(g);
    expect(s.landlordWon).toBe(true);
    expect(s.spring).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 自对弈:固定 seed 跑 200 局,量一量三档到底差多少
// ---------------------------------------------------------------------------

const GAMES = 200;

describe("自对弈 200 局", () => {
  it("每一局都能正常打完,不会卡住", () => {
    for (let i = 0; i < GAMES; i++) {
      const r = simulateGame(3000 + i, ["hard", "normal", "easy"]);
      expect(r.steps).toBeLessThan(MAX_STEPS);
      expect([0, 1, 2]).toContain(r.winner);
      expect(r.settle.score).not.toBe(0);
    }
  });

  it("同一个 seed 跑两遍结果完全一样", () => {
    for (const seed of [11, 222, 3333, 44444]) {
      expect(simulateGame(seed, ["hard", "easy", "normal"])).toEqual(simulateGame(seed, ["hard", "easy", "normal"]));
    }
  });

  it("困难档当地主的胜率显著高于简单档(同样 200 副牌)", () => {
    const easy = winRate(GAMES, ["easy", "easy", "easy"], "landlord");
    const hard = winRate(GAMES, ["hard", "easy", "easy"], "landlord");
    expect(easy).toBeLessThan(0.45);
    expect(hard).toBeGreaterThan(0.7);
    expect(hard - easy).toBeGreaterThan(0.3);
    expect(hard).toBeGreaterThan(easy * 1.8);
  });

  it("困难档当农民的胜率也显著高于简单档(地主固定普通档)", () => {
    const easy = winRate(GAMES, ["normal", "easy", "easy"], "farmer");
    const hard = winRate(GAMES, ["normal", "hard", "hard"], "farmer");
    expect(hard).toBeGreaterThan(0.5);
    expect(hard - easy).toBeGreaterThan(0.3);
  });

  it("普通档夹在中间:比简单强,不比困难强", () => {
    const easy = winRate(GAMES, ["easy", "easy", "easy"], "landlord");
    const normal = winRate(GAMES, ["normal", "easy", "easy"], "landlord");
    const hard = winRate(GAMES, ["hard", "easy", "easy"], "landlord");
    expect(normal).toBeGreaterThan(easy);
    expect(normal).toBeLessThanOrEqual(hard);
  });

  it("换一批 seed 结论一样,不是挑出来的巧合", () => {
    for (const seed0 of [5000, 90000]) {
      const easy = winRate(GAMES, ["easy", "easy", "easy"], "landlord", seed0);
      const hard = winRate(GAMES, ["hard", "easy", "easy"], "landlord", seed0);
      expect(hard - easy).toBeGreaterThan(0.3);
    }
  });

  it("困难档对困难档时地主优势回到合理区间", () => {
    const both = winRate(GAMES, ["hard", "hard", "hard"], "landlord");
    expect(both).toBeGreaterThan(0.35);
    expect(both).toBeLessThan(0.75);
  });
});

// ---------------------------------------------------------------------------
// 1.2:三档各 20 局的对照、可赢线路搜索、本地两人打到结算
// ---------------------------------------------------------------------------

describe("固定 seed 各 20 局:高档明显更强", () => {
  const N = 20;
  const SEED0 = 424242;

  it("当地主时 厉害 与 认真 都明显强过轻松档(同样 20 副牌)", () => {
    const easy = winRate(N, ["easy", "easy", "easy"], "landlord", SEED0);
    const normal = winRate(N, ["normal", "easy", "easy"], "landlord", SEED0);
    const hard = winRate(N, ["hard", "easy", "easy"], "landlord", SEED0);
    expect(normal).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(easy);
    expect(hard - easy).toBeGreaterThan(0.25);
    // 20 局里 认真 与 厉害 谁高谁低是噪声,两档谁都不该跌回轻松档那一档
    expect(Math.min(normal, hard)).toBeGreaterThan(easy + 0.2);
  });

  it("当农民时也是同一个次序(地主固定认真档)", () => {
    const easy = winRate(N, ["normal", "easy", "easy"], "farmer", SEED0);
    const hard = winRate(N, ["normal", "hard", "hard"], "farmer", SEED0);
    expect(hard).toBeGreaterThan(easy);
    expect(hard - easy).toBeGreaterThan(0.25);
  });

  it("这 20 局本身是可重复的:同样的档位组合跑两遍数字一样", () => {
    const a = winRate(N, ["hard", "easy", "easy"], "landlord", SEED0);
    const b = winRate(N, ["hard", "easy", "easy"], "landlord", SEED0);
    expect(a).toBe(b);
  });
});

describe("可赢线路搜索", () => {
  function proveInput(seed: number, over: Partial<ProveInput> = {}): ProveInput {
    const d = dealCards(seed);
    return {
      hands: d.hands,
      bottom: d.bottom,
      playerSeat: 0,
      presetLandlord: 0,
      base: 2,
      aiLevel: "normal",
      seed,
      ...over,
    };
  }

  it("搜到的线路重放一遍真的能赢", () => {
    for (const seed of [777, 4242, 90210]) {
      const input = proveInput(seed);
      const line = findWinningLine(input);
      expect(line, `seed ${seed} 搜不到能赢的线路`).not.toBeNull();
      expect(replayLine(input, line!)).toBe(true);
    }
  }, 60000);

  it("线路里每一步都轮得上那一家,顺序不能乱", () => {
    const input = proveInput(4242);
    const line = findWinningLine(input)!;
    expect(line.moves.length).toBeGreaterThan(2);
    const bad = { ...line, moves: [...line.moves].reverse() };
    expect(replayLine(input, bad)).toBe(false);
  }, 60000);

  it("少走一步就不算赢:重放器不会睁一只眼闭一只眼", () => {
    const input = proveInput(777);
    const line = findWinningLine(input)!;
    const short = { ...line, moves: line.moves.slice(0, -1) };
    expect(replayLine(input, short)).toBe(false);
  }, 60000);

  it("同一副牌搜两次给的是同一条线路(确定性)", () => {
    const input = proveInput(90210);
    expect(findWinningLine(input)).toEqual(findWinningLine(input));
  }, 60000);

  it("带「不用炸弹」的目标去搜,搜出来的线路里玩家一个炸都没用", () => {
    const input = proveInput(4242);
    const line = findWinningLine(input, 1600, { noBomb: true });
    expect(line).not.toBeNull();
    expect(line!.playerBombs).toBe(0);
    expect(replayLine(input, line!)).toBe(true);
  }, 60000);
});

describe("本地两人 + 1 电脑打到结算", () => {
  const twoHumans: SeatPolicy[] = ["coach", "coach", "ai"];

  it("两个真人座位照着提示打,一路能打到结算,不会卡在半路", () => {
    for (const seed of [1234, 5678, 9012]) {
      const d = dealCards(seed);
      const r = runTable({ hands: d.hands, bottom: d.bottom, landlord: 0, base: 2 }, twoHumans, "normal", seed);
      expect(r.state.finished).toBe(true);
      expect([0, 1, 2]).toContain(r.state.winner);
      expect(r.steps).toBeLessThan(MAX_STEPS);
      expect(r.state.hands[r.state.winner!]).toHaveLength(0);
      expect(r.settle.score).not.toBe(0);
    }
  });

  it("换谁当地主都能打完,结算的正负跟着地主输赢走", () => {
    for (const landlord of [0, 1, 2]) {
      const d = dealCards(30303);
      const r = runTable({ hands: d.hands, bottom: d.bottom, landlord, base: 2 }, twoHumans, "hard", 30303);
      expect(r.state.finished).toBe(true);
      expect(r.settle.landlordWon).toBe(r.state.winner === landlord);
      expect(r.settle.score > 0).toBe(r.settle.landlordWon);
    }
  });

  it("同一副牌跑两遍结果完全一样", () => {
    const d = dealCards(8888);
    const mk = (): ReturnType<typeof runTable> =>
      runTable({ hands: d.hands, bottom: d.bottom, landlord: 1, base: 3 }, twoHumans, "normal", 8888);
    expect(mk()).toEqual(mk());
  });

  it("三家全交给电脑也一样收得了场(四种模式共用同一套引擎)", () => {
    const d = dealCards(24680);
    const levels: AiLevel[] = ["hard", "normal", "easy"];
    const r = runTable({ hands: d.hands, bottom: d.bottom, landlord: 2, base: 1 }, ["ai", "ai", "ai"], levels[0], 24680);
    expect(r.state.finished).toBe(true);
    expect(r.state.history.length).toBeGreaterThan(3);
  });
});
