import { describe, expect, it } from "vitest";
import { parseFen, squareName, startPosition, toFen, zobrist, START_FEN } from "./board";
import {
  attacked,
  canCastle,
  findMove,
  inCheck,
  insufficientMaterial,
  legalMoves,
  legalMovesFrom,
  makeMove,
  perft,
  pseudoMoves,
  status,
  toSan,
} from "./rules";

function movesFrom(fen: string, sq: string): string[] {
  const pos = parseFen(fen);
  return legalMovesFrom(pos, require_sq(sq)).map((m) => squareName(m.to)).sort();
}

function require_sq(name: string): number {
  const f = "abcdefgh".indexOf(name[0]);
  const r = "87654321".indexOf(name[1]);
  return r * 8 + f;
}

describe("花园国际象棋 · FEN 与局面", () => {
  it("起始局面读得进也写得出", () => {
    const pos = startPosition();
    expect(toFen(pos)).toBe(START_FEN);
    expect(pos.turn).toBe("w");
    expect(pos.board.filter((p) => p !== null).length).toBe(32);
  });

  it("同一个局面哈希一样，换轮走方哈希就变", () => {
    const a = parseFen("8/8/8/4k3/8/8/8/4K3 w - - 0 1");
    const b = parseFen("8/8/8/4k3/8/8/8/4K3 w - - 0 1");
    const c = parseFen("8/8/8/4k3/8/8/8/4K3 b - - 0 1");
    expect(zobrist(a)).toBe(zobrist(b));
    expect(zobrist(a)).not.toBe(zobrist(c));
  });

  it("易位权和过路格也算进哈希", () => {
    const a = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const b = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Kkq - 0 1");
    expect(zobrist(a)).not.toBe(zobrist(b));
  });
});

describe("花园国际象棋 · 六种棋子的走法", () => {
  it("兵：首步可以走两格", () => {
    expect(movesFrom(START_FEN, "e2")).toEqual(["e3", "e4"]);
  });

  it("兵：只能斜着吃，正前方有子就走不动", () => {
    expect(movesFrom("8/8/8/8/3p4/3P4/8/4K2k w - - 0 1", "d3")).toEqual([]);
    expect(movesFrom("8/8/8/8/2pp4/3P4/8/4K2k w - - 0 1", "d3")).toEqual(["c4"]);
  });

  it("车：直线走到底，被挡住就停", () => {
    expect(movesFrom("8/8/8/8/8/8/8/R3K2k w - - 0 1", "a1").length).toBe(10);
  });

  it("象：只走斜线", () => {
    const list = movesFrom("8/8/8/3B4/8/8/8/4K2k w - - 0 1", "d5");
    expect(list).toContain("a8");
    expect(list).toContain("h1");
    expect(list).not.toContain("d6");
  });

  it("马：会跳过挡路的子", () => {
    const list = movesFrom("8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1", "b1");
    expect(list.sort()).toEqual(["a3", "c3"]);
  });

  it("后：直线加斜线一起走", () => {
    const q = movesFrom("8/8/8/3Q4/8/8/8/4K2k w - - 0 1", "d5");
    expect(q.length).toBe(27);
  });

  it("王：一次一格，八个方向", () => {
    expect(movesFrom("8/8/8/3K4/8/8/8/7k w - - 0 1", "d5").length).toBe(8);
  });
});

describe("花园国际象棋 · 不能把自己送将", () => {
  it("被别住的子不能乱动", () => {
    // 白象在 e2 被 e 线上的黑车别住，一挪开白王就露出来了
    const list = movesFrom("k3r3/8/8/8/8/8/4B3/4K3 w - - 0 1", "e2");
    expect(list).toEqual([]);
  });

  it("被将军时只剩能解将的那几手", () => {
    const pos = parseFen("4k3/8/8/8/8/8/8/4K2r w - - 0 1");
    expect(inCheck(pos, "w")).toBe(true);
    const list = legalMoves(pos).map((m) => squareName(m.to)).sort();
    expect(list).toEqual(["d2", "e2", "f2"]);
    for (const m of legalMoves(pos)) {
      expect(inCheck(makeMove(pos, m), "w")).toBe(false);
    }
  });

  it("攻击格判断认得出兵的斜线", () => {
    const pos = parseFen("8/8/8/8/8/5p2/8/4K2k w - - 0 1");
    expect(attacked(pos, require_sq("e2"), "b")).toBe(true);
    expect(attacked(pos, require_sq("f2"), "b")).toBe(false);
  });
});

describe("花园国际象棋 · 吃过路兵", () => {
  it("对方兵刚走两格，下一手可以吃过路", () => {
    let pos = parseFen("4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1");
    const dbl = findMove(pos, "d2", "d4")!;
    expect(dbl.double).toBe(true);
    pos = makeMove(pos, dbl);
    expect(pos.ep === null ? "-" : squareName(pos.ep)).toBe("d3");
    const ep = findMove(pos, "e4", "d3")!;
    expect(ep.ep).toBe(true);
    const after = makeMove(pos, ep);
    expect(after.board[require_sq("d4")]).toBe(null);
  });

  it("错过了这一手就再也吃不了过路兵", () => {
    let pos = parseFen("4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1");
    pos = makeMove(pos, findMove(pos, "d2", "d4")!);
    pos = makeMove(pos, findMove(pos, "e8", "f8")!); // 黑方先干别的
    expect(pos.ep).toBe(null);
    pos = makeMove(pos, findMove(pos, "e1", "f1")!);
    expect(findMove(pos, "e4", "d3")).toBe(null);
  });
});

describe("花园国际象棋 · 王车易位", () => {
  const READY = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("短易位和长易位都能走", () => {
    const pos = parseFen(READY);
    expect(canCastle(pos, "w", "k")).toBe(true);
    expect(canCastle(pos, "w", "q")).toBe(true);
    const short = findMove(pos, "e1", "g1")!;
    expect(short.castle).toBe("k");
    const after = makeMove(pos, short);
    expect(after.board[require_sq("f1")]?.type).toBe("r");
    expect(after.board[require_sq("g1")]?.type).toBe("k");
  });

  it("长易位车会落到 d1", () => {
    const pos = parseFen(READY);
    const long = findMove(pos, "e1", "c1")!;
    const after = makeMove(pos, long);
    expect(after.board[require_sq("d1")]?.type).toBe("r");
    expect(after.board[require_sq("c1")]?.type).toBe("k");
  });

  it("王动过就不能易位了", () => {
    let pos = parseFen(READY);
    pos = makeMove(pos, findMove(pos, "e1", "f1")!);
    pos = makeMove(pos, findMove(pos, "e8", "f8")!);
    pos = makeMove(pos, findMove(pos, "f1", "e1")!);
    expect(pos.castling.wk).toBe(false);
    expect(canCastle(pos, "w", "k")).toBe(false);
  });

  it("车动过那一边就不能易位", () => {
    let pos = parseFen(READY);
    pos = makeMove(pos, findMove(pos, "h1", "h2")!);
    pos = makeMove(pos, findMove(pos, "e8", "f8")!);
    pos = makeMove(pos, findMove(pos, "h2", "h1")!);
    expect(canCastle(pos, "w", "k")).toBe(false);
    expect(canCastle(pos, "w", "q")).toBe(true);
  });

  it("中间有子不能易位", () => {
    const pos = parseFen("r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1");
    expect(canCastle(pos, "w", "k")).toBe(false);
  });

  it("经过格被攻击不能易位；被将军也不能易位", () => {
    const cross = parseFen("r3k2r/8/8/8/8/8/6q1/R3K2R w KQkq - 0 1");
    expect(canCastle(cross, "w", "k")).toBe(false);
    const checked = parseFen("r3k2r/8/8/8/8/8/4q3/R3K2R w KQkq - 0 1");
    expect(canCastle(checked, "w", "k")).toBe(false);
    expect(canCastle(checked, "w", "q")).toBe(false);
  });
});

describe("花园国际象棋 · 升变", () => {
  it("兵到底线必须升变，四种都能选", () => {
    const pos = parseFen("8/4P3/8/8/8/8/8/4K2k w - - 0 1");
    const list = legalMovesFrom(pos, require_sq("e7"));
    expect(list.length).toBe(4);
    expect(list.map((m) => m.promo).sort()).toEqual(["b", "n", "q", "r"]);
    expect(list.every((m) => m.promo !== undefined)).toBe(true);
  });

  it("选马就真的变成马", () => {
    const pos = parseFen("8/4P3/8/8/8/8/8/4K2k w - - 0 1");
    const after = makeMove(pos, findMove(pos, "e7", "e8", "n")!);
    expect(after.board[require_sq("e8")]?.type).toBe("n");
  });

  it("斜吃到底线一样要升变", () => {
    const pos = parseFen("3r4/4P3/8/8/8/8/8/4K2k w - - 0 1");
    const list = legalMovesFrom(pos, require_sq("e7")).filter((m) => squareName(m.to) === "d8");
    expect(list.length).toBe(4);
  });
});

describe("花园国际象棋 · 胜负与和棋", () => {
  it("将杀", () => {
    const pos = parseFen("8/8/8/8/8/5k2/6q1/7K w - - 0 1");
    expect(status(pos)).toEqual({ kind: "checkmate", winner: "b" });
  });

  it("逼和：没被将却一步都走不了", () => {
    const pos = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(status(pos)).toEqual({ kind: "stalemate" });
  });

  it("50 回合判和", () => {
    const pos = parseFen("8/8/4k3/8/8/4K3/8/6R1 w - - 100 80");
    expect(status(pos)).toEqual({ kind: "draw", why: "fifty" });
  });

  it("三次重复局面判和", () => {
    const pos = parseFen("8/8/4k3/8/8/4K3/8/6R1 w - - 4 40");
    const h = zobrist(pos);
    expect(status(pos, [h, h, h])).toEqual({ kind: "draw", why: "repetition" });
    expect(status(pos, [h]).kind).toBe("playing");
  });

  it("子力不足判和：王对王、王象对王、王马对王", () => {
    expect(insufficientMaterial(parseFen("8/8/4k3/8/8/4K3/8/8 w - - 0 1"))).toBe(true);
    expect(insufficientMaterial(parseFen("8/8/4k3/8/8/4K3/8/5B2 w - - 0 1"))).toBe(true);
    expect(insufficientMaterial(parseFen("8/8/4k3/8/8/4K3/8/5N2 w - - 0 1"))).toBe(true);
    expect(insufficientMaterial(parseFen("8/8/4k3/8/8/4K3/8/5R2 w - - 0 1"))).toBe(false);
  });
});

describe("花园国际象棋 · perft 走法生成校验", () => {
  it("起始局面 depth 1–4", () => {
    const pos = startPosition();
    expect(perft(pos, 1)).toBe(20);
    expect(perft(pos, 2)).toBe(400);
    expect(perft(pos, 3)).toBe(8902);
    expect(perft(pos, 4)).toBe(197281);
  }, 30000);

  it("Kiwipete 复杂局面 depth 1–3", () => {
    const pos = parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect(perft(pos, 1)).toBe(48);
    expect(perft(pos, 2)).toBe(2039);
    expect(perft(pos, 3)).toBe(97862);
  }, 30000);

  it("过路兵与升变都算得对的第三号局面", () => {
    const pos = parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect(perft(pos, 1)).toBe(14);
    expect(perft(pos, 2)).toBe(191);
    expect(perft(pos, 3)).toBe(2812);
    expect(perft(pos, 4)).toBe(43238);
  }, 30000);

  it("升变密集的第五号局面", () => {
    const pos = parseFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8");
    expect(perft(pos, 1)).toBe(44);
    expect(perft(pos, 2)).toBe(1486);
    expect(perft(pos, 3)).toBe(62379);
  }, 30000);
});

describe("花园国际象棋 · 记谱", () => {
  it("易位、吃子、将军都记得出来", () => {
    const ready = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(toSan(ready, findMove(ready, "e1", "g1")!)).toBe("O-O");
    expect(toSan(ready, findMove(ready, "e1", "c1")!)).toBe("O-O-O");
    const cap = parseFen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    expect(toSan(cap, findMove(cap, "e4", "d5")!)).toBe("exd5");
    const mate = parseFen("6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1");
    expect(toSan(mate, findMove(mate, "a1", "a8")!)).toBe("Ra8#");
    const check = parseFen("6k1/5pp1/7p/8/8/8/8/R3K3 w Q - 0 1");
    expect(toSan(check, findMove(check, "a1", "a8")!)).toBe("Ra8+");
  });

  it("伪合法走法里包含会送将的手，合法走法里没有", () => {
    const pos = parseFen("k3r3/8/8/8/8/8/4B3/4K3 w - - 0 1");
    expect(pseudoMoves(pos, require_sq("e2")).length).toBeGreaterThan(0);
    expect(legalMovesFrom(pos, require_sq("e2")).length).toBe(0);
  });
});
