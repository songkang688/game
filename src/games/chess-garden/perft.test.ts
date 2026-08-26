/**
 * 花园国际象棋 · perft 体检。
 *
 * perft 就是「深度 N 一共能走出多少条不同的着法序列」。这些数字是国际象棋走法生成的
 * 公认标定值：只要易位、吃过路兵、升变、别自将里有任何一条写错，节点数立刻对不上。
 * 这是本款「规则一条都不少」最硬的一道证据。
 */
import { describe, expect, it } from "vitest";
import { fromFen, startPosition } from "./board";
import { perft } from "./moves";

describe("perft · 起始局面", () => {
  it("深度 1 有 20 条走法", () => {
    expect(perft(startPosition(), 1)).toBe(20);
  });

  it("深度 2 有 400 条", () => {
    expect(perft(startPosition(), 2)).toBe(400);
  });

  it("深度 3 有 8902 条", () => {
    expect(perft(startPosition(), 3)).toBe(8902);
  });

  it("深度 4 有 197281 条", () => {
    expect(perft(startPosition(), 4)).toBe(197281);
  });
});

describe("perft · 复杂局面", () => {
  // 这一盘中局里易位、吃过路兵、升变、牵制全都同时存在
  const BUSY = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
  // 只有兵、车、王的窄局面，专门考过路兵与升变
  const PAWNS = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
  // 白方被牵制、黑方有升变机会
  const PIN = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
  // 双方都还留着两边易位权的中局
  const MIX = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";

  it("繁忙中局深度 1 / 2 / 3", () => {
    const pos = fromFen(BUSY);
    expect(perft(pos, 1)).toBe(48);
    expect(perft(pos, 2)).toBe(2039);
    expect(perft(pos, 3)).toBe(97862);
  });

  it("兵车残局深度 1–4（过路兵与升变全在里面）", () => {
    const pos = fromFen(PAWNS);
    expect(perft(pos, 1)).toBe(14);
    expect(perft(pos, 2)).toBe(191);
    expect(perft(pos, 3)).toBe(2812);
    expect(perft(pos, 4)).toBe(43238);
  });

  it("牵制与升变局面深度 1–3", () => {
    const pos = fromFen(PIN);
    expect(perft(pos, 1)).toBe(6);
    expect(perft(pos, 2)).toBe(264);
    expect(perft(pos, 3)).toBe(9467);
  });

  it("双方留着易位权的中局深度 1–3", () => {
    const pos = fromFen(MIX);
    expect(perft(pos, 1)).toBe(44);
    expect(perft(pos, 2)).toBe(1486);
    expect(perft(pos, 3)).toBe(62379);
  });
});
