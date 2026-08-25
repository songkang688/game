import { describe, expect, it } from "vitest";
import {
  type Board,
  type Player,
  analyzeWindow,
  bestMove,
  boardFull,
  candidateMoves,
  evaluatePoint,
  findWinLine,
  hintMove,
  isForbidden,
  makeBoard,
  makesFive,
  setCell,
} from "./ai";

function put(b: Board, moves: Array<[number, number]>, p: Player): void {
  for (const [x, y] of moves) setCell(b, x, y, p);
}

describe("gomoku 胜负判定", () => {
  it("横向五连", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]], 1);
    const line = findWinLine(b, 5, 7);
    expect(line).not.toBeNull();
    expect(line!.length).toBe(5);
  });

  it("斜向五连", () => {
    const b = makeBoard(15);
    put(b, [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]], 2);
    expect(findWinLine(b, 4, 4)).not.toBeNull();
  });

  it("四连不算赢", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(findWinLine(b, 5, 7)).toBeNull();
  });

  it("9×9 入门棋盘同样能判五连", () => {
    const b = makeBoard(9);
    put(b, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]], 1);
    expect(findWinLine(b, 2, 2)).not.toBeNull();
  });

  it("makesFive：差一子成五", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(makesFive(b, 7, 7, 1)).toBe(true);
    expect(makesFive(b, 2, 7, 1)).toBe(true);
    expect(makesFive(b, 8, 7, 1)).toBe(false);
    expect(makesFive(b, 7, 7, 2)).toBe(false);
  });

  it("boardFull", () => {
    const b = makeBoard(3);
    expect(boardFull(b)).toBe(false);
    for (let i = 0; i < 9; i++) b.cells[i] = 1;
    expect(boardFull(b)).toBe(true);
  });
});

describe("gomoku 棋型识别", () => {
  it("活四 / 冲四 / 活三", () => {
    expect(analyzeWindow("..xxxx...".slice(0, 9)).liveFour).toBe(true);
    const rush = analyzeWindow("oxxxx....");
    expect(rush.liveFour).toBe(false);
    expect(rush.fourDots).toBeGreaterThan(0);
    expect(analyzeWindow("...xxx...").liveThree).toBe(true);
    expect(analyzeWindow("..x.xx...").liveThree).toBe(true);
    expect(analyzeWindow("oxxx.....").liveThree).toBe(false);
  });

  it("评分：活三远高于活二", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7]], 1); // 已有两连
    const three = evaluatePoint(b, 8, 7, 1); // 下这里成活三
    const b2 = makeBoard(15);
    put(b2, [[6, 7]], 1);
    const two = evaluatePoint(b2, 7, 7, 1); // 只成活二
    expect(three).toBeGreaterThan(two * 5);
  });
});

describe("gomoku 普通档 AI（不会漏）", () => {
  it("自己能成五就直接赢", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 2); // AI 执白已有四连
    put(b, [[3, 8], [4, 8], [5, 8]], 1);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    expect(makesFive(b, mv.x, mv.y, 2)).toBe(true);
  });

  it("必挡对方成五", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1); // 黑已四连（冲四）
    put(b, [[3, 8], [4, 8]], 2);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("会堵对方的活三（活三检测）", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7], [8, 7]], 1); // 黑活三 ..xxx..
    put(b, [[6, 9]], 2);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    // 挡两头任意一头都算对
    expect([[5, 7], [9, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("空棋盘先手下天元", () => {
    const b = makeBoard(15);
    const mv = bestMove(b, 1, "normal", () => 0)!;
    expect(mv).toEqual({ x: 7, y: 7 });
  });

  it("提示走法合法且是空位", () => {
    const b = makeBoard(9);
    put(b, [[4, 4]], 1);
    put(b, [[5, 5]], 2);
    const mv = hintMove(b, 1)!;
    expect(mv).not.toBeNull();
    expect(b.cells[mv.y * 9 + mv.x]).toBe(0);
  });
});

describe("gomoku 简单档 AI（会漏）", () => {
  it("rng 大时会漏掉必挡点", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1); // 黑冲四
    put(b, [[3, 9], [4, 9]], 2);
    const mv = bestMove(b, 2, "easy", () => 0.99)!;
    // 0.99 > 0.6 → 跳过挡五分支；又挑了第 3 名 → 不是挡点
    expect([[2, 7], [7, 7]]).not.toContainEqual([mv.x, mv.y]);
    // 但依然是合法空位
    expect(b.cells[mv.y * 15 + mv.x]).toBe(0);
  });

  it("rng 小时也能挡住", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    put(b, [[3, 9], [4, 9]], 2);
    const mv = bestMove(b, 2, "easy", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv.x, mv.y]);
  });
});

describe("gomoku 禁手（默认关，可开）", () => {
  it("长连禁手", () => {
    const b = makeBoard(15);
    // x x x _ x x：在 (6,7) 落子成 6 连
    put(b, [[3, 7], [4, 7], [5, 7], [7, 7], [8, 7]], 1);
    const r = isForbidden(b, 6, 7);
    expect(r.forbidden).toBe(true);
    expect(r.reason).toContain("长连");
  });

  it("正好成五不算禁手", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(isForbidden(b, 7, 7).forbidden).toBe(false);
  });

  it("双三禁手", () => {
    const b = makeBoard(15);
    // 横向 (5,7)(6,7) + 纵向 (7,5)(7,6)，在 (7,7) 落子形成两个活三
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1);
    const r = isForbidden(b, 7, 7);
    expect(r.forbidden).toBe(true);
    expect(r.reason).toContain("双三");
  });

  it("普通的一手棋不禁", () => {
    const b = makeBoard(15);
    put(b, [[5, 7]], 1);
    expect(isForbidden(b, 6, 7).forbidden).toBe(false);
  });

  it("判定不改变棋盘", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1);
    isForbidden(b, 7, 7);
    expect(b.cells[7 * 15 + 7]).toBe(0);
  });
});

describe("gomoku 候选点", () => {
  it("只考虑棋子附近的空位", () => {
    const b = makeBoard(15);
    put(b, [[7, 7]], 1);
    const cands = candidateMoves(b);
    expect(cands.length).toBe(24); // 5x5 减去自身
    for (const [x, y] of cands) {
      expect(Math.abs(x - 7)).toBeLessThanOrEqual(2);
      expect(Math.abs(y - 7)).toBeLessThanOrEqual(2);
    }
  });
});
