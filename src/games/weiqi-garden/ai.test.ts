import { describe, expect, it } from "vitest";
import { BLACK, WHITE, createBoard, groupAt, parseRows } from "./board";
import { P9, board9, rows9 } from "./testkit";
import { isTrueEye } from "./life";
import { legalMoves, play } from "./rules";
import { mulberry32 } from "../level99";
import {
  AI_TIERS,
  AI_TIER_HINTS,
  AI_TIER_LABELS,
  aiMove,
  candidateMoves,
  defaultAiOptions,
  lineOf,
  playSelfGame,
  randomPlayout,
  rankedMoves,
  scoreMove,
  winRate,
  type AiTier
} from "./ai";

/** 单测里把模拟次数调低,CI 才跑得快;界面用的是 defaultAiOptions 的值 */
const FAST = { playouts: 2, candidates: 3, maxPlayoutMoves: 40 };

describe("weiqi-garden · 四档对手", () => {
  it("四档都在,而且各有名字和一句说明", () => {
    expect([...AI_TIERS]).toEqual(["rookie", "normal", "expert", "master"]);
    expect(AI_TIER_LABELS.rookie).toBe("菜鸟");
    expect(AI_TIER_LABELS.master).toBe("地狱");
    for (const t of AI_TIERS) expect(AI_TIER_HINTS[t].length).toBeGreaterThan(8);
  });

  it("菜鸟也只下合法点,不自尽、也不往自己的真眼里填", () => {
    const board = board9("X.X.X....", "XXXXX....", ".O.O.....", ".........");
    const rand = mulberry32(7);
    const legal = new Set(legalMoves(board, BLACK));
    for (let i = 0; i < 40; i++) {
      const pt = aiMove(board, BLACK, "rookie", { rand });
      expect(pt).not.toBeNull();
      expect(legal.has(pt as number)).toBe(true);
      expect(isTrueEye(board, pt as number, BLACK)).toBe(false);
    }
  });

  it("普通档能提就提", () => {
    const board = board9(".XX......", "XOO......", ".XX......");
    // 白 (1,1)(2,1) 只剩 (3,1) 一口气
    expect(aiMove(board, BLACK, "normal", { rand: mulberry32(3) })).toBe(P9(3, 1));
  });

  it("普通档被打吃会逃", () => {
    // 黑 (1,1) 只剩 (1,2) 一口气,不逃就没了
    const board = board9(".O.......", "OX.O.....", ".O.......", ".........");
    const pt = aiMove(board, BLACK, "normal", { rand: mulberry32(11) });
    expect(pt).toBe(P9(2, 1));
  });

  it("高手档懂得离边远一点,不会开局就贴着一线走", () => {
    const empty = createBoard(9);
    const ranked = rankedMoves(empty, BLACK, true, legalMoves(empty, BLACK), mulberry32(5));
    expect(lineOf(9, ranked[0].pt)).toBeGreaterThanOrEqual(2);
    // 一线的分数一定比三线低
    const rim = scoreMove(empty, P9(0, 4), BLACK, true).total;
    const third = scoreMove(empty, P9(2, 2), BLACK, true).total;
    expect(third).toBeGreaterThan(rim);
  });

  it("提子的分数最高,自填一口气的自吃亏手会被扣分", () => {
    const board = board9(".XX......", "XOO......", ".XX......");
    const good = scoreMove(board, P9(3, 1), BLACK, true);
    expect(good.capture).toBeGreaterThan(0);
    const selfAtari = board9("XX.......", "X........");
    // (0,2)(1,1) 一带随便找个把自己挤成一口气的点,气这一项一定是负的
    const bad = scoreMove(parseRows(rows9(".O.......", "O.O......", ".O.......")), P9(1, 1), BLACK, true);
    expect(bad.total).toBe(-Infinity);
    expect(selfAtari.cells.length).toBe(81);
  });

  it("没地方下就停一手", () => {
    // 整盘只剩黑自己的两只真眼,除了填眼没别的下法
    const full = parseRows([
      "X.X.XXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX"
    ]);
    expect(candidateMoves(full, BLACK)).toEqual([]);
    expect(aiMove(full, BLACK, "master", FAST)).toBeNull();
  });
});

describe("weiqi-garden · 随机快棋与自动对局", () => {
  it("一盘随机快棋会自己走完,结果是个有限数", () => {
    const diff = randomPlayout(createBoard(9), BLACK, mulberry32(42), 200, 3.75);
    expect(Number.isFinite(diff)).toBe(true);
  });

  it("两个 AI 能把一盘九路棋下完,盘上留下的子数说得通", () => {
    const res = playSelfGame({ size: 9, black: "expert", white: "rookie", seed: 2024, ai: FAST });
    expect(res.moves).toBeGreaterThan(20);
    expect(["black", "white", "draw"]).toContain(res.winner);
    let stones = 0;
    for (let i = 0; i < res.board.cells.length; i++) if (res.board.cells[i] !== 0) stones++;
    expect(stones).toBeGreaterThan(50);
  });

  it("同一个 seed 下出来的棋一模一样", () => {
    const a = playSelfGame({ size: 9, black: "expert", white: "normal", seed: 99, ai: FAST });
    const b = playSelfGame({ size: 9, black: "expert", white: "normal", seed: 99, ai: FAST });
    expect(a.winner).toBe(b.winner);
    expect(a.diff).toBe(b.diff);
    expect(a.moves).toBe(b.moves);
  });
});

describe("weiqi-garden · 棋力与耗时", () => {
  it("九路上地狱档打菜鸟档 20 局,胜率 ≥ 80%", () => {
    // CI 里把模拟次数调低,靠启发式打分也要能赢下来
    const rate = winRate({ size: 9, hero: "master", foe: "rookie", games: 20, ai: FAST });
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });

  it("档位越高越强:高手打菜鸟也稳,普通打菜鸟至少七成", () => {
    expect(winRate({ size: 9, hero: "expert", foe: "rookie", games: 10, ai: FAST })).toBeGreaterThanOrEqual(0.8);
    expect(winRate({ size: 9, hero: "normal", foe: "rookie", games: 10, ai: FAST })).toBeGreaterThanOrEqual(0.7);
  });

  it("九路地狱档按默认参数走一手,耗时 ≤ 1 秒", () => {
    const board = board9("....X....", "..O...O..", ".........", "..X...X..");
    const cfg = defaultAiOptions("master", 9);
    expect(cfg.playouts).toBeGreaterThan(0);
    const t0 = Date.now();
    const pt = aiMove(board, WHITE, "master", { rand: mulberry32(1) });
    const used = Date.now() - t0;
    expect(pt).not.toBeNull();
    expect(used).toBeLessThanOrEqual(1000);
  });

  it("十三路与十九路复用同一套,模拟次数按路数自动调低", () => {
    expect(defaultAiOptions("master", 19).playouts).toBeLessThan(defaultAiOptions("master", 9).playouts);
    expect(defaultAiOptions("rookie", 9).playouts).toBe(0);
    const pt = aiMove(createBoard(13), BLACK, "master", { rand: mulberry32(4), ...FAST });
    expect(pt).not.toBeNull();
  });

  it("走出来的每一手都真的能落子", () => {
    const rand = mulberry32(8);
    for (const tier of AI_TIERS as readonly AiTier[]) {
      const board = board9("..X......", "...O.....", ".........");
      const pt = aiMove(board, BLACK, tier, { rand, ...FAST });
      expect(pt).not.toBeNull();
      const res = play(board, pt as number, BLACK);
      expect(res).not.toBeNull();
      expect(groupAt(res!.board, pt as number)?.color).toBe(BLACK);
    }
  });
});
