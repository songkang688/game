/**
 * 花园国际象棋 · FIDE 关键规则。
 *
 * 走法本身在 moves.test.ts 里体检过了，这一份专管「规则条款」：
 * 王车易位（含四种走不成的情形）、吃过路兵（含只在下一手有效）、
 * 将杀 / 逼和 / 50 回合 / 三次重复 / 子力不足，以及认输与超时。
 */
import { describe, expect, it } from "vitest";
import { BLACK, WHITE, fromFen, parseSquare, squareName, startPosition, toFen } from "./board";
import { findMove, fromSan, legalMoves, makeMove, toSan } from "./moves";
import {
  FIFTY_MOVE_PLIES,
  REPETITION_LIMIT,
  canCastle,
  castlingRights,
  createGame,
  epSquare,
  flagFall,
  gameStatus,
  halfmoveClock,
  insufficientMaterial,
  moveList,
  playMove,
  repetitionCount,
  resign,
  status,
} from "./rules";

/** 把一串 SAN 依次走完，走不出来就直接抛错（测试里好定位） */
function playLine(fen: string | undefined, sans: string[]) {
  const game = createGame(fen);
  for (const san of sans) {
    const move = fromSan(game.pos, san);
    if (!move) throw new Error(`「${san}」在 ${toFen(game.pos)} 里不是合法走法`);
    expect(playMove(game, move)).toBe(true);
  }
  return game;
}

/** 某个局面里全部合法走法的 SAN */
function sansOf(fen: string): string[] {
  const pos = fromFen(fen);
  return legalMoves(pos).map((m) => toSan(m, pos));
}

describe("王车易位", () => {
  const READY = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";

  it("两边都够条件时长短易位都能走", () => {
    const sans = sansOf(READY);
    expect(sans).toContain("O-O");
    expect(sans).toContain("O-O-O");
    expect(canCastle(fromFen(READY), "king")).toBe(true);
    expect(canCastle(fromFen(READY), "queen")).toBe(true);
  });

  it("短易位王到 g1、车跳到 f1；长易位王到 c1、车跳到 d1", () => {
    const pos = fromFen(READY);
    const short = makeMove(pos, fromSan(pos, "O-O")!);
    expect(short.board[parseSquare("g1")]).toBe(6);
    expect(short.board[parseSquare("f1")]).toBe(4);
    expect(short.board[parseSquare("e1")]).toBe(0);
    expect(short.board[parseSquare("h1")]).toBe(0);

    const long = makeMove(pos, fromSan(pos, "O-O-O")!);
    expect(long.board[parseSquare("c1")]).toBe(6);
    expect(long.board[parseSquare("d1")]).toBe(4);
    expect(long.board[parseSquare("a1")]).toBe(0);
  });

  it("走不成之一：王动过一次，两边的权就都没了", () => {
    const pos = fromFen(READY);
    const after = makeMove(pos, findMove(pos, parseSquare("e1"), parseSquare("e2"))!);
    expect(castlingRights(after)).toEqual([]);
    const back = makeMove(
      makeMove(after, findMove(after, parseSquare("e8"), parseSquare("d8"))!),
      findMove(makeMove(after, findMove(after, parseSquare("e8"), parseSquare("d8"))!), parseSquare("e2"), parseSquare("e1"))!
    );
    // 王走回原位也补不回来
    expect(sansOf(toFen(makeMove(back, findMove(back, parseSquare("d8"), parseSquare("e8"))!)))).not.toContain("O-O");
  });

  it("走不成之二：那一侧的车动过，只丢那一侧的权", () => {
    const pos = fromFen(READY);
    const after = makeMove(pos, findMove(pos, parseSquare("h1"), parseSquare("h2"))!);
    expect(castlingRights(after)).toEqual(["wq"]);
    const black = makeMove(after, findMove(after, parseSquare("e8"), parseSquare("f8"))!);
    const sans = legalMoves(black).map((m) => toSan(m, black));
    expect(sans).not.toContain("O-O");
    expect(sans).toContain("O-O-O");
  });

  it("走不成之三：王和车中间还站着子", () => {
    const sans = sansOf("4k3/8/8/8/8/8/8/R2QK1NR w KQ - 0 1");
    expect(sans).not.toContain("O-O");
    expect(sans).not.toContain("O-O-O");
  });

  it("走不成之四：起点、经过格、落点只要有一格被照着就不许易位", () => {
    // f8 的黑车管着 f1（经过格）
    const passing = sansOf("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(passing).not.toContain("O-O");
    expect(passing).toContain("O-O-O");
    // g8 的黑车管着 g1（落点）
    const landing = sansOf("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(landing).not.toContain("O-O");
    expect(landing).toContain("O-O-O");
    // e8 的黑车正在将军（起点被照着）
    const checked = sansOf("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(checked).not.toContain("O-O");
    expect(checked).not.toContain("O-O-O");
  });

  it("长易位经过的 b1 被照着不要紧，王又不走那一格", () => {
    // b8 的黑车管着 b1，但王只经过 d1、落在 c1
    const sans = sansOf("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(sans).toContain("O-O-O");
  });

  it("车被吃掉也带走那一侧的易位权", () => {
    const pos = fromFen("4k3/8/8/8/8/8/6b1/R3K2R b KQ - 0 1");
    const take = findMove(pos, parseSquare("g2"), parseSquare("h1"))!;
    expect(take.captured).toBe(4);
    const after = makeMove(pos, take);
    expect(castlingRights(after)).toEqual(["wq"]);
    expect(legalMoves(after).map((m) => toSan(m, after))).not.toContain("O-O");
  });

  it("黑方也一样能易位，记谱同样写 O-O", () => {
    const sans = sansOf("r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1");
    expect(sans).toContain("O-O");
    expect(sans).toContain("O-O-O");
  });
});

describe("吃过路兵", () => {
  it("兵首步冲两格才会留下过路格，别的走法都不会", () => {
    const start = startPosition();
    const jump = makeMove(start, fromSan(start, "e4")!);
    expect(squareName(epSquare(jump))).toBe("e3");
    const single = makeMove(start, fromSan(start, "e3")!);
    expect(epSquare(single)).toBe(-1);
    const knight = makeMove(start, fromSan(start, "Nf3")!);
    expect(epSquare(knight)).toBe(-1);
  });

  it("吃过路兵落在空格上，被吃的兵是从它自己那一格拿走的", () => {
    const pos = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const ep = fromSan(pos, "exd6")!;
    expect(ep.flag).toBe("e");
    const next = makeMove(pos, ep);
    expect(next.board[parseSquare("d6")]).toBe(1);
    expect(next.board[parseSquare("d5")]).toBe(0);
    expect(next.board[parseSquare("e5")]).toBe(0);
  });

  it("过路兵只在下一手有效，隔一手就过期了", () => {
    const pos = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(sansOf(toFen(pos))).toContain("exd6");
    // 白方改走王，机会立刻作废
    const after = makeMove(pos, findMove(pos, parseSquare("e1"), parseSquare("d1"))!);
    expect(epSquare(after)).toBe(-1);
    const back = makeMove(after, findMove(after, parseSquare("e8"), parseSquare("d8"))!);
    expect(epSquare(back)).toBe(-1);
    expect(legalMoves(back).map((m) => toSan(m, back))).not.toContain("exd6");
  });

  it("吃过路兵会让自己的王暴露在横线上时，这一手不合法", () => {
    // 走完 e5 和 d5 两个兵一起离开第 5 横线，h5 的黑车就照到 a5 的白王了
    const pos = fromFen("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
    const sans = legalMoves(pos).map((m) => toSan(m, pos));
    expect(sans).not.toContain("exd6");
  });

  it("黑方的过路兵同样成立", () => {
    const pos = fromFen("4k3/8/8/8/2pP4/8/8/4K3 b - d3 0 1");
    const ep = fromSan(pos, "cxd3")!;
    expect(ep.flag).toBe("e");
    const next = makeMove(pos, ep);
    expect(next.board[parseSquare("d4")]).toBe(0);
    expect(next.board[parseSquare("d3")]).toBe(-1);
  });
});

describe("将杀与逼和", () => {
  it("最短的一盘棋：四个半回合就将杀", () => {
    const game = playLine(undefined, ["f3", "e5", "g4", "Qh4"]);
    const st = gameStatus(game);
    expect(st.kind).toBe("checkmate");
    expect(st.winner).toBe(BLACK);
    expect(st.over).toBe(true);
    expect(game.history[game.history.length - 1].san).toBe("Qh4#");
  });

  it("将杀之后再想走一手也走不动了", () => {
    const game = playLine(undefined, ["f3", "e5", "g4", "Qh4"]);
    const ghost = findMove(game.pos, parseSquare("d2"), parseSquare("d4"));
    expect(ghost === null || playMove(game, ghost) === false).toBe(true);
    expect(game.history).toHaveLength(4);
  });

  it("逼和：一步都走不了，但也没被将，算和棋", () => {
    const st = status(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"));
    expect(st.kind).toBe("stalemate");
    expect(st.winner).toBe(0);
    expect(st.over).toBe(true);
  });

  it("被将但还有棋走，只是 check，局还没完", () => {
    const st = status(fromFen("4r2k/8/8/8/8/8/8/4K3 w - - 0 1"));
    expect(st.kind).toBe("check");
    expect(st.over).toBe(false);
    expect(st.winner).toBeNull();
  });

  it("什么都没发生的时候就是 ongoing", () => {
    const st = status(startPosition());
    expect(st.kind).toBe("ongoing");
    expect(st.over).toBe(false);
  });
});

describe("50 回合", () => {
  it("吃子或者动兵就把计数清零，别的走法一手加一", () => {
    const start = startPosition();
    expect(halfmoveClock(start)).toBe(0);
    const knight = makeMove(start, fromSan(start, "Nf3")!);
    expect(halfmoveClock(knight)).toBe(1);
    const pawn = makeMove(knight, fromSan(knight, "d5")!);
    expect(halfmoveClock(pawn)).toBe(0);
  });

  it("数满 100 个半回合就判和", () => {
    expect(FIFTY_MOVE_PLIES).toBe(100);
    const pos = fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 60");
    expect(status(pos).kind).not.toBe("fifty");
    const next = makeMove(pos, findMove(pos, parseSquare("a1"), parseSquare("a4"))!);
    expect(halfmoveClock(next)).toBe(100);
    const st = status(next);
    expect(st.kind).toBe("fifty");
    expect(st.winner).toBe(0);
  });

  it("差一手的时候吃了子，计数归零，和棋就不成立了", () => {
    const pos = fromFen("4k3/8/8/8/r7/8/8/R3K3 w - - 99 60");
    const take = fromSan(pos, "Rxa4")!;
    const next = makeMove(pos, take);
    expect(halfmoveClock(next)).toBe(0);
    expect(status(next).kind).not.toBe("fifty");
  });
});

describe("三次重复", () => {
  it("两匹马来回跳，同一个局面第三次出现就判和", () => {
    expect(REPETITION_LIMIT).toBe(3);
    const fen = "4k1n1/8/8/8/8/8/8/4K1N1 w - - 0 1";
    const game = playLine(fen, ["Nf3", "Nf6", "Ng1", "Ng8"]);
    expect(repetitionCount(game)).toBe(2);
    expect(gameStatus(game).kind).not.toBe("repetition");
    const move = fromSan(game.pos, "Nf3")!;
    playMove(game, move);
    playMove(game, fromSan(game.pos, "Nf6")!);
    playMove(game, fromSan(game.pos, "Ng1")!);
    playMove(game, fromSan(game.pos, "Ng8")!);
    expect(repetitionCount(game)).toBe(3);
    const st = gameStatus(game);
    expect(st.kind).toBe("repetition");
    expect(st.winner).toBe(0);
  });

  it("摆法一样但易位权变了，不算同一个局面", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    // 车出去再回来，摆法复原，可易位权已经没了
    const game = playLine(fen, ["Rg1", "Rg8", "Rh1", "Rh8"]);
    expect(repetitionCount(game)).toBe(1);
    // 只有两只边线车动过，所以丢的是两边的短易位权
    expect(castlingRights(game.pos)).toEqual(["wq", "bq"]);
  });
});

describe("子力不足", () => {
  const draws = [
    ["王对王", "4k3/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["王象对王", "4k3/8/8/8/8/8/8/4KB2 w - - 0 1"],
    ["王马对王", "4k3/8/8/8/8/8/8/4KN2 w - - 0 1"],
    ["王对王马", "4kn2/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["双方各一个同色格的象", "4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1"],
  ] as const;

  for (const [name, fen] of draws) {
    it(`${name}：谁也杀不掉谁，判和`, () => {
      expect(insufficientMaterial(fromFen(fen))).toBe(true);
      const st = status(fromFen(fen));
      expect(st.kind).toBe("material");
      expect(st.winner).toBe(0);
    });
  }

  const alive = [
    ["还有兵", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"],
    ["还有车", "4k3/8/8/8/8/8/8/4KR2 w - - 0 1"],
    ["还有后", "4k3/8/8/8/8/8/8/4KQ2 w - - 0 1"],
    ["两匹马", "4k3/8/8/8/8/8/8/2N1KN2 w - - 0 1"],
    ["异色格双象", "2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1"],
  ] as const;

  for (const [name, fen] of alive) {
    it(`${name}：子力还够，不能判和`, () => {
      expect(insufficientMaterial(fromFen(fen))).toBe(false);
      expect(status(fromFen(fen)).kind).not.toBe("material");
    });
  }
});

describe("认输与超时", () => {
  it("认输就是对方赢，文案不批评认输的一方", () => {
    const game = createGame();
    const st = resign(game, WHITE);
    expect(st.kind).toBe("resign");
    expect(st.winner).toBe(BLACK);
    expect(st.over).toBe(true);
    for (const bad of ["笨", "废物", "没用", "输光"]) expect(st.text.includes(bad)).toBe(false);
    // 认输之后这一局就锁住了
    expect(playMove(game, fromSan(game.pos, "e4")!)).toBe(false);
  });

  it("超时判负；但对方子力不够将杀时按和棋算", () => {
    const rich = createGame("4k3/8/8/8/8/8/8/4KQ2 b - - 0 1");
    const lost = flagFall(rich, BLACK);
    expect(lost.kind).toBe("timeout");
    expect(lost.winner).toBe(WHITE);

    const bare = createGame("4k3/8/8/8/8/8/8/4KN2 b - - 0 1");
    const drawn = flagFall(bare, BLACK);
    expect(drawn.kind).toBe("material");
    expect(drawn.winner).toBe(0);
  });
});

describe("一整局的账本", () => {
  it("每一手都记下 SAN 与中文说法，重复计数跟着走", () => {
    const game = playLine(undefined, ["e4", "e5", "Nf3", "Nc6"]);
    expect(game.history.map((h) => h.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(game.history[2].cn).toContain("马");
    expect(moveList(game)).toEqual(["1. e4 e5", "2. Nf3 Nc6"]);
    expect(game.counts.size).toBe(5);
  });

  it("不合法的走法一律拒收，账本一点不动", () => {
    const game = createGame();
    const fake = { from: parseSquare("e2"), to: parseSquare("e5"), piece: 1, captured: 0, promo: 0, flag: "n" as const };
    expect(playMove(game, fake)).toBe(false);
    expect(game.history).toHaveLength(0);
    expect(toFen(game.pos)).toBe(toFen(startPosition()));
  });

  it("从题面开局的对局记得住起始 FEN，随时能重摆", () => {
    const fen = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    const game = createGame(fen);
    expect(game.startFen).toBe(fen);
    playMove(game, fromSan(game.pos, "Ra8")!);
    expect(gameStatus(game).kind).toBe("checkmate");
    expect(gameStatus(game).winner).toBe(WHITE);
  });
});
