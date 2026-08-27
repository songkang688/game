/**
 * 花园国际象棋 · 六种棋子的走法与记谱。
 *
 * 每一条都对着规格第五节写：走法、马跳过子、兵首步两格与斜吃、不许走出自将、
 * 升变四选一、SAN 记谱与消歧。
 */
import { describe, expect, it } from "vitest";
import {
  BISHOP,
  BLACK,
  KNIGHT,
  QUEEN,
  ROOK,
  WHITE,
  fromFen,
  isLightSquare,
  parseSquare,
  squareName,
  startPosition,
  toFen,
  zobrist,
} from "./board";
import {
  findMove,
  fromSan,
  inCheck,
  isSquareAttacked,
  legalMoves,
  makeMove,
  moveKey,
  promote,
  pseudoMoves,
  toChinese,
  toSan,
} from "./moves";

/** 从某一格出发的全部合法落点，按格名排序，方便一眼比对 */
function targets(fen: string, from: string): string[] {
  const pos = fromFen(fen);
  return legalMoves(pos, parseSquare(from))
    .map((m) => squareName(m.to))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
}

describe("格子与 FEN", () => {
  it("格名和下标能来回换算", () => {
    expect(parseSquare("a1")).toBe(0);
    expect(parseSquare("h1")).toBe(7);
    expect(parseSquare("a8")).toBe(56);
    expect(parseSquare("h8")).toBe(63);
    expect(squareName(27)).toBe("d4");
    expect(parseSquare("zz")).toBe(-1);
  });

  it("a1 是深色格，h1 是浅色格", () => {
    expect(isLightSquare(parseSquare("a1"))).toBe(false);
    expect(isLightSquare(parseSquare("h1"))).toBe(true);
  });

  it("开局 FEN 读进来再写回去一模一样", () => {
    expect(toFen(startPosition())).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });

  it("FEN 写坏了会抛错，坏数据进不到关卡里", () => {
    expect(() => fromFen("8/8/8 w - - 0 1")).toThrow();
    expect(() => fromFen("xxxxxxxx/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
  });
});

describe("六种棋子各走各的", () => {
  it("王：八个方向各一格", () => {
    expect(targets("8/8/8/3K4/8/8/8/7k w - - 0 1", "d5")).toEqual([
      "c4",
      "c5",
      "c6",
      "d4",
      "d6",
      "e4",
      "e5",
      "e6",
    ]);
  });

  it("后：直线加斜线，一路走到底", () => {
    const list = targets("8/8/8/3Q4/8/8/8/K6k w - - 0 1", "d5");
    expect(list).toContain("d8");
    expect(list).toContain("h5");
    expect(list).toContain("a2");
    expect(list).toContain("g8");
    expect(list.length).toBe(27);
  });

  it("车：只走直线，被挡住就停下", () => {
    // d4 的白兵挡住了车往上走
    expect(targets("K6k/8/8/8/3P4/8/8/3R4 w - - 0 1", "d1")).toEqual([
      "a1",
      "b1",
      "c1",
      "d2",
      "d3",
      "e1",
      "f1",
      "g1",
      "h1",
    ]);
  });

  it("象：只走斜线，一辈子待在同一种颜色的格子上", () => {
    const list = targets("8/8/8/3B4/8/8/8/K6k w - - 0 1", "d5");
    for (const name of list) expect(isLightSquare(parseSquare(name))).toBe(isLightSquare(parseSquare("d5")));
    expect(list).toContain("a8");
    expect(list).toContain("h1");
  });

  it("马：走日字，而且能跳过挡路的子", () => {
    // 马被一圈自己人围死，照样跳得出去
    const boxed = "8/8/8/2PPP3/2PNP3/2PPP3/8/K6k w - - 0 1";
    expect(targets(boxed, "d4")).toEqual(["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"]);
  });

  it("兵：首步可以走两格，之后一次一格", () => {
    expect(targets("8/8/8/8/8/8/4P3/K6k w - - 0 1", "e2")).toEqual(["e3", "e4"]);
    expect(targets("8/8/8/8/8/4P3/8/K6k w - - 0 1", "e3")).toEqual(["e4"]);
  });

  it("兵：斜着吃子，正前方有子就走不动", () => {
    // d5 有黑子可以斜吃，e5 挡着不能直走
    expect(targets("8/8/8/3pp3/4P3/8/8/K6k w - - 0 1", "e4")).toEqual(["d5"]);
  });

  it("兵首步两格要求两格都空", () => {
    expect(targets("8/8/8/8/8/4n3/4P3/K6k w - - 0 1", "e2")).toEqual([]);
    expect(targets("8/8/8/8/4n3/8/4P3/K6k w - - 0 1", "e2")).toEqual(["e3"]);
  });
});

describe("不许把自己的王送上去", () => {
  it("被牵制的子不能离开那条线", () => {
    // e2 的马被 e8 的黑车牵住，一动白王就挨将
    const fen = "4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1";
    expect(legalMoves(fromFen(fen), parseSquare("e2"))).toEqual([]);
  });

  it("被将的时候可以挪王，也可以拿子挡在中间", () => {
    // 黑车 e8 顺着 e 线将军，白车 h2 横过去 e2 正好挡住
    const pos = fromFen("1k2r3/8/8/8/8/8/7R/4K3 w - - 0 1");
    expect(inCheck(pos, WHITE)).toBe(true);
    const sans = legalMoves(pos).map((m) => toSan(m, pos)).sort();
    expect(sans).toEqual(["Kd1", "Kd2", "Kf1", "Kf2", "Re2"].sort());
  });

  it("将军的子够得着就直接吃掉它", () => {
    // 黑车 e2 贴脸将军，白王和白车都能吃它
    const pos = fromFen("4k3/8/8/8/8/8/4r2R/4K3 w - - 0 1");
    expect(inCheck(pos, WHITE)).toBe(true);
    const sans = legalMoves(pos).map((m) => toSan(m, pos)).sort();
    // 白车吃完顺着 e 线回敬一将
    expect(sans).toEqual(["Kd1", "Kf1", "Kxe2", "Rxe2+"].sort());
  });

  it("王不能走到被对方照着的格子上", () => {
    // 黑车管着 d 线和 f 线，白王只能上下走
    expect(targets("3r1r2/8/7k/8/8/8/8/4K3 w - - 0 1", "e1")).toEqual(["e2"]);
  });

  it("两个王永远不会挨在一起", () => {
    expect(targets("8/8/8/3k4/8/3K4/8/8 w - - 0 1", "d3")).toEqual(["c2", "c3", "d2", "e2", "e3"]);
  });
});

describe("升变", () => {
  it("兵走到底线一次给出后 / 车 / 象 / 马四个选择", () => {
    const pos = fromFen("8/4P3/8/8/8/8/8/K6k w - - 0 1");
    const list = legalMoves(pos, parseSquare("e7"));
    expect(list.length).toBe(4);
    expect(list.map((m) => m.promo).sort()).toEqual([KNIGHT, BISHOP, ROOK, QUEEN].sort());
    for (const m of list) expect(squareName(m.to)).toBe("e8");
  });

  it("斜吃着升变也是四选一", () => {
    const pos = fromFen("3r4/4P3/8/8/8/8/8/K6k w - - 0 1");
    const caps = legalMoves(pos, parseSquare("e7")).filter((m) => m.to === parseSquare("d8"));
    expect(caps.length).toBe(4);
    expect(toSan(caps.find((m) => m.promo === QUEEN)!, pos)).toBe("exd8=Q");
    expect(toSan(caps.find((m) => m.promo === KNIGHT)!, pos)).toBe("exd8=N");
  });

  it("promote() 能把一条升变走法换成别的兵种", () => {
    const pos = fromFen("8/4P3/8/8/8/8/8/K6k w - - 0 1");
    const queen = findMove(pos, parseSquare("e7"), parseSquare("e8"))!;
    expect(queen.promo).toBe(QUEEN);
    const knight = promote(queen, KNIGHT);
    expect(knight.promo).toBe(KNIGHT);
    expect(makeMove(pos, knight).board[parseSquare("e8")]).toBe(KNIGHT);
    // 不是升变的走法，promote 原样返回
    const king = findMove(pos, parseSquare("a1"), parseSquare("a2"))!;
    expect(promote(king, QUEEN)).toBe(king);
  });

  it("findMove 默认给后，也可以点名要别的", () => {
    const pos = fromFen("8/4P3/8/8/8/8/8/K6k w - - 0 1");
    expect(findMove(pos, parseSquare("e7"), parseSquare("e8"))!.promo).toBe(QUEEN);
    expect(findMove(pos, parseSquare("e7"), parseSquare("e8"), ROOK)!.promo).toBe(ROOK);
    expect(findMove(pos, parseSquare("e7"), parseSquare("a4"))).toBeNull();
  });
});

describe("被攻击判定", () => {
  it("兵、马、车、象、后、王各自照到的格子都认得出来", () => {
    const pos = fromFen("8/8/2n5/8/3P4/8/8/K6k w - - 0 1");
    expect(isSquareAttacked(pos, parseSquare("e5"), WHITE)).toBe(true);
    expect(isSquareAttacked(pos, parseSquare("d5"), WHITE)).toBe(false);
    expect(isSquareAttacked(pos, parseSquare("d4"), BLACK)).toBe(true);
    expect(isSquareAttacked(pos, parseSquare("a2"), WHITE)).toBe(true);
  });

  it("自己人挡在那一格也算被照着（易位安全检查要用这条）", () => {
    const pos = fromFen("K7/8/8/8/8/8/4P3/4R2k w - - 0 1");
    expect(isSquareAttacked(pos, parseSquare("e2"), WHITE)).toBe(true);
  });
});

describe("记谱", () => {
  it("普通走法、吃子、将军、将杀各写各的", () => {
    const start = startPosition();
    const e4 = fromSan(start, "e4")!;
    expect(toSan(e4, start)).toBe("e4");
    const after = makeMove(start, e4);
    expect(toSan(fromSan(after, "e5")!, after)).toBe("e5");
    const mate = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(toSan(fromSan(mate, "Ra8")!, mate)).toBe("Ra8#");
  });

  it("两个同种子能走到同一格时会自动加上出发线消歧", () => {
    const pos = fromFen("8/8/3k4/8/3K4/8/8/R6R w - - 0 1");
    const sans = legalMoves(pos).map((m) => toSan(m, pos));
    expect(sans).toContain("Rac1");
    expect(sans).toContain("Rhc1");
    // 只有一个车够得着的格子不写出发线
    expect(sans).toContain("Ra8");
    expect(sans).toContain("Rh8");
  });

  it("两个车在同一条竖线上时改用横线号消歧", () => {
    const pos = fromFen("R7/8/8/4k3/8/8/8/R6K w - - 0 1");
    const sans = legalMoves(pos).map((m) => toSan(m, pos));
    expect(sans).toContain("R8a4");
    expect(sans).toContain("R1a4");
    // 横竖都不重复的落点仍然只写一个字母
    expect(sans).toContain("Rb8");
  });

  it("易位写成 O-O 与 O-O-O", () => {
    const pos = fromFen("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    const sans = legalMoves(pos).map((m) => toSan(m, pos));
    expect(sans).toContain("O-O");
    expect(sans).toContain("O-O-O");
  });

  it("中文记谱看得懂：谁走到哪儿、吃没吃子、将没将军", () => {
    const pos = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(toChinese(fromSan(pos, "Ra8")!, pos)).toContain("将杀");
    const cap = fromFen("4r1k1/8/8/8/8/8/8/4R2K w - - 0 1");
    const take = fromSan(cap, "Rxe8")!;
    expect(toChinese(take, cap)).toContain("去休息");
  });

  it("fromSan 认不出来就返回 null，不会瞎走", () => {
    expect(fromSan(startPosition(), "Qh5")).toBeNull();
    expect(fromSan(startPosition(), "e4")).not.toBeNull();
  });

  it("moveKey 是稳定的短标识", () => {
    const pos = fromFen("8/4P3/8/8/8/8/8/K6k w - - 0 1");
    expect(moveKey(findMove(pos, parseSquare("e7"), parseSquare("e8"), KNIGHT)!)).toBe("e7e8n");
    expect(moveKey(findMove(pos, parseSquare("a1"), parseSquare("a2"))!)).toBe("a1a2");
  });
});

describe("局面哈希", () => {
  it("同一个局面哈希一样，轮走方不同就不一样", () => {
    const a = fromFen("8/8/8/8/8/8/8/K6k w - - 0 1");
    const b = fromFen("8/8/8/8/8/8/8/K6k w - - 0 1");
    const c = fromFen("8/8/8/8/8/8/8/K6k b - - 0 1");
    expect(zobrist(a)).toBe(zobrist(b));
    expect(zobrist(a)).not.toBe(zobrist(c));
  });

  it("易位权和过路格也算进哈希里", () => {
    const withRights = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const without = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1");
    expect(zobrist(withRights)).not.toBe(zobrist(without));
    const withEp = fromFen("8/8/8/3pP3/8/8/8/K6k w - d6 0 1");
    const noEp = fromFen("8/8/8/3pP3/8/8/8/K6k w - - 0 1");
    expect(zobrist(withEp)).not.toBe(zobrist(noEp));
  });

  it("50 回合计数与回合号不影响哈希（它们不是局面的一部分）", () => {
    const a = fromFen("8/8/8/8/8/8/8/K6k w - - 0 1");
    const b = fromFen("8/8/8/8/8/8/8/K6k w - - 40 30");
    expect(zobrist(a)).toBe(zobrist(b));
  });
});

describe("伪合法与合法的区别", () => {
  it("伪合法会把「走完就挨将」的那些也算进来，合法走法把它们过滤掉", () => {
    const pos = fromFen("4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(pseudoMoves(pos, parseSquare("e2")).length).toBeGreaterThan(0);
    expect(legalMoves(pos, parseSquare("e2")).length).toBe(0);
  });

  it("开局双方各 20 条走法", () => {
    const start = startPosition();
    expect(legalMoves(start).length).toBe(20);
    const after = makeMove(start, fromSan(start, "e4")!);
    expect(legalMoves(after).length).toBe(20);
  });
});
