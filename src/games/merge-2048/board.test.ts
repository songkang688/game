import { describe, expect, it } from "vitest";
import {
  BLOCK,
  DIRS,
  EMPTY,
  SPAWN_TWO_RATE,
  applyHazards,
  boardFrom,
  boardSum,
  canMove,
  canMoveDir,
  cloneBoard,
  createBoard,
  emptyCells,
  hasTile,
  hazardCells,
  legalDirs,
  maxTile,
  move,
  playTurn,
  rng,
  sameBoard,
  slideRow,
  snakeOrder,
  spawn,
  spawnValue
} from "./board";

/** 按顺序吐出给定数字的假随机源,吐完了循环 */
function fakeRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("单行滑动:经典合并规则", () => {
  it("2 2 2 2 向左合成 4 4,不是 8", () => {
    const r = slideRow([2, 2, 2, 2]);
    expect(r.row).toEqual([4, 4, 0, 0]);
    expect(r.merges).toBe(2);
    expect(r.score).toBe(8);
  });

  it("4 2 2 向左合成 4 4:合并顺序沿移动方向从前往后", () => {
    const r = slideRow([4, 2, 2]);
    expect(r.row).toEqual([4, 4, 0]);
    expect(r.score).toBe(4);
  });

  it("2 2 4 向左也合成 4 4", () => {
    expect(slideRow([2, 2, 4]).row).toEqual([4, 4, 0]);
  });

  it("新合成的块同一回合不能再合:4 4 8 只变成 8 8", () => {
    const r = slideRow([4, 4, 8, 0]);
    expect(r.row).toEqual([8, 8, 0, 0]);
    expect(r.merges).toBe(1);
  });

  it("2 2 4 8 只合最前面那一对,后面原样往前挪", () => {
    expect(slideRow([2, 2, 4, 8]).row).toEqual([4, 4, 8, 0]);
  });

  it("不一样的数字撞在一起不会合", () => {
    const r = slideRow([2, 4, 8, 16]);
    expect(r.row).toEqual([2, 4, 8, 16]);
    expect(r.moved).toBe(false);
    expect(r.merges).toBe(0);
  });

  it("中间有空格也会滑到底", () => {
    const r = slideRow([0, 0, 2, 0]);
    expect(r.row).toEqual([2, 0, 0, 0]);
    expect(r.moved).toBe(true);
    expect(r.score).toBe(0);
  });

  it("得分等于新块数字之和", () => {
    expect(slideRow([8, 8, 4, 4]).score).toBe(16 + 8);
  });

  it("行程表记下了每一块从哪儿滑到哪儿,合并的两块指向同一格", () => {
    const r = slideRow([0, 2, 0, 2]);
    expect(r.row).toEqual([4, 0, 0, 0]);
    expect(r.paths).toHaveLength(2);
    expect(r.paths.every((p) => p.to === 0 && p.mergedInto === 4)).toBe(true);
    expect(r.paths.map((p) => p.from)).toEqual([1, 3]);
  });

  it("整行全空:没得滑", () => {
    expect(slideRow([0, 0, 0, 0]).moved).toBe(false);
  });
});

describe("障碍花把一行切成几段", () => {
  it("障碍花两边各滑各的,谁也越不过去", () => {
    const r = slideRow([0, 2, BLOCK, 0, 2]);
    expect(r.row).toEqual([2, 0, BLOCK, 2, 0]);
  });

  it("隔着障碍花的两个同样数字不会合", () => {
    const r = slideRow([2, BLOCK, 2]);
    expect(r.row).toEqual([2, BLOCK, 2]);
    expect(r.merges).toBe(0);
    expect(r.moved).toBe(false);
  });

  it("同一段里的两块照常合", () => {
    const r = slideRow([2, 2, BLOCK, 4, 4]);
    expect(r.row).toEqual([4, 0, BLOCK, 8, 0]);
    expect(r.score).toBe(12);
  });

  it("障碍花自己一步都不挪", () => {
    const board = boardFrom([
      [2, BLOCK, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]);
    const res = move(board, "left");
    expect(res.board[0][1]).toBe(BLOCK);
  });

  it("applyHazards 只吃空格,不动已经摆好的数字", () => {
    const board = boardFrom([
      [2, 0],
      [0, 0]
    ]);
    const out = applyHazards(board, { blocks: [0, 3] });
    expect(out[0][0]).toBe(2);
    expect(out[1][1]).toBe(BLOCK);
  });

  it("applyHazards 忽略越界与非法下标,不抛异常", () => {
    const out = applyHazards(createBoard(3), { blocks: [-1, 99, Number.NaN, 4] });
    expect(out[1][1]).toBe(BLOCK);
    expect(boardSum(out)).toBe(0);
  });

  it("hazardCells 同一个 seed 永远挑同一批格子,且避开第一行第一列", () => {
    const a = hazardCells(4, 3, 777);
    const b = hazardCells(4, 3, 777);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    for (const idx of a) {
      expect(Math.floor(idx / 4)).toBeGreaterThanOrEqual(1);
      expect(idx % 4).toBeGreaterThanOrEqual(1);
    }
  });

  it("hazardCells 要 0 朵就返回空", () => {
    expect(hazardCells(4, 0, 1)).toEqual([]);
  });
});

describe("四个方向对称", () => {
  const row = [2, 2, 4, 0];

  it("向左", () => {
    const b = boardFrom([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(move(b, "left").board[0]).toEqual([4, 4, 0, 0]);
  });

  it("向右是同一行反过来", () => {
    const b = boardFrom([[0, 4, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(move(b, "right").board[0]).toEqual([0, 0, 4, 4]);
  });

  it("向上是列方向的同一件事", () => {
    const b = boardFrom([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]]);
    const out = move(b, "up").board;
    expect(out.map((r) => r[0])).toEqual([4, 4, 0, 0]);
  });

  it("向下把同一列压到底", () => {
    const b = boardFrom([[4, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]]);
    const out = move(b, "down").board;
    expect(out.map((r) => r[0])).toEqual([0, 0, 4, 4]);
  });

  it("四个方向的总得分一致(同一个对称局面)", () => {
    const b = boardFrom([
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 2, 2]
    ]);
    const scores = DIRS.map((d) => move(b, d).score);
    expect(scores).toEqual([32, 32, 32, 32]);
  });

  it("move 不改原来的盘面", () => {
    const b = boardFrom([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const before = cloneBoard(b);
    move(b, "left");
    expect(sameBoard(b, before)).toBe(true);
  });

  it("盘面行程表用的是整盘坐标", () => {
    const b = boardFrom([[0, 0, 0, 0], [0, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const res = move(b, "left");
    expect(res.paths).toEqual([{ fromRow: 1, fromCol: 2, toRow: 1, toCol: 0, value: 2, mergedInto: 0 }]);
  });
});

describe("生成新块", () => {
  it("2 占九成、4 占一成", () => {
    expect(SPAWN_TWO_RATE).toBe(0.9);
    expect(spawnValue(fakeRand([0.5]))).toBe(2);
    expect(spawnValue(fakeRand([0.95]))).toBe(4);
    expect(spawnValue(fakeRand([0.899]))).toBe(2);
  });

  it("大样本下 2 与 4 的比例落在合理区间", () => {
    const rand = rng(20480);
    let twos = 0;
    const total = 20000;
    for (let i = 0; i < total; i++) if (spawnValue(rand) === 2) twos += 1;
    const rate = twos / total;
    expect(rate).toBeGreaterThan(0.88);
    expect(rate).toBeLessThan(0.92);
  });

  it("新块只落在空格上,障碍花与已有数字都不会被覆盖", () => {
    const board = boardFrom([
      [2, BLOCK],
      [4, 0]
    ]);
    const born = spawn(board, fakeRand([0.5, 0.5]));
    expect(born).not.toBeNull();
    expect(born?.row).toBe(1);
    expect(born?.col).toBe(1);
    expect(born?.value).toBe(2);
  });

  it("没有空格就生不出来", () => {
    const board = boardFrom([
      [2, 4],
      [8, 16]
    ]);
    expect(spawn(board, fakeRand([0.5]))).toBeNull();
  });

  it("发生了移动才生成新块", () => {
    const board = boardFrom([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const turn = playTurn(board, "left", fakeRand([0.5, 0.5]));
    expect(turn.moved).toBe(true);
    expect(turn.spawned).not.toBeNull();
    expect(boardSum(turn.board)).toBe(4);
  });

  it("没动就一个新块都不生成,盘面原样返回", () => {
    const board = boardFrom([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const turn = playTurn(board, "left", fakeRand([0.5, 0.5]));
    expect(turn.moved).toBe(false);
    expect(turn.spawned).toBeNull();
    expect(turn.board).toBe(board);
    expect(boardSum(turn.board)).toBe(30);
  });

  it("一整回合下来盘面的总数只多出新块那一点", () => {
    const board = boardFrom([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const turn = playTurn(board, "left", fakeRand([0.1, 0.5]));
    expect(turn.merges).toBe(1);
    expect(boardSum(turn.board)).toBe(4 + (turn.spawned?.value ?? 0));
  });
});

describe("终局判定", () => {
  it("有空格就还能动", () => {
    const board = boardFrom([
      [2, 4],
      [8, 0]
    ]);
    expect(canMove(board)).toBe(true);
  });

  it("满盘但有相邻同数字还能动", () => {
    const board = boardFrom([
      [2, 2],
      [8, 16]
    ]);
    expect(canMove(board)).toBe(true);
    expect(legalDirs(board)).toEqual(["left", "right"]);
  });

  it("满盘且四个方向都推不动就是结束", () => {
    const board = boardFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ]);
    expect(canMove(board)).toBe(false);
    expect(legalDirs(board)).toEqual([]);
    for (const d of DIRS) expect(canMoveDir(board, d)).toBe(false);
  });

  it("障碍花把盘面堵死也算结束", () => {
    const board = boardFrom([
      [2, BLOCK, 4],
      [BLOCK, 8, BLOCK],
      [4, BLOCK, 2]
    ]);
    expect(canMove(board)).toBe(false);
  });

  it("hasTile 与 maxTile 认得出目标数字", () => {
    const board = boardFrom([
      [2048, 4],
      [8, 16]
    ]);
    expect(hasTile(board, 2048)).toBe(true);
    expect(hasTile(board, 1024)).toBe(false);
    expect(maxTile(board)).toBe(2048);
    expect(maxTile(createBoard(4))).toBe(0);
  });
});

describe("3×3 与 5×5 变体", () => {
  it("三乘三照样按经典规则合", () => {
    const board = boardFrom([
      [2, 2, 4],
      [0, 0, 0],
      [0, 0, 0]
    ]);
    const res = move(board, "left");
    expect(res.board.length).toBe(3);
    expect(res.board[0]).toEqual([4, 4, 0]);
  });

  it("五乘五一行能一次合出两对", () => {
    const board = boardFrom([
      [2, 2, 4, 4, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ]);
    const res = move(board, "left");
    expect(res.board[0]).toEqual([4, 8, 0, 0, 0]);
    expect(res.merges).toBe(2);
  });

  it("createBoard 给的是正方形空盘", () => {
    const b = createBoard(5);
    expect(b).toHaveLength(5);
    expect(b.every((row) => row.length === 5 && row.every((v) => v === EMPTY))).toBe(true);
    expect(emptyCells(b)).toHaveLength(25);
  });

  it("boardFrom 缺的格子按空格补齐", () => {
    const b = boardFrom([[2], [4, 8]]);
    expect(b).toEqual([
      [2, 0],
      [4, 8]
    ]);
  });
});

describe("蛇形顺序与随机源", () => {
  it("蛇形顺序左上角起、一行一折", () => {
    expect(snakeOrder(3)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 1],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2]
    ]);
  });

  it("同一个 seed 给出同一串随机数", () => {
    const a = rng(42);
    const b = rng(42);
    const xs = [a(), a(), a()];
    const ys = [b(), b(), b()];
    expect(xs).toEqual(ys);
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("不同 seed 给出不同的串", () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });
});
