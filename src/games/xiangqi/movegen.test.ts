import { describe, expect, it } from "vitest";
import {
  type Board,
  type Piece,
  type PieceType,
  type Side,
  allLegalMoves,
  applyMove,
  idx,
  inCheck,
  initialBoard,
  legalMoves,
  makeEmptyBoard,
} from "./logic";
import { mulberry32 } from "../level99";
import {
  genMoves,
  hasLegalMove,
  kingAttacked,
  legalTargets,
  makeMove,
  moveKey,
  positionKey,
  sameMove,
  unmakeMove,
} from "./movegen";

function put(b: Board, x: number, y: number, p: Piece): void {
  b[idx(x, y)] = p;
}

/** 造一个「摆得合规」的随机局面：将帅在九宫、士象在自己的点上、兵卒不在自家底线 */
function randomPosition(rng: () => number): Board {
  const b = makeEmptyBoard();
  const used = new Set<number>();
  const place = (side: Side, type: PieceType, x: number, y: number): void => {
    const i = idx(x, y);
    if (used.has(i)) return;
    used.add(i);
    b[i] = { side, type };
  };
  place("red", "K", 3 + Math.floor(rng() * 3), 7 + Math.floor(rng() * 3));
  place("black", "K", 3 + Math.floor(rng() * 3), Math.floor(rng() * 3));
  const pool: PieceType[] = ["R", "C", "H", "P", "P", "R", "C", "H"];
  for (const side of ["red", "black"] as const) {
    const n = 2 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const type = pool[Math.floor(rng() * pool.length)];
      const x = Math.floor(rng() * 9);
      const y =
        type === "P"
          ? side === "red"
            ? Math.floor(rng() * 7)
            : 3 + Math.floor(rng() * 7)
          : Math.floor(rng() * 10);
      place(side, type, x, y);
    }
  }
  return b;
}

describe("走法加速层和 logic.ts 结论完全一致", () => {
  it("开局局面：着法数、被将判定都对得上", () => {
    const b = initialBoard();
    expect(genMoves(b, "red").length).toBe(allLegalMoves(b, "red").length);
    expect(genMoves(b, "black").length).toBe(allLegalMoves(b, "black").length);
    expect(kingAttacked(b, "red")).toBe(inCheck(b, "red"));
    expect(kingAttacked(b, "black")).toBe(inCheck(b, "black"));
  });

  it("200 个随机局面：kingAttacked 与 inCheck 一模一样", () => {
    const rng = mulberry32(20260810);
    for (let t = 0; t < 200; t++) {
      const b = randomPosition(rng);
      for (const side of ["red", "black"] as const) {
        expect(kingAttacked(b, side), `第 ${t} 个局面 ${side}`).toBe(inCheck(b, side));
      }
    }
  });

  it("120 个随机局面：genMoves 与 allLegalMoves 的着法集合相同", () => {
    const rng = mulberry32(7788);
    for (let t = 0; t < 120; t++) {
      const b = randomPosition(rng);
      for (const side of ["red", "black"] as const) {
        const fast = genMoves(b, side).map(moveKey).sort();
        const slow = allLegalMoves(b, side).map(moveKey).sort();
        expect(fast, `第 ${t} 个局面 ${side}`).toEqual(slow);
      }
    }
  });

  it("legalTargets 与 legalMoves 对每个子都一致", () => {
    const rng = mulberry32(31337);
    for (let t = 0; t < 40; t++) {
      const b = randomPosition(rng);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          if (!b[idx(x, y)]) continue;
          const fast = legalTargets(b, x, y)
            .map((p) => `${p.x}${p.y}`)
            .sort();
          const slow = legalMoves(b, x, y)
            .map((p) => `${p.x}${p.y}`)
            .sort();
          expect(fast).toEqual(slow);
        }
      }
    }
  });

  it("hasLegalMove 和「着法数是不是 0」一致", () => {
    const rng = mulberry32(4242);
    for (let t = 0; t < 60; t++) {
      const b = randomPosition(rng);
      for (const side of ["red", "black"] as const) {
        expect(hasLegalMove(b, side)).toBe(allLegalMoves(b, side).length > 0);
      }
    }
    // 双车错：黑方一步都走不了
    const mated = makeEmptyBoard();
    put(mated, 4, 0, { side: "black", type: "K" });
    put(mated, 0, 0, { side: "red", type: "R" });
    put(mated, 0, 1, { side: "red", type: "R" });
    put(mated, 3, 9, { side: "red", type: "K" });
    expect(hasLegalMove(mated, "black")).toBe(false);
  });
});

describe("就地走子与撤销", () => {
  it("走完再撤回来，棋盘一格不差", () => {
    const b = initialBoard();
    const before = positionKey(b, "red");
    const mv = { from: { x: 7, y: 7 }, to: { x: 4, y: 7 } };
    const captured = makeMove(b, mv);
    expect(positionKey(b, "black")).not.toBe(before);
    unmakeMove(b, mv, captured);
    expect(positionKey(b, "red")).toBe(before);
  });

  it("吃子之后撤回来，被吃的子会回到原位", () => {
    const b = makeEmptyBoard();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 0, 3, { side: "black", type: "P" });
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 0, { side: "black", type: "K" });
    const mv = { from: { x: 0, y: 9 }, to: { x: 0, y: 3 } };
    const captured = makeMove(b, mv);
    expect(captured).toEqual({ side: "black", type: "P" });
    expect(b[idx(0, 9)]).toBeNull();
    unmakeMove(b, mv, captured);
    expect(b[idx(0, 3)]).toEqual({ side: "black", type: "P" });
    expect(b[idx(0, 9)]).toEqual({ side: "red", type: "R" });
  });

  it("就地走子和 applyMove 得到同一个局面", () => {
    const b = initialBoard();
    const mv = { from: { x: 1, y: 9 }, to: { x: 2, y: 7 } };
    const copy = applyMove(b, mv);
    makeMove(b, mv);
    expect(positionKey(b, "black")).toBe(positionKey(copy, "black"));
  });
});

describe("局面指纹", () => {
  it("同一个局面轮到不同人走算两个指纹", () => {
    const b = initialBoard();
    expect(positionKey(b, "red")).not.toBe(positionKey(b, "black"));
  });

  it("不同局面指纹不同，走回去指纹相同", () => {
    const b = initialBoard();
    const first = positionKey(b, "red");
    const mv = { from: { x: 1, y: 9 }, to: { x: 2, y: 7 } };
    const cap = makeMove(b, mv);
    const moved = positionKey(b, "red");
    expect(moved).not.toBe(first);
    unmakeMove(b, mv, cap);
    expect(positionKey(b, "red")).toBe(first);
  });

  it("sameMove / moveKey 认得出同一步棋", () => {
    const a = { from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };
    const b = { from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };
    const c = { from: { x: 1, y: 2 }, to: { x: 3, y: 5 } };
    expect(moveKey(a)).toBe(moveKey(b));
    expect(sameMove(a, b)).toBe(true);
    expect(sameMove(a, c)).toBe(false);
    expect(sameMove(null, a)).toBe(false);
  });
});
