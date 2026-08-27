import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  DIFFICULTY_BLURB,
  DIFFICULTY_NAME,
  MATE_PROBE_PIECES,
  PIECE_VALUE,
  SEARCH_DEPTH,
  THINK_DELAY_MS,
  TIME_BUDGET_MS,
  TIER_SHORT,
  bookMove,
  chooseMove,
  controlMap,
  evaluateFast,
  evaluateFull,
  freeCaptures,
  hintMove,
  pieceCount,
  type Difficulty,
} from "./ai";
import {
  type Board,
  type Move,
  type Piece,
  type Side,
  generalsFacing,
  idx,
  initialBoard,
  makeEmptyBoard,
  other,
  statusOf,
} from "./logic";
import { genMoves, makeMove, sameMove } from "./movegen";

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

/** 固定 seed 的伪随机数：同一个 seed 每次跑出来一模一样 */
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 假时钟：问一次时间走一「毫秒」。
 * 迭代加深是看着表决定挖多深的，真表一快一慢结果就不一样，测试没法复现；
 * 换成假表之后「预算」等价于一个固定的结点数，同一台机器换一台也是同样的棋。
 */
function fakeClock(): () => number {
  let t = 0;
  return () => (t += 1);
}

type Setup = Array<[number, number, Side, string]>;

function build(s: Setup): Board {
  const b = makeEmptyBoard();
  for (const [x, y, side, type] of s) b[idx(x, y)] = { side, type: type as Piece["type"] };
  return b;
}

/** 十六子的对称中局：红黑摆位中心对称，谁先走都不占便宜 */
const ARENA: Setup = [
  [4, 9, "red", "K"], [3, 9, "red", "A"], [5, 9, "red", "A"], [0, 9, "red", "R"],
  [7, 9, "red", "H"], [1, 7, "red", "C"], [4, 6, "red", "P"], [2, 6, "red", "P"],
  [4, 0, "black", "K"], [5, 0, "black", "A"], [3, 0, "black", "A"], [8, 0, "black", "R"],
  [1, 0, "black", "H"], [7, 2, "black", "C"], [4, 3, "black", "P"], [6, 3, "black", "P"],
];

/** 十二子的对称残局，同样中心对称 */
const SMALL: Setup = [
  [4, 9, "red", "K"], [4, 8, "red", "A"], [0, 8, "red", "R"], [7, 9, "red", "H"],
  [1, 7, "red", "C"], [4, 6, "red", "P"],
  [4, 0, "black", "K"], [4, 1, "black", "A"], [8, 1, "black", "R"], [1, 0, "black", "H"],
  [7, 2, "black", "C"], [4, 3, "black", "P"],
];

/** 只数子力，不看位置：判胜负用它，免得位置分把结果搅浑 */
function material(b: Board, side: Side): number {
  let n = 0;
  for (const p of b) {
    if (!p || p.type === "K") continue;
    n += p.side === side ? PIECE_VALUE[p.type] : -PIECE_VALUE[p.type];
  }
  return n;
}

type Outcome = "red" | "black" | "draw";

function duel(setup: Setup, red: Difficulty, black: Difficulty, seed: number, plies: number, budget: number): Outcome {
  const board = build(setup);
  const rng = rngOf(seed);
  const now = fakeClock();
  let side: Side = "red";
  for (let ply = 0; ply < plies; ply++) {
    const m = chooseMove(board, side, side === "red" ? red : black, rng, { timeMs: budget, now });
    // 一步都走不出来 = 被将死或困毙，这一方输
    if (!m) return side === "red" ? "black" : "red";
    makeMove(board, m);
    side = other(side);
  }
  const diff = material(board, "red");
  return diff > 100 ? "red" : diff < -100 ? "black" : "draw";
}

/** 十二局：强档执红执黑各六局，返回强档的战绩 */
function series(setup: Setup, strong: Difficulty, weak: Difficulty, plies: number, budget: number) {
  let won = 0;
  let lost = 0;
  let drew = 0;
  for (let g = 0; g < 12; g++) {
    const strongIsRed = g % 2 === 0;
    const r = strongIsRed
      ? duel(setup, strong, weak, 100 + g, plies, budget)
      : duel(setup, weak, strong, 100 + g, plies, budget);
    if (r === (strongIsRed ? "red" : "black")) won++;
    else if (r === (strongIsRed ? "black" : "red")) lost++;
    else drew++;
  }
  return { won, lost, drew };
}

/* ------------------------------------------------------------------ */

describe("六个档位的说明", () => {
  it("正好六档，顺序从菜鸟到地狱", () => {
    expect(DIFFICULTIES).toEqual(["novice", "easy", "normal", "hard", "master", "hell"]);
    expect(DIFFICULTIES.length).toBeGreaterThanOrEqual(6);
  });

  it("每档都有名字、短名和一句说明，互不重复", () => {
    const names = DIFFICULTIES.map((d) => DIFFICULTY_NAME[d]);
    expect(new Set(names).size).toBe(6);
    for (const d of DIFFICULTIES) {
      expect(DIFFICULTY_NAME[d].length).toBeGreaterThan(2);
      expect(TIER_SHORT[d].length).toBeGreaterThan(1);
      expect(DIFFICULTY_BLURB[d].length).toBeGreaterThan(6);
    }
  });

  it("「棋灵象」这个 1.1 就有的名字留在中高档，没改名", () => {
    expect(TIER_SHORT.normal).toBe("棋灵象");
    expect(TIER_SHORT.hard).toContain("棋灵象");
  });

  it("层数 0 1 2 3 4 5，一档比一档深；地狱档到五层", () => {
    expect(DIFFICULTIES.map((d) => SEARCH_DEPTH[d])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(SEARCH_DEPTH.hell).toBeGreaterThanOrEqual(5);
  });

  it("地狱档限时四百毫秒，思考延时一档比一档长、最低也有三百毫秒", () => {
    expect(TIME_BUDGET_MS.hell).toBe(400);
    let prev = 0;
    for (const d of DIFFICULTIES) {
      expect(THINK_DELAY_MS[d]).toBeGreaterThan(prev);
      prev = THINK_DELAY_MS[d];
    }
    // 「不许秒应」：最快的档也要让孩子看见它在想
    expect(Math.min(...DIFFICULTIES.map((d) => THINK_DELAY_MS[d]))).toBeGreaterThanOrEqual(300);
  });
});

describe("每一档都只走合法棋", () => {
  it("开局第一手，六档给的都在合法着法里", () => {
    for (const d of DIFFICULTIES) {
      const b = initialBoard();
      const legal = genMoves(b, "red");
      const m = chooseMove(b, "red", d, rngOf(3), { timeMs: 30, now: fakeClock() });
      expect(m, d).not.toBeNull();
      expect(legal.some((x) => sameMove(x, m)), d).toBe(true);
    }
  });

  it("被将死的时候六档都返回 null，不会硬凑一步", () => {
    // 红车贴着将军，后面还有一只车保着；黑将左右被自己的象堵死，象又够不到那只车
    const b = build([
      [4, 0, "black", "K"], [3, 0, "black", "E"], [5, 0, "black", "E"],
      [4, 1, "red", "R"], [4, 5, "red", "R"], [4, 9, "red", "K"],
    ]);
    expect(statusOf(b, "black")).toBe("checkmate");
    for (const d of DIFFICULTIES) {
      expect(chooseMove(b, "black", d, rngOf(1), { timeMs: 20, now: fakeClock() }), d).toBeNull();
    }
  });

  it("只剩一步可走时六档都走那一步", () => {
    const b = build([
      [4, 0, "black", "K"], [4, 1, "black", "P"], [3, 2, "red", "R"], [5, 2, "red", "R"],
      [4, 9, "red", "K"],
    ]);
    const legal = genMoves(b, "black");
    expect(legal.length).toBe(1);
    for (const d of DIFFICULTIES) {
      expect(sameMove(chooseMove(b, "black", d, rngOf(9), { timeMs: 20, now: fakeClock() }), legal[0]), d).toBe(true);
    }
  });

  it("同样的局面 + 同样的 seed 给同样的一步（可复现）", () => {
    for (const d of DIFFICULTIES) {
      const a = chooseMove(build(ARENA), "red", d, rngOf(42), { timeMs: 20, now: fakeClock() });
      const b = chooseMove(build(ARENA), "red", d, rngOf(42), { timeMs: 20, now: fakeClock() });
      expect(sameMove(a, b), d).toBe(true);
    }
  });
});

describe("菜鸟档：随机，只有一半概率吃白送的子", () => {
  // 仕摆在 (4,8) 是要紧的：不挡住这条线，将帅就照面了，红方除了动帅哪儿都去不了
  const setup: Setup = [
    [4, 9, "red", "K"], [4, 8, "red", "A"], [0, 9, "red", "R"], [4, 0, "black", "K"],
    [0, 3, "black", "H"], [8, 0, "black", "R"],
  ];

  it("摆的是个合法局面：将帅没有照面", () => {
    expect(generalsFacing(build(setup))).toBe(false);
  });

  it("白送的子数得出来：黑马没人保护，车吃了没人吃回来", () => {
    const b = build(setup);
    const free = freeCaptures(b, "red");
    expect(free.length).toBe(1);
    expect(free[0].to).toEqual({ x: 0, y: 3 });
  });

  it("rng 小于 0.5 时吃，大于 0.5 时不一定吃", () => {
    const eat = chooseMove(build(setup), "red", "novice", () => 0.1);
    expect(eat?.to).toEqual({ x: 0, y: 3 });
    // rng 恒等于 0.9：先跳过白送的子，再随机挑一步
    const skip = chooseMove(build(setup), "red", "novice", () => 0.9);
    expect(skip).not.toBeNull();
    expect(genMoves(build(setup), "red").some((m) => sameMove(m, skip))).toBe(true);
  });

  it("一百次里吃与不吃都出现过，不是永远吃", () => {
    let ate = 0;
    for (let s = 0; s < 100; s++) {
      const m = chooseMove(build(setup), "red", "novice", rngOf(s));
      if (m && m.to.x === 0 && m.to.y === 3) ate++;
    }
    expect(ate).toBeGreaterThan(10);
    expect(ate).toBeLessThan(90);
  });
});

describe("简单档往上：会吃子、会应将", () => {
  it("白送的大子，简单档以上都会吃", () => {
    const setup: Setup = [
      [4, 9, "red", "K"], [4, 8, "red", "A"], [0, 9, "red", "R"],
      [4, 0, "black", "K"], [0, 3, "black", "R"],
    ];
    expect(generalsFacing(build(setup))).toBe(false);
    for (const d of ["easy", "normal", "hard", "master", "hell"] as Difficulty[]) {
      const m = chooseMove(build(setup), "red", d, rngOf(5), { timeMs: 40, now: fakeClock() });
      expect(m?.to, d).toEqual({ x: 0, y: 3 });
    }
    expect(pieceCount(build(setup))).toBe(5);
  });

  it("被将军的时候必须应将，走完不能还在被将", () => {
    // 黑车照着红帅，红方必须挡、吃或者躲
    const setup: Setup = [
      [4, 9, "red", "K"], [3, 9, "red", "A"], [1, 7, "red", "R"],
      [4, 2, "black", "R"], [4, 0, "black", "K"], [0, 0, "black", "H"],
    ];
    for (const d of ["easy", "normal", "hard", "master", "hell"] as Difficulty[]) {
      const b = build(setup);
      const m = chooseMove(b, "red", d, rngOf(11), { timeMs: 40, now: fakeClock() });
      expect(m, d).not.toBeNull();
      makeMove(b, m as Move);
      expect(statusOf(b, "red"), d).not.toBe("checkmate");
      expect(generalsFacing(b), d).toBe(false);
    }
  });
});

describe("高档：一步杀不放过", () => {
  // 红车在底线，横过去就是一步将死
  const mateIn1: Setup = [
    [4, 0, "black", "K"], [3, 1, "black", "A"], [5, 1, "black", "A"],
    [0, 0, "red", "R"], [4, 2, "red", "R"], [4, 9, "red", "K"],
  ];

  it("大师与地狱都能一步收官", () => {
    for (const d of ["master", "hell"] as Difficulty[]) {
      const b = build(mateIn1);
      const m = chooseMove(b, "red", d, rngOf(2), { timeMs: 80, now: fakeClock() });
      expect(m, d).not.toBeNull();
      makeMove(b, m as Move);
      expect(statusOf(b, "black"), d).toBe("checkmate");
    }
  });

  it("提示给的也是那一步杀", () => {
    const b = build(mateIn1);
    const m = hintMove(b, "red");
    expect(m).not.toBeNull();
    makeMove(b, m as Move);
    expect(statusOf(b, "black")).toBe("checkmate");
  });

  it("地狱档在残局里靠穷举算杀，子多了就不算（免得卡住）", () => {
    expect(MATE_PROBE_PIECES).toBeLessThanOrEqual(12);
    expect(pieceCount(build(mateIn1))).toBeLessThanOrEqual(MATE_PROBE_PIECES);
    expect(pieceCount(initialBoard())).toBeGreaterThan(MATE_PROBE_PIECES);
  });
});

describe("开局库", () => {
  it("开局第一手在库里，走的是中炮或者仙人指路", () => {
    const b = initialBoard();
    const m = bookMove(b, "red", () => 0);
    expect(m).not.toBeNull();
    expect(genMoves(b, "red").some((x) => sameMove(x, m))).toBe(true);
  });

  it("大师与地狱开局照库走", () => {
    const book = bookMove(initialBoard(), "red", () => 0);
    expect(sameMove(chooseMove(initialBoard(), "red", "master", () => 0), book)).toBe(true);
    expect(sameMove(chooseMove(initialBoard(), "red", "hell", () => 0), book)).toBe(true);
  });

  it("离开套路之后库里就没有了，交给搜索", () => {
    const b = build(SMALL);
    expect(bookMove(b, "red", () => 0)).toBeNull();
  });
});

describe("评估函数", () => {
  it("多一只车就该多出车的分", () => {
    const even = build([[4, 9, "red", "K"], [4, 0, "black", "K"]]);
    expect(evaluateFast(even, "red")).toBe(0);
    const up = build([[4, 9, "red", "K"], [0, 9, "red", "R"], [4, 0, "black", "K"]]);
    expect(evaluateFast(up, "red")).toBeGreaterThanOrEqual(PIECE_VALUE.R);
    expect(evaluateFast(up, "black")).toBe(-evaluateFast(up, "red"));
  });

  it("过了河的兵比没过河的值钱", () => {
    const home = build([[4, 9, "red", "K"], [4, 6, "red", "P"], [4, 0, "black", "K"]]);
    const over = build([[4, 9, "red", "K"], [4, 3, "red", "P"], [4, 0, "black", "K"]]);
    expect(evaluateFast(over, "red")).toBeGreaterThan(evaluateFast(home, "red"));
  });

  it("控制点把「自己人在保护自己人」也数进去（rawMoves 数不出来这个）", () => {
    // 红车在 (0,9)，红马在 (0,7)：车竖着够得到马，这是保护不是攻击
    const b = build([[4, 9, "red", "K"], [0, 9, "red", "R"], [0, 7, "red", "H"], [4, 0, "black", "K"]]);
    const red = controlMap(b, "red");
    expect(red[idx(0, 7)]).toBeGreaterThan(0);
  });

  it("有人保护的子，不会被当成白送", () => {
    const guarded = build([
      [4, 9, "red", "K"], [0, 5, "red", "H"], [0, 9, "red", "R"],
      [4, 0, "black", "K"], [3, 5, "black", "R"],
    ]);
    const lone = build([
      [4, 9, "red", "K"], [0, 5, "red", "H"],
      [4, 0, "black", "K"], [3, 5, "black", "R"],
    ]);
    // 两边子力不同，只比「挨打这一项扣了多少」：有车保护的那盘扣得少
    const guardedPenalty = evaluateFull(guarded, "red") - evaluateFast(guarded, "red");
    const lonePenalty = evaluateFull(lone, "red") - evaluateFast(lone, "red");
    expect(guardedPenalty).toBeGreaterThan(lonePenalty);
  });
});

describe("固定 seed 的相对强度（各十二局，强档执红执黑各半）", () => {
  it("大师 vs 简单：胜率明显更高", () => {
    const r = series(ARENA, "master", "easy", 40, 10);
    expect(r.won + r.lost + r.drew).toBe(12);
    expect(r.won).toBeGreaterThanOrEqual(9);
    expect(r.lost).toBeLessThanOrEqual(1);
  }, 60_000);

  it("地狱 vs 普通：胜率明显更高", () => {
    const r = series(SMALL, "hell", "normal", 30, 16);
    expect(r.won + r.lost + r.drew).toBe(12);
    expect(r.won).toBeGreaterThanOrEqual(8);
    expect(r.won).toBeGreaterThanOrEqual(r.lost * 3);
  }, 120_000);
});

describe("单次决策的耗时", () => {
  it("六档在测试环境里都不到 800ms", () => {
    for (const d of DIFFICULTIES) {
      const b = initialBoard();
      const t0 = Date.now();
      chooseMove(b, "red", d, rngOf(6));
      const spent = Date.now() - t0;
      expect(spent, `${d} 花了 ${spent}ms`).toBeLessThan(800);
    }
  }, 30_000);

  it("中局也不到 800ms", () => {
    for (const d of DIFFICULTIES) {
      const b = build(ARENA);
      const t0 = Date.now();
      chooseMove(b, "red", d, rngOf(6));
      const spent = Date.now() - t0;
      expect(spent, `${d} 花了 ${spent}ms`).toBeLessThan(800);
    }
  }, 30_000);
});
