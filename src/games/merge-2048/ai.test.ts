import { describe, expect, it } from "vitest";
import { BLOCK, boardFrom, createBoard, rng, spawn, type Board } from "./board";
import {
  AI_TIERS,
  AI_TIER_BLURBS,
  AI_TIER_LABELS,
  CHANCE_SAMPLE,
  EVAL_WEIGHTS,
  chooseMove,
  emptyCount,
  evalBoard,
  monotonicity,
  searchDepth,
  simulateRun,
  smoothness,
  snakeScore,
  toCodes,
  type AiTier
} from "./ai";
import { levelConfig, startBoard } from "./levels";

function fresh(seed: number, size = 4): Board {
  const rand = rng(seed);
  let b = createBoard(size);
  for (let i = 0; i < 2; i++) {
    const born = spawn(b, rand);
    if (born) b = born.board;
  }
  return b;
}

describe("档位名单", () => {
  it("四档都在,每档有中文名和一句说明", () => {
    expect(AI_TIERS).toEqual(["rookie", "normal", "pro", "hell"]);
    expect(Object.values(AI_TIER_LABELS)).toEqual(["菜鸟", "普通", "高手", "地狱"]);
    for (const t of AI_TIERS) expect(AI_TIER_BLURBS[t].length).toBeGreaterThan(6);
  });
});

describe("挑方向", () => {
  const board = boardFrom([
    [2, 2, 4, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);

  it("推不动的时候返回 null", () => {
    const dead = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);
    for (const t of AI_TIERS) expect(chooseMove(dead, t, rng(1))).toBeNull();
  });

  it("菜鸟只在能动的方向里挑", () => {
    const rand = rng(9);
    for (let i = 0; i < 40; i++) {
      const d = chooseMove(board, "rookie", rand);
      expect(["left", "right", "up", "down"]).toContain(d);
      expect(d).not.toBe("up");
    }
  });

  it("普通档挑本步得分最高的方向", () => {
    const greedy = boardFrom([
      [8, 8, 0, 2],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    // 向左合出 16(得 16 分),向上只合出 4,所以贪心一定选左
    expect(chooseMove(greedy, "normal", rng(3))).toBe("left");
  });

  it("高手与地狱是确定性的:同一个盘面永远给同一个方向", () => {
    for (const t of ["pro", "hell"] as AiTier[]) {
      const a = chooseMove(board, t, rng(5));
      const b = chooseMove(board, t, rng(77));
      expect(a).toBe(b);
    }
  });

  it("障碍花挡住的方向不会被挑中", () => {
    const blocked = boardFrom([
      [2, BLOCK, 0],
      [BLOCK, 0, 0],
      [0, 0, 0]
    ]);
    for (const t of AI_TIERS) {
      const d = chooseMove(blocked, t, rng(11));
      expect(d).not.toBe("left");
      expect(d).not.toBe("up");
    }
  });

  it("搜索层数会随着空格变少而加深", () => {
    expect(searchDepth(createBoard(4))).toBe(2);
    const tight = boardFrom([
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 0, 0]
    ]);
    expect(searchDepth(tight)).toBe(3);
    expect(CHANCE_SAMPLE).toBeGreaterThanOrEqual(3);
  });
});

describe("评估函数", () => {
  it("权重配方钉死,改动必须是有意的", () => {
    expect(EVAL_WEIGHTS).toEqual({ empty: 2.7, monotonicity: 1.5, smoothness: 0.2, snake: 0.4, corner: 4 });
  });

  it("空格越多越好", () => {
    const roomy = boardFrom([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const packed = boardFrom([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [2, 4, 8, 16],
      [32, 64, 128, 256]
    ]);
    expect(emptyCount(roomy)).toBe(15);
    expect(emptyCount(packed)).toBe(0);
    expect(evalBoard(roomy)).toBeGreaterThan(evalBoard(packed));
  });

  it("排得整齐的盘面比忽大忽小的强", () => {
    const tidy = boardFrom([
      [64, 32, 16, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    const messy = boardFrom([
      [8, 64, 16, 32],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    expect(monotonicity(tidy)).toBeGreaterThan(monotonicity(messy));
    expect(evalBoard(tidy)).toBeGreaterThan(evalBoard(messy));
  });

  it("单调性与平滑度都是罚分,不会是正数", () => {
    for (const lv of [0, 60, 120, 187]) {
      const b = startBoard(lv);
      expect(monotonicity(b)).toBeLessThanOrEqual(0);
      expect(smoothness(b)).toBeLessThanOrEqual(0);
    }
  });

  it("大块压在角上分更高", () => {
    const corner = boardFrom([[256, 4, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const middle = boardFrom([[0, 0, 0, 0], [0, 256, 4, 2], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(snakeScore(corner)).toBeGreaterThan(snakeScore(middle));
    expect(evalBoard(corner)).toBeGreaterThan(evalBoard(middle));
  });

  it("指数盘面把空格记成 0、障碍花记成 -1、数字记成 log2", () => {
    const codes = toCodes(
      boardFrom([
        [2, 1024],
        [BLOCK, 0]
      ])
    );
    expect(Array.from(codes)).toEqual([1, 10, -1, 0]);
  });
});

describe("整局模拟", () => {
  it("跑到目标就停,不多走一步", () => {
    const run = simulateRun({ board: startBoard(0), target: 32, tier: "hell", rand: rng(1), maxSteps: 200 });
    expect(run.reached).toBe(true);
    expect(run.best).toBeGreaterThanOrEqual(32);
    expect(run.steps).toBeLessThan(200);
  });

  it("步数用完就收手", () => {
    const run = simulateRun({ board: fresh(7), target: 4096, tier: "pro", rand: rng(7), maxSteps: 12 });
    expect(run.reached).toBe(false);
    expect(run.stuck).toBe(false);
    expect(run.steps).toBe(12);
  });

  it("推不动了会报 stuck", () => {
    const dead = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 8]
    ]);
    const run = simulateRun({ board: dead, target: 2048, tier: "hell", rand: rng(1), maxSteps: 50 });
    expect(run.stuck).toBe(true);
    expect(run.steps).toBe(0);
  });

  it("开局就已经到目标的话一步都不用走", () => {
    const run = simulateRun({ board: boardFrom([[64, 0], [0, 0]]), target: 64, tier: "hell", rand: rng(1), maxSteps: 9 });
    expect(run.reached).toBe(true);
    expect(run.steps).toBe(0);
  });

  it("同一个 seed 跑出同一局", () => {
    const a = simulateRun({ board: startBoard(30), target: 128, tier: "hell", rand: rng(4), maxSteps: 300 });
    const b = simulateRun({ board: startBoard(30), target: 128, tier: "hell", rand: rng(4), maxSteps: 300 });
    expect(a.steps).toBe(b.steps);
    expect(a.score).toBe(b.score);
    expect(a.board).toEqual(b.board);
  });

  it("模拟出来的盘面里没有非法数字", () => {
    const run = simulateRun({ board: startBoard(100), target: 512, tier: "pro", rand: rng(2), maxSteps: 120 });
    for (const v of run.board.flat()) {
      expect(v === 0 || v === BLOCK || Number.isInteger(Math.log2(v))).toBe(true);
    }
  });
});

describe("档位强度:地狱明显快过菜鸟", () => {
  /** 走到目标用了几步;走不到就按「用光步数 + 1」算,方便直接比大小 */
  function stepsTo(tier: AiTier, level: number, cap: number): number {
    const cfg = levelConfig(level);
    const run = simulateRun({
      board: startBoard(level),
      target: cfg.target,
      tier,
      rand: rng(cfg.seed),
      maxSteps: cap
    });
    return run.reached ? run.steps : cap + 1;
  }

  it("固定 seed 下,地狱档达成目标的步数明显少于菜鸟档", () => {
    const cap = 400;
    for (const level of [10, 34, 58]) {
      const hell = stepsTo("hell", level, cap);
      const rookie = stepsTo("rookie", level, cap);
      expect(hell).toBeLessThanOrEqual(cap);
      // 「明显少」定义成不到菜鸟的六成,不是差一两步的那种险胜
      expect(hell).toBeLessThan(rookie * 0.6);
    }
  });

  it("高手档也稳稳强过菜鸟档", () => {
    const cap = 400;
    for (const level of [10, 34]) {
      expect(stepsTo("pro", level, cap)).toBeLessThan(stepsTo("rookie", level, cap));
    }
  });

  it("四档在空盘马拉松里的最大块是单调不降的", () => {
    const bests = AI_TIERS.map((tier) => {
      const board = fresh(2026);
      return simulateRun({ board, target: 0, tier, rand: rng(2026), maxSteps: 600 }).best;
    });
    expect(bests[3]).toBeGreaterThanOrEqual(bests[0]);
    expect(bests[2]).toBeGreaterThanOrEqual(bests[0]);
  });
});
