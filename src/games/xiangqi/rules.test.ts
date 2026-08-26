import { describe, expect, it } from "vitest";
import {
  type Board,
  type Move,
  type Piece,
  type Side,
  allLegalMoves,
  applyMove,
  idx,
  makeEmptyBoard,
} from "./logic";
import { positionKey } from "./movegen";
import {
  type RecordEntry,
  REPEAT_LIMIT,
  checkStreak,
  escapeKinds,
  illegalReason,
  judgeRecord,
  moveGivesCheck,
  perpetualCheckLoser,
  pushRecord,
  repetitionCount,
} from "./rules";

function put(b: Board, x: number, y: number, p: Piece): void {
  b[idx(x, y)] = p;
}

/** 摆一个「红车反复将军、黑将来回躲」的局面 */
function perpetualBoard(): Board {
  const b = makeEmptyBoard();
  put(b, 4, 0, { side: "black", type: "K" });
  put(b, 8, 0, { side: "red", type: "R" });
  put(b, 3, 9, { side: "red", type: "K" });
  return b;
}

/** 照着一串着法走下去，返回记录 */
function replay(board: Board, first: Side, moves: Move[]): { entries: RecordEntry[]; board: Board } {
  let cur = board;
  let side = first;
  let entries: RecordEntry[] = [];
  for (const m of moves) {
    entries = pushRecord(entries, cur, m, side, "");
    cur = applyMove(cur, m);
    side = side === "red" ? "black" : "red";
  }
  return { entries, board: cur };
}

const K = (x: number, y: number, tx: number, ty: number): Move => ({
  from: { x, y },
  to: { x: tx, y: ty },
});

describe("长将判负", () => {
  it("红车一直将、黑将来回躲，第三次同一个局面判红负", () => {
    const board = perpetualBoard();
    const startKey = positionKey(board, "black");
    // 黑躲 → 红换一条线接着将 → 黑躲回去 → 红也走回去……循环
    const cycle = [K(4, 0, 4, 1), K(8, 0, 8, 1), K(4, 1, 4, 0), K(8, 1, 8, 0)];
    const moves = [...cycle, ...cycle];
    const { entries } = replay(board, "black", moves);
    // 每一步红棋都在将军
    for (const e of entries.filter((x) => x.side === "red")) expect(e.check).toBe(true);
    const verdict = judgeRecord(startKey, entries);
    expect(verdict.kind).toBe("perpetual");
    expect(verdict.loser).toBe("red");
    expect(verdict.text).toContain("换一条进攻路线");
  });

  it("循环还没满三次就先不判", () => {
    const board = perpetualBoard();
    const startKey = positionKey(board, "black");
    const { entries } = replay(board, "black", [K(4, 0, 4, 1), K(8, 0, 8, 1), K(4, 1, 4, 0)]);
    expect(judgeRecord(startKey, entries).kind).toBe("none");
  });

  it("中间只要有一步不将军，连将就断了，不判负", () => {
    const entries: RecordEntry[] = [
      { side: "red", move: K(0, 0, 0, 1), check: true, key: "A", text: "" },
      { side: "black", move: K(4, 0, 4, 1), check: false, key: "x", text: "" },
      { side: "red", move: K(0, 1, 0, 0), check: false, key: "B", text: "" },
      { side: "black", move: K(4, 1, 4, 0), check: false, key: "y", text: "" },
      { side: "red", move: K(0, 0, 0, 1), check: true, key: "A", text: "" },
    ];
    expect(perpetualCheckLoser(entries, "A")).toBeNull();
  });

  it("最后一步不是将军就不适用长将", () => {
    const entries: RecordEntry[] = [
      { side: "red", move: K(0, 0, 0, 1), check: true, key: "A", text: "" },
      { side: "black", move: K(4, 0, 4, 1), check: false, key: "A", text: "" },
    ];
    expect(perpetualCheckLoser(entries, "A")).toBeNull();
  });

  it("checkStreak 数得出一方连着将了几步", () => {
    const entries: RecordEntry[] = [
      { side: "red", move: K(0, 0, 0, 1), check: true, key: "A", text: "" },
      { side: "black", move: K(4, 0, 4, 1), check: false, key: "b", text: "" },
      { side: "red", move: K(0, 1, 0, 0), check: true, key: "B", text: "" },
    ];
    expect(checkStreak(entries, "red")).toBe(2);
    expect(checkStreak(entries, "black")).toBe(0);
  });

  it("长将的门槛就是三次", () => {
    expect(REPEAT_LIMIT).toBe(3);
  });
});

describe("重复局面判和", () => {
  it("同一个局面（含轮到谁走）出现三次算和棋", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 3, 9, { side: "red", type: "K" });
    put(b, 0, 5, { side: "red", type: "R" });
    put(b, 8, 4, { side: "black", type: "R" });
    const startKey = positionKey(b, "red");
    // 两只车各自来回走，谁也不将军
    const cycle = [K(0, 5, 0, 6), K(8, 4, 8, 3), K(0, 6, 0, 5), K(8, 3, 8, 4)];
    const { entries } = replay(b, "red", [...cycle, ...cycle]);
    for (const e of entries) expect(e.check).toBe(false);
    const verdict = judgeRecord(startKey, entries);
    expect(verdict.kind).toBe("repetition");
    expect(verdict.loser).toBeNull();
    expect(verdict.text).toContain("和棋");
  });

  it("走一圈只有两次的时候还不判", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 3, 9, { side: "red", type: "K" });
    put(b, 0, 5, { side: "red", type: "R" });
    put(b, 8, 4, { side: "black", type: "R" });
    const startKey = positionKey(b, "red");
    const { entries } = replay(b, "red", [K(0, 5, 0, 6), K(8, 4, 8, 3), K(0, 6, 0, 5), K(8, 3, 8, 4)]);
    expect(repetitionCount(startKey, entries)).toBe(2);
    expect(judgeRecord(startKey, entries).kind).toBe("none");
  });

  it("刚开局什么都没走时，起始局面算出现过一次", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(repetitionCount(positionKey(b, "red"), [])).toBe(1);
  });
});

describe("这一步是不是将军", () => {
  it("moveGivesCheck 认得出车照面将军", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 0, 5, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    expect(moveGivesCheck(b, K(0, 5, 4, 5), "red")).toBe(true);
    expect(moveGivesCheck(b, K(0, 5, 1, 5), "red")).toBe(false);
  });

  it("pushRecord 会把将军与局面指纹一起记下来", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 0, 5, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    const entries = pushRecord([], b, K(0, 5, 4, 5), "red", "车九平五");
    expect(entries).toHaveLength(1);
    expect(entries[0].check).toBe(true);
    expect(entries[0].text).toBe("车九平五");
    expect(entries[0].key).toContain("b|");
  });
});

describe("走不了的时候要说清楚原因", () => {
  function base(): Board {
    const b = makeEmptyBoard();
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 4, { side: "black", type: "P" }); // 挡住中线，避免飞将干扰
    return b;
  }

  it("蹩马腿", () => {
    const b = base();
    put(b, 4, 6, { side: "red", type: "H" });
    put(b, 4, 5, { side: "black", type: "R" });
    const why = illegalReason(b, { x: 4, y: 6 }, { x: 3, y: 4 }, "red");
    expect(why?.kind).toBe("leg");
    expect(why?.text).toContain("马腿");
  });

  it("塞象眼", () => {
    const b = base();
    put(b, 2, 9, { side: "red", type: "E" });
    put(b, 3, 8, { side: "black", type: "P" });
    const why = illegalReason(b, { x: 2, y: 9 }, { x: 4, y: 7 }, "red");
    expect(why?.kind).toBe("eye");
    expect(why?.text).toContain("象眼");
  });

  it("相不能过河", () => {
    const b = base();
    put(b, 2, 5, { side: "red", type: "E" });
    const why = illegalReason(b, { x: 2, y: 5 }, { x: 0, y: 3 }, "red");
    expect(why?.kind).toBe("river");
    expect(why?.text).toContain("过河");
  });

  it("兵不能后退", () => {
    const b = base();
    put(b, 0, 4, { side: "red", type: "P" });
    const why = illegalReason(b, { x: 0, y: 4 }, { x: 0, y: 5 }, "red");
    expect(why?.kind).toBe("backward");
    expect(why?.text).toContain("不能后退");
  });

  it("兵过河前不能横走", () => {
    const b = base();
    put(b, 0, 6, { side: "red", type: "P" });
    const why = illegalReason(b, { x: 0, y: 6 }, { x: 1, y: 6 }, "red");
    expect(why?.kind).toBe("river");
  });

  it("炮没有炮架不能吃子", () => {
    const b = base();
    put(b, 0, 9, { side: "red", type: "C" });
    put(b, 0, 5, { side: "black", type: "R" });
    const why = illegalReason(b, { x: 0, y: 9 }, { x: 0, y: 5 }, "red");
    expect(why?.kind).toBe("screen");
    expect(why?.text).toContain("炮架");
  });

  it("车不能越子", () => {
    const b = base();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 0, 7, { side: "black", type: "P" });
    const why = illegalReason(b, { x: 0, y: 9 }, { x: 0, y: 5 }, "red");
    expect(why?.kind).toBe("blocked");
  });

  it("士出不了九宫", () => {
    const b = base();
    put(b, 3, 9, { side: "red", type: "A" });
    const why = illegalReason(b, { x: 3, y: 9 }, { x: 2, y: 8 }, "red");
    expect(why?.kind).toBe("palace");
  });

  it("将帅不能照面", () => {
    const b = makeEmptyBoard();
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 3, 0, { side: "black", type: "K" });
    const why = illegalReason(b, { x: 3, y: 0 }, { x: 4, y: 0 }, "black");
    expect(why?.kind).toBe("facing");
    expect(why?.text).toContain("照面");
  });

  it("不许送将", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 2, { side: "black", type: "R" });
    put(b, 4, 6, { side: "red", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    const why = illegalReason(b, { x: 4, y: 2 }, { x: 3, y: 2 }, "black");
    expect(why?.kind).toBe("selfCheck");
    expect(why?.text).toContain("被将军");
  });

  it("点到对方的子 / 空点 / 自己人都有专门的话", () => {
    const b = base();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 1, 9, { side: "red", type: "H" });
    expect(illegalReason(b, { x: 5, y: 5 }, { x: 5, y: 4 }, "red")?.kind).toBe("empty");
    expect(illegalReason(b, { x: 4, y: 0 }, { x: 4, y: 1 }, "red")?.kind).toBe("notYours");
    expect(illegalReason(b, { x: 0, y: 9 }, { x: 1, y: 9 }, "red")?.kind).toBe("own");
  });

  it("合法的一步返回 null", () => {
    const b = base();
    put(b, 0, 9, { side: "red", type: "R" });
    expect(illegalReason(b, { x: 0, y: 9 }, { x: 0, y: 5 }, "red")).toBeNull();
  });

  it("给出的原因和 logic 的合法性判断永远一致", () => {
    const b = base();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 4, 6, { side: "red", type: "H" });
    const legal = new Set(
      allLegalMoves(b, "red").map((m) => `${m.from.x}${m.from.y}${m.to.x}${m.to.y}`),
    );
    for (let fy = 0; fy < 10; fy++) {
      for (let fx = 0; fx < 9; fx++) {
        if (b[idx(fx, fy)]?.side !== "red") continue;
        for (let ty = 0; ty < 10; ty++) {
          for (let tx = 0; tx < 9; tx++) {
            const key = `${fx}${fy}${tx}${ty}`;
            const why = illegalReason(b, { x: fx, y: fy }, { x: tx, y: ty }, "red");
            expect(why === null, key).toBe(legal.has(key));
          }
        }
      }
    }
  });
});

describe("被将军时有哪几种应法", () => {
  it("能垫、能吃、能逃都数得出来", () => {
    const b = makeEmptyBoard();
    put(b, 4, 0, { side: "black", type: "K" });
    put(b, 4, 5, { side: "red", type: "R" });
    put(b, 0, 1, { side: "black", type: "R" });
    put(b, 3, 9, { side: "red", type: "K" });
    const moves = allLegalMoves(b, "black");
    const kinds = escapeKinds(b, "black", moves);
    expect(kinds).toContain("move");
    expect(kinds).toContain("block");
  });
});
