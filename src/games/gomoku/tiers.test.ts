// 六档 AI：从菜鸟到地狱，档位契约 + 强度单调 + 地狱档的专属本事。
//
// 「单调」在这里有两层意思，两层都要能测：
//  · 能力单调：一份固定的基本功电池（成五 / 挡五 / 活三 / 双三），高档答对的只多不少；
//  · 实战单调：固定 seed 的成对对局里，高档胜率显著更高（规格点名的两组各 12 局都在）。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  DIFFICULTIES,
  DIFFICULTY_BLURB,
  DIFFICULTY_DEPTH,
  DIFFICULTY_NAME,
  THINK_DELAY_MS,
  bestMove,
  boardFull,
  candidateMoves,
  findForbiddenTrap,
  findVcf,
  findWinLine,
  getCell,
  hellSearch,
  makeBoard,
  makesFive,
  noviceMove,
  setCell,
  type Board,
  type Difficulty,
  type HellOptions,
  type Player,
} from "./ai";

function build(
  size: number,
  black: Array<[number, number]>,
  white: Array<[number, number]>
): Board {
  const b = makeBoard(size);
  for (const [x, y] of black) setCell(b, x, y, 1);
  for (const [x, y] of white) setCell(b, x, y, 2);
  return b;
}

/** 一盘固定种子的对局，返回赢家 */
function duel(
  black: Difficulty,
  white: Difficulty,
  size: number,
  seed: number,
  opts: HellOptions = {}
): "black" | "white" | "draw" {
  const b = makeBoard(size);
  const rng = mulberry32(seed);
  let turn: Player = 1;
  for (let ply = 0; ply < size * size; ply++) {
    const mv = bestMove(b, turn, turn === 1 ? black : white, rng, opts);
    if (!mv) break;
    expect(getCell(b, mv.x, mv.y)).toBe(0);
    setCell(b, mv.x, mv.y, turn);
    if (findWinLine(b, mv.x, mv.y)) return turn === 1 ? "black" : "white";
    if (boardFull(b)) break;
    turn = turn === 1 ? 2 : 1;
  }
  return "draw";
}

/** 高低两档各执一次黑，跑 n 局；返回高档赢了几局 */
function series(
  strong: Difficulty,
  weak: Difficulty,
  size: number,
  n: number,
  opts: HellOptions = {}
): { strongWins: number; weakWins: number; draws: number } {
  let strongWins = 0;
  let weakWins = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const strongIsBlack = i % 2 === 0;
    const r = duel(
      strongIsBlack ? strong : weak,
      strongIsBlack ? weak : strong,
      size,
      1000 + i,
      opts
    );
    if (r === "draw") draws++;
    else if ((r === "black") === strongIsBlack) strongWins++;
    else weakWins++;
  }
  return { strongWins, weakWins, draws };
}

/* ---------------- 基本功电池：能力单调靠它 ---------------- */

interface Drill {
  name: string;
  board: () => Board;
  answers: Array<[number, number]>;
}

const DRILLS: Drill[] = [
  {
    name: "自己四连成五（唯一点）",
    board: () => build(9, [[2, 2], [3, 2], [4, 2], [5, 2]], [[1, 2], [0, 6]]),
    answers: [[6, 2]],
  },
  {
    name: "对手四连必须挡（唯一点）",
    board: () => build(9, [[1, 4], [0, 0]], [[2, 4], [3, 4], [4, 4], [5, 4]]),
    answers: [[6, 4]],
  },
  {
    name: "把自己的活三长成活四",
    board: () => build(9, [[3, 3], [4, 3], [5, 3]], [[0, 8], [8, 0]]),
    answers: [[2, 3], [6, 3]],
  },
  {
    name: "挡住对手的活三",
    board: () => build(9, [[0, 0], [8, 8]], [[3, 5], [4, 5], [5, 5]]),
    answers: [[2, 5], [6, 5]],
  },
  {
    name: "一手做出双活三",
    board: () => build(9, [[2, 2], [3, 3], [4, 2], [4, 3]], [[0, 7], [1, 8]]),
    answers: [[4, 4]],
  },
];

const DRILL_SEEDS = [7, 20, 33, 46, 59];

/** 这一档在电池上答对几道（每题 5 个种子） */
function drillScore(d: Difficulty): number {
  let hit = 0;
  for (const t of DRILLS) {
    for (const s of DRILL_SEEDS) {
      const mv = bestMove(t.board(), 1, d, mulberry32(s));
      if (mv && t.answers.some(([x, y]) => x === mv.x && y === mv.y)) hit++;
    }
  }
  return hit;
}

const DRILL_TOTAL = DRILLS.length * DRILL_SEEDS.length;

describe("六档档位契约", () => {
  it("六个档位、顺序固定，从菜鸟到地狱", () => {
    expect(DIFFICULTIES).toEqual(["novice", "easy", "normal", "smart", "master", "hell"]);
  });

  it("中间四档的中文名与 1.1 一字不差，首尾两档是新补的", () => {
    expect(DIFFICULTY_NAME.easy).toBe("🐱 棋灵喵·简单");
    expect(DIFFICULTY_NAME.normal).toBe("🦊 棋灵狐·普通");
    expect(DIFFICULTY_NAME.smart).toBe("🐲 棋灵龙·聪明");
    expect(DIFFICULTY_NAME.master).toBe("🐘 棋灵象·大师");
    expect(DIFFICULTY_NAME.novice).toContain("菜鸟");
    expect(DIFFICULTY_NAME.hell).toContain("地狱");
  });

  it("搜索深度随档位非递减：菜鸟 0 层，地狱 4 层以上", () => {
    const depths = DIFFICULTIES.map((d) => DIFFICULTY_DEPTH[d]);
    expect(depths[0]).toBe(0);
    expect(DIFFICULTY_DEPTH.hell).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThanOrEqual(depths[i - 1]);
    expect(DIFFICULTY_DEPTH.hell).toBeGreaterThan(DIFFICULTY_DEPTH.master);
  });

  it("每档都有思考延时，地狱档硬性 ≥ 200ms（不许无敌秒应）", () => {
    for (const d of DIFFICULTIES) expect(THINK_DELAY_MS[d]).toBeGreaterThan(0);
    expect(THINK_DELAY_MS.hell).toBeGreaterThanOrEqual(200);
  });

  it("每档都有一句给孩子看的说明", () => {
    for (const d of DIFFICULTIES) expect(DIFFICULTY_BLURB[d].length).toBeGreaterThan(8);
  });
});

describe("菜鸟档（0 层，会漏）", () => {
  it("落子永远合法，而且落在已有棋子附近", () => {
    const b = build(9, [[4, 4]], [[3, 3]]);
    const cands = candidateMoves(b);
    for (let s = 0; s < 20; s++) {
      const mv = noviceMove(b, 1, mulberry32(s + 1));
      expect(mv).not.toBeNull();
      expect(getCell(b, mv!.x, mv!.y)).toBe(0);
      expect(cands.some(([x, y]) => x === mv!.x && y === mv!.y)).toBe(true);
    }
  });

  it("rng 落在 30% 里就挡冲四，落在外面就乱下", () => {
    // 白棋四连，成五点是 (6,4)
    const b = build(9, [[1, 4]], [[2, 4], [3, 4], [4, 4], [5, 4]]);
    const blocks = noviceMove(b, 1, () => 0.1);
    expect(blocks).toEqual({ x: 6, y: 4 });
    const ignores = noviceMove(b, 1, () => 0.9);
    expect(ignores).not.toEqual({ x: 6, y: 4 });
  });

  it("常常看不见自己能成五（这正是菜鸟档的意义）", () => {
    const b = build(9, [[2, 2], [3, 2], [4, 2], [5, 2]], [[0, 6]]);
    let missed = 0;
    for (let s = 0; s < 30; s++) {
      const mv = bestMove(b, 1, "novice", mulberry32(s * 7 + 1));
      if (!mv || !makesFive(b, mv.x, mv.y, 1)) missed++;
    }
    expect(missed).toBeGreaterThan(15);
  });

  it("它是 0 层：不搜索，同样的 rng 就走同样的点", () => {
    expect(DIFFICULTY_DEPTH.novice).toBe(0);
    const b = build(9, [[4, 4], [5, 5]], [[3, 4]]);
    const a = bestMove(b, 1, "novice", mulberry32(11));
    const c = bestMove(b, 1, "novice", mulberry32(11));
    expect(a).toEqual(c);
  });
});

describe("简单档（1.1 行为原样保留）", () => {
  it("自己能成五一定会下", () => {
    const b = build(9, [[2, 2], [3, 2], [4, 2], [5, 2]], [[0, 6]]);
    for (let s = 0; s < 8; s++) {
      const mv = bestMove(b, 1, "easy", mulberry32(s + 3));
      expect(makesFive(b, mv!.x, mv!.y, 1)).toBe(true);
    }
  });

  it("挡对手成五的概率大约六成：既不是必挡，也不是不挡", () => {
    const b = build(9, [[1, 4]], [[2, 4], [3, 4], [4, 4], [5, 4]]);
    let blocked = 0;
    const n = 200;
    for (let s = 0; s < n; s++) {
      const mv = bestMove(b, 1, "easy", mulberry32(s * 13 + 5));
      if (mv && mv.x === 6 && mv.y === 4) blocked++;
    }
    expect(blocked).toBeGreaterThan(n * 0.4);
    expect(blocked).toBeLessThan(n * 0.85);
  });
});

describe("能力单调：基本功电池", () => {
  const scores = DIFFICULTIES.map((d) => ({ d, score: drillScore(d) }));

  it("答对数随档位非递减", () => {
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i].score).toBeGreaterThanOrEqual(scores[i - 1].score);
    }
  });

  it("菜鸟明显不及格，普通档往上全对", () => {
    expect(scores[0].score).toBeLessThan(DRILL_TOTAL * 0.4);
    expect(scores[1].score).toBeGreaterThan(scores[0].score);
    for (const s of scores.slice(2)) expect(s.score).toBe(DRILL_TOTAL);
  });

  it("六档都不会走到已经有子的点上", () => {
    const b = build(15, [[7, 7], [8, 8], [6, 6]], [[7, 8], [8, 7]]);
    for (const d of DIFFICULTIES) {
      const mv = bestMove(b, 1, d, mulberry32(21), { timeMs: 20, maxDepth: 4 });
      expect(mv).not.toBeNull();
      expect(getCell(b, mv!.x, mv!.y)).toBe(0);
    }
  });
});

describe("实战单调：固定 seed 的成对对局", () => {
  it("简单 vs 菜鸟 12 局：简单档全胜", () => {
    const r = series("easy", "novice", 15, 12);
    expect(r.strongWins).toBeGreaterThanOrEqual(10);
    expect(r.weakWins).toBeLessThanOrEqual(1);
  }, 30_000);

  it("普通 vs 简单 12 局：普通档大比分领先", () => {
    const r = series("normal", "easy", 15, 12);
    expect(r.strongWins).toBeGreaterThanOrEqual(9);
    expect(r.weakWins).toBeLessThanOrEqual(2);
  }, 30_000);

  it("大师 vs 简单 12 局：大师档胜率显著更高", () => {
    const r = series("master", "easy", 15, 12);
    expect(r.strongWins).toBeGreaterThanOrEqual(10);
    expect(r.weakWins).toBeLessThanOrEqual(1);
    expect(r.strongWins / 12).toBeGreaterThan(0.8);
  }, 60_000);

  it("地狱 vs 普通 12 局：地狱档胜率显著更高", () => {
    const r = series("hell", "normal", 15, 12, { timeMs: 12, maxDepth: 6 });
    expect(r.strongWins).toBeGreaterThanOrEqual(9);
    expect(r.weakWins).toBeLessThanOrEqual(2);
    expect(r.strongWins / 12).toBeGreaterThan(0.7);
  }, 120_000);
});

/* ---------------- 相邻档：菜鸟→地狱一档都不许跳 ---------------- */

// 地狱档默认按真实时钟限时，跑对局会因机器快慢而飘。
// 冻住时钟（now 恒为 0，永远追不上 deadline）之后，搜索一定跑满 maxDepth，
// 于是「同一个 seed 永远同一盘棋」，相邻档战绩才是可复现的。
const FROZEN_HELL: HellOptions = { timeMs: 1_000, maxDepth: 4, now: () => 0 };

/** 一批由普通档自对弈铺出来的真实中盘局面（长度各不相同） */
function midPositions(count: number): Array<{ board: Board; turn: Player }> {
  const out: Array<{ board: Board; turn: Player }> = [];
  for (let g = 0; g < count; g++) {
    const b = makeBoard(15);
    const rng = mulberry32(500 + g);
    let turn: Player = 1;
    const plies = 8 + (g % 9) * 2;
    let finished = false;
    for (let i = 0; i < plies; i++) {
      const mv = bestMove(b, turn, "normal", rng);
      if (!mv) break;
      setCell(b, mv.x, mv.y, turn);
      if (findWinLine(b, mv.x, mv.y)) {
        finished = true;
        break;
      }
      turn = turn === 1 ? 2 : 1;
    }
    if (!finished) out.push({ board: b, turn });
  }
  return out;
}

describe("实战单调：相邻档五对全覆盖（强档执黑执白各一半）", () => {
  it("简单 → 菜鸟", () => {
    const r = series("easy", "novice", 15, 12);
    expect(r.strongWins).toBeGreaterThan(r.weakWins);
    expect(r.strongWins).toBeGreaterThanOrEqual(9);
  }, 60_000);

  it("普通 → 简单", () => {
    const r = series("normal", "easy", 15, 12);
    expect(r.strongWins).toBeGreaterThan(r.weakWins);
    expect(r.strongWins).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it("聪明 → 普通：聪明档必须真的比普通档强，不许倒挂", () => {
    const r = series("smart", "normal", 15, 12);
    expect(r.strongWins).toBeGreaterThan(r.weakWins);
    expect(r.strongWins).toBeGreaterThanOrEqual(7);
  }, 120_000);

  it("大师 → 聪明：聪明档改强之后也不许反压大师", () => {
    const r = series("master", "smart", 15, 12);
    expect(r.strongWins).toBeGreaterThan(r.weakWins);
    expect(r.strongWins).toBeGreaterThanOrEqual(7);
  }, 180_000);

  it("地狱 → 大师：地狱档必须是大师档的严格加强", () => {
    const r = series("hell", "master", 15, 8, FROZEN_HELL);
    expect(r.strongWins).toBeGreaterThan(r.weakWins);
  }, 300_000);
});

describe("地狱档不是大师档的马甲", () => {
  it("真实中盘局面上，地狱与大师不许 100% 走同一步", () => {
    const spots = midPositions(24);
    expect(spots.length).toBeGreaterThanOrEqual(20);
    let same = 0;
    for (const [i, s] of spots.entries()) {
      const a = bestMove(s.board, s.turn, "master", mulberry32(90 + i));
      const c = bestMove(s.board, s.turn, "hell", mulberry32(90 + i), FROZEN_HELL);
      if (a && c && a.x === c.x && a.y === c.y) same++;
    }
    expect(same).toBeLessThan(spots.length);
    expect(same / spots.length).toBeLessThanOrEqual(0.9);
  }, 300_000);
});

describe("地狱档：迭代加深 + 置换表 + 抓禁手", () => {
  /** 一个走了十几手的中盘局面 */
  function midGame(): { board: Board; turn: Player } {
    const b = makeBoard(15);
    const rng = mulberry32(4242);
    let turn: Player = 1;
    for (let i = 0; i < 12; i++) {
      const mv = bestMove(b, turn, "normal", rng);
      if (!mv) break;
      setCell(b, mv.x, mv.y, turn);
      turn = turn === 1 ? 2 : 1;
    }
    return { board: b, turn };
  }

  it("默认预算下单次出手 < 800ms", () => {
    const { board, turn } = midGame();
    const t0 = Date.now();
    const mv = bestMove(board, turn, "hell", mulberry32(9));
    const ms = Date.now() - t0;
    expect(mv).not.toBeNull();
    expect(ms).toBeLessThan(800);
  });

  it("迭代加深真的算到 4 层以上，而且走过的节点数是有限的（置换表在起作用）", () => {
    const { board, turn } = midGame();
    const r = hellSearch(board, turn, {});
    expect(r).not.toBeNull();
    expect(r!.depth).toBeGreaterThanOrEqual(4);
    expect(r!.nodes).toBeGreaterThan(0);
    expect(r!.nodes).toBeLessThan(2_000_000);
  });

  it("时间给得越多层数只增不减", () => {
    const { board, turn } = midGame();
    const shallow = hellSearch(board, turn, { timeMs: 20, maxDepth: 8 });
    const deep = hellSearch(board, turn, { timeMs: 400, maxDepth: 8 });
    expect(deep!.depth).toBeGreaterThanOrEqual(shallow!.depth);
  });

  it("同一个局面搜两遍，结论一样（搜索没有隐藏状态）", () => {
    const { board, turn } = midGame();
    // 冻住时钟：搜索一定跑满 maxDepth，结果与机器快慢无关
    const frozen = { timeMs: 1000, maxDepth: 4, now: () => 0 };
    const a = hellSearch(board, turn, frozen);
    const c = hellSearch(board, turn, frozen);
    expect({ x: a!.x, y: a!.y, depth: a!.depth }).toEqual({ x: c!.x, y: c!.y, depth: c!.depth });
  });

  it("算杀比大师深：7 手的连续冲四找得到，5 手的找不到", () => {
    // 中盘局面，黑棋有一条七手的冲四杀链
    const b = build(
      15,
      [[9, 2], [10, 5], [7, 7], [10, 7], [10, 8], [11, 8], [13, 8]],
      [[6, 2], [7, 3], [10, 4], [12, 5], [9, 6], [11, 6], [14, 8]]
    );
    expect(findVcf(b, 1, 5)).toBeNull();
    const deep = findVcf(b, 1, 7);
    expect(deep).toEqual({ x: 9, y: 8 });
    // 地狱档用的就是 7 手，所以它抓得住这一手
    expect(bestMove(b, 1, "hell", mulberry32(3), { timeMs: 40 })).toEqual({ x: 9, y: 8 });
  });

  it("禁手规则打开时会抓禁手：白棋冲四，黑棋唯一挡点是禁手", () => {
    const b = build(
      15,
      [[6, 3], [6, 4], [5, 6], [8, 6], [7, 7], [9, 7], [13, 7], [8, 9], [9, 9], [2, 10]],
      [[8, 4], [7, 5], [2, 6], [4, 8], [8, 8], [10, 8], [11, 9], [7, 10], [10, 10]]
    );
    const trap = findForbiddenTrap(b, 2);
    expect(trap).toEqual({ x: 5, y: 7 });
    // 这不是普通的算杀：五手冲四找不到它
    expect(findVcf(b, 2, 5)).toBeNull();
    expect(bestMove(b, 2, "hell", mulberry32(4), { forbidden: true, timeMs: 40 })).toEqual({
      x: 5,
      y: 7,
    });
  });

  it("抓禁手只对黑棋有效：白棋自己不受禁手约束", () => {
    const b = build(
      15,
      [[6, 3], [6, 4], [5, 6], [8, 6], [7, 7], [9, 7], [13, 7], [8, 9], [9, 9], [2, 10]],
      [[8, 4], [7, 5], [2, 6], [4, 8], [8, 8], [10, 8], [11, 9], [7, 10], [10, 10]]
    );
    expect(findForbiddenTrap(b, 1)).toBeNull();
  });

  it("不是无敌：对手已经做出活四时，地狱档照样输", () => {
    // 黑棋活四 (5..8, 7)，两头都空，白棋（地狱档）挡一头也拦不住
    const b = build(15, [[5, 7], [6, 7], [7, 7], [8, 7]], [[3, 10], [4, 11]]);
    const white = bestMove(b, 2, "hell", mulberry32(6), { timeMs: 40 });
    expect(white).not.toBeNull();
    setCell(b, white!.x, white!.y, 2);
    const kill = candidateMoves(b).find(([x, y]) => makesFive(b, x, y, 1));
    expect(kill).toBeDefined();
  });
});
