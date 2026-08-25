import { describe, expect, it } from "vitest";
import {
  type Board,
  type Piece,
  aiMove,
  allLegalMoves,
  applyMove,
  generalsFacing,
  idx,
  inCheck,
  initialBoard,
  legalMoves,
  makeEmptyBoard,
  rawMoves,
  statusOf,
} from "./logic";

function put(board: Board, x: number, y: number, piece: Piece): void {
  board[idx(x, y)] = piece;
}

function has(moves: Array<{ x: number; y: number }>, x: number, y: number): boolean {
  return moves.some((m) => m.x === x && m.y === y);
}

describe("初始布局", () => {
  it("双方各 16 子，关键位置正确", () => {
    const b = initialBoard();
    let red = 0;
    let black = 0;
    for (const p of b) {
      if (p?.side === "red") red++;
      if (p?.side === "black") black++;
    }
    expect(red).toBe(16);
    expect(black).toBe(16);
    expect(b[idx(4, 9)]).toEqual({ side: "red", type: "K" });
    expect(b[idx(4, 0)]).toEqual({ side: "black", type: "K" });
    expect(b[idx(1, 7)]).toEqual({ side: "red", type: "C" });
    expect(b[idx(0, 6)]).toEqual({ side: "red", type: "P" });
    expect(b[idx(8, 3)]).toEqual({ side: "black", type: "P" });
  });

  it("红方开局共 44 步合法棋（标准数字）", () => {
    const b = initialBoard();
    expect(allLegalMoves(b, "red").length).toBe(44);
  });
});

describe("将/帅", () => {
  it("只能在九宫内走一格直线", () => {
    const b = makeEmptyBoard();
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 5, { side: "black", type: "P" }); // 挡住中线避免飞将干扰
    const moves = rawMoves(b, 4, 9);
    expect(has(moves, 3, 9)).toBe(true);
    expect(has(moves, 5, 9)).toBe(true);
    expect(has(moves, 4, 8)).toBe(true);
    expect(moves.length).toBe(3); // 不能走出棋盘 / 九宫
  });

  it("不允许飞将：走成将帅对脸的棋不合法", () => {
    const b = makeEmptyBoard();
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 3, 0, { side: "black", type: "K" });
    // 黑将若走到 (4,0) 就和红帅对脸（中间无子）→ 不合法
    const moves = legalMoves(b, 3, 0);
    expect(has(moves, 4, 0)).toBe(false);
    expect(has(moves, 3, 1)).toBe(true);
  });

  it("generalsFacing 检测对脸", () => {
    const b = makeEmptyBoard();
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 0, { side: "black", type: "K" });
    expect(generalsFacing(b)).toBe(true);
    put(b, 4, 5, { side: "red", type: "P" });
    expect(generalsFacing(b)).toBe(false);
  });
});

describe("士与象", () => {
  it("士只走九宫斜线", () => {
    const b = makeEmptyBoard();
    put(b, 4, 8, { side: "red", type: "A" });
    const moves = rawMoves(b, 4, 8);
    expect(moves.length).toBe(4);
    expect(has(moves, 3, 7)).toBe(true);
    expect(has(moves, 5, 9)).toBe(true);
  });

  it("象走田字、不能过河、塞象眼", () => {
    const b = makeEmptyBoard();
    put(b, 4, 7, { side: "red", type: "E" });
    let moves = rawMoves(b, 4, 7);
    expect(has(moves, 2, 5)).toBe(true);
    expect(has(moves, 6, 5)).toBe(true);
    expect(has(moves, 2, 9)).toBe(true);
    expect(has(moves, 6, 9)).toBe(true);
    // 不能过河：(2,5) 往上 (0,3)、(4,3) 这类目标不存在于象在 y=5 时
    put(b, 4, 7, null as unknown as Piece);
    b[idx(4, 7)] = null;
    put(b, 2, 5, { side: "red", type: "E" });
    moves = rawMoves(b, 2, 5);
    expect(has(moves, 0, 3)).toBe(false);
    expect(has(moves, 4, 3)).toBe(false);
    expect(has(moves, 0, 7)).toBe(true);
    // 塞象眼
    put(b, 3, 6, { side: "black", type: "P" });
    moves = rawMoves(b, 2, 5);
    expect(has(moves, 4, 7)).toBe(false);
  });
});

describe("马", () => {
  it("马走日，八个方向", () => {
    const b = makeEmptyBoard();
    put(b, 4, 5, { side: "red", type: "H" });
    expect(rawMoves(b, 4, 5).length).toBe(8);
  });

  it("蹩马腿", () => {
    const b = makeEmptyBoard();
    put(b, 4, 5, { side: "red", type: "H" });
    put(b, 4, 4, { side: "black", type: "P" }); // 蹩住向上两跳
    const moves = rawMoves(b, 4, 5);
    expect(has(moves, 3, 3)).toBe(false);
    expect(has(moves, 5, 3)).toBe(false);
    expect(has(moves, 2, 4)).toBe(true);
    expect(moves.length).toBe(6);
  });
});

describe("车与炮", () => {
  it("车直线走，遇子而止，可吃第一个敌子", () => {
    const b = makeEmptyBoard();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 0, 5, { side: "black", type: "P" });
    put(b, 0, 3, { side: "black", type: "P" });
    const moves = rawMoves(b, 0, 9);
    expect(has(moves, 0, 6)).toBe(true);
    expect(has(moves, 0, 5)).toBe(true); // 吃
    expect(has(moves, 0, 4)).toBe(false); // 不能越子
    expect(has(moves, 0, 3)).toBe(false);
  });

  it("炮平走不吃，隔一个炮架才能吃", () => {
    const b = makeEmptyBoard();
    put(b, 1, 7, { side: "red", type: "C" });
    put(b, 1, 4, { side: "red", type: "P" }); // 炮架
    put(b, 1, 2, { side: "black", type: "H" }); // 目标
    put(b, 1, 0, { side: "black", type: "R" }); // 炮架后第二个子，吃不到
    const moves = rawMoves(b, 1, 7);
    expect(has(moves, 1, 5)).toBe(true); // 空点可走
    expect(has(moves, 1, 4)).toBe(false); // 己方子不能吃
    expect(has(moves, 1, 2)).toBe(true); // 隔山打
    expect(has(moves, 1, 0)).toBe(false);
  });
});

describe("兵与卒", () => {
  it("过河前只能向前", () => {
    const b = makeEmptyBoard();
    put(b, 2, 6, { side: "red", type: "P" });
    const moves = rawMoves(b, 2, 6);
    expect(moves).toEqual([{ x: 2, y: 5 }]);
  });

  it("过河后可以横走，永不后退", () => {
    const b = makeEmptyBoard();
    put(b, 2, 4, { side: "red", type: "P" });
    const moves = rawMoves(b, 2, 4);
    expect(has(moves, 2, 3)).toBe(true);
    expect(has(moves, 1, 4)).toBe(true);
    expect(has(moves, 3, 4)).toBe(true);
    expect(has(moves, 2, 5)).toBe(false);
  });

  it("黑卒方向相反", () => {
    const b = makeEmptyBoard();
    put(b, 2, 3, { side: "black", type: "P" });
    expect(rawMoves(b, 2, 3)).toEqual([{ x: 2, y: 4 }]);
  });
});

describe("将军与送将", () => {
  it("inCheck 能发现车将军", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 5, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(inCheck(b, "black")).toBe(true);
    expect(inCheck(b, "red")).toBe(false);
  });

  it("被牵制的子不能走开（不能送将）", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 2, { side: "black", type: "R" }); // 挡在中间的黑车
    put(b, 4, 6, { side: "red", type: "R" }); // 红车牵制
    put(b, 3, 9, { side: "red", type: "K" });
    const moves = legalMoves(b, 4, 2);
    // 黑车只能沿 4 列活动或吃掉红车，不能横走送将
    for (const m of moves) expect(m.x).toBe(4);
    expect(has(moves, 4, 6)).toBe(true);
  });
});

describe("将死与困毙", () => {
  it("双车错将死", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 0, 0, { side: "red", type: "R" });
    put(b, 0, 1, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(statusOf(b, "black")).toBe("checkmate");
  });

  it("无子可走判困毙", () => {
    const b = makeEmptyBoard();
    put(b, 3, 0, { side: "black", type: "K" });
    put(b, 2, 1, { side: "red", type: "P" }); // 封 (3,1)
    put(b, 4, 5, { side: "red", type: "R" }); // 封 (4,0)
    put(b, 5, 9, { side: "red", type: "K" });
    expect(inCheck(b, "black")).toBe(false);
    expect(statusOf(b, "black")).toBe("stalemate");
  });

  it("被将军但能应将不算将死", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 5, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(statusOf(b, "black")).toBe("check");
  });
});

describe("电脑走子", () => {
  it("永远返回合法棋", () => {
    const b = initialBoard();
    const mv = aiMove(b, "black", () => 0.5);
    expect(mv).not.toBeNull();
    const legal = allLegalMoves(b, "black");
    expect(legal.some((m) =>
      m.from.x === mv!.from.x && m.from.y === mv!.from.y &&
      m.to.x === mv!.to.x && m.to.y === mv!.to.y,
    )).toBe(true);
  });

  it("有将死机会时直接将死", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 0, 1, { side: "red", type: "R" });
    put(b, 1, 2, { side: "red", type: "R" }); // 车到 (1,0)/(0,0) 即双车错
    put(b, 3, 9, { side: "red", type: "K" });
    const mv = aiMove(b, "red", () => 0);
    expect(mv).not.toBeNull();
    const after = applyMove(b, mv!);
    // 将死或困毙都算赢
    expect(["checkmate", "stalemate"]).toContain(statusOf(after, "black"));
  });

  it("白送的大子会吃掉", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 4, { side: "black", type: "P" }); // 隔开双王
    put(b, 0, 5, { side: "black", type: "R" });
    put(b, 0, 2, { side: "red", type: "R" }); // 红车可直接吃黑车
    const mv = aiMove(b, "red", () => 0);
    expect(mv).not.toBeNull();
    expect(mv!.to).toEqual({ x: 0, y: 5 });
  });

  it("被将死时返回 null", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 0, 0, { side: "red", type: "R" });
    put(b, 0, 1, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(aiMove(b, "black", () => 0)).toBeNull();
  });
});
