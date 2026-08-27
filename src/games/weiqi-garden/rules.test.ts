import { describe, expect, it } from "vitest";
import { BLACK, WHITE, parseRows, pointOf, positionHash } from "./board";
import { rows9 } from "./testkit";
import {
  ILLEGAL_TEXT,
  checkMove,
  createGame,
  isEyeLike,
  isLegal,
  koPoint,
  legalMoves,
  movesFor,
  passMove,
  play,
  playMove,
  undoMove,
  type GameState
} from "./rules";

const P = (x: number, y: number): number => pointOf(9, x, y);

/** 走一串手,任何一手非法就直接抛出来,免得测试悄悄跑偏 */
function run(state: GameState, pts: number[]): GameState {
  let cur = state;
  for (const pt of pts) {
    const res = playMove(cur, pt);
    if (!res.ok) throw new Error(`第 ${cur.moves.length + 1} 手 ${pt} 非法:${res.reason}`);
    cur = res.state;
  }
  return cur;
}

describe("weiqi-garden · 提子", () => {
  it("堵上最后一口气就能提掉单子", () => {
    const board = parseRows(rows9(".X.......", "XO.......", ".X......."));
    const res = play(board, P(2, 1), BLACK);
    expect(res).not.toBeNull();
    expect(res?.captured).toEqual([P(1, 1)]);
    expect(res?.board.cells[P(1, 1)]).toBe(0);
  });

  it("整块没气就整块一起提走", () => {
    const board = parseRows(rows9(".XXX.....", "XOOOX....", ".XX......"));
    const res = play(board, P(3, 2), BLACK);
    expect(res?.captured).toEqual([P(1, 1), P(2, 1), P(3, 1)]);
    expect(res?.captured).toHaveLength(3);
  });

  it("提子的顺序是「先放子 → 先提对方 → 再看自己」", () => {
    // (0,1) 四周全是白子,黑放进去本来一口气都没有;
    // 但这一手先把只剩一口气的白 (0,0) 提掉了,提完就有气,所以合法。
    const board = parseRows(rows9("OX.......", ".O.......", "OX......."));
    const res = play(board, P(0, 1), BLACK);
    expect(res?.captured).toEqual([P(0, 0)]);
    expect(res?.board.cells[P(0, 1)]).toBe(BLACK);
  });
});

describe("weiqi-garden · 自杀禁手", () => {
  it("放下去自己没气、又没提到对方,就是非法", () => {
    const board = parseRows(rows9(".O.......", "O.O......", ".O......."));
    expect(play(board, P(1, 1), BLACK)).toBeNull();
    const state = createGame({ size: 9, board, turn: BLACK });
    expect(checkMove(state, P(1, 1))).toBe("suicide");
    expect(isLegal(state, P(1, 1))).toBe(false);
  });

  it("放下去自己没气、但提到了对方,这一手算数", () => {
    const board = parseRows(rows9("OX.......", ".O.......", "OX......."));
    const state = createGame({ size: 9, board, turn: BLACK });
    expect(checkMove(state, P(0, 1))).toBeNull();
    expect(playMove(state, P(0, 1)).ok).toBe(true);
  });

  it("已经有子的点和棋盘外的点都下不了", () => {
    const board = parseRows(rows9("X........"));
    const state = createGame({ size: 9, board, turn: BLACK });
    expect(checkMove(state, P(0, 0))).toBe("occupied");
    expect(checkMove(state, 999)).toBe("outside");
    expect(play(board, -1, BLACK)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 劫
// ---------------------------------------------------------------------------

/** 最经典的劫形:黑走 (2,1) 提掉白 (1,1),自己也只剩一口气 */
const KO_ROWS = rows9(".XO......", "XO.O.....", ".XO......");

describe("weiqi-garden · 打劫", () => {
  it("提一子且自己成单只剩一口气,就是劫", () => {
    const board = parseRows(KO_ROWS);
    const res = play(board, P(2, 1), BLACK);
    expect(res?.captured).toEqual([P(1, 1)]);
    expect(koPoint(board, res!.board, P(2, 1), res!.captured)).toBe(P(1, 1));
  });

  it("提两子以上就不是劫", () => {
    const board = parseRows(rows9(".XXX.....", "XOOOX....", ".XX......"));
    const res = play(board, P(3, 2), BLACK);
    expect(res?.captured).toHaveLength(3);
    expect(koPoint(board, res!.board, P(3, 2), res!.captured)).toBeNull();
  });

  it("提完劫,对方立刻回提是非法的", () => {
    const start = createGame({ size: 9, board: parseRows(KO_ROWS), turn: BLACK });
    const after = run(start, [P(2, 1)]);
    expect(after.ko).toBe(P(1, 1));
    expect(checkMove(after, P(1, 1))).toBe("ko");
    expect(movesFor(after)).not.toContain(P(1, 1));
  });

  it("先在别处下一手,劫就解除了,可以回提", () => {
    const start = createGame({ size: 9, board: parseRows(KO_ROWS), turn: BLACK });
    const after = run(start, [P(2, 1), P(6, 6), P(7, 7)]);
    expect(after.ko).toBeNull();
    expect(after.turn).toBe(WHITE);
    const back = playMove(after, P(1, 1));
    expect(back.ok).toBe(true);
    expect(back.ok && back.captured).toEqual([P(2, 1)]);
  });

  it("停一手也能解劫", () => {
    const start = createGame({ size: 9, board: parseRows(KO_ROWS), turn: BLACK });
    const afterKo = run(start, [P(2, 1)]);
    const passed = passMove(afterKo);
    expect(passed.ko).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 位置超劫:三个劫排在一起,六手之后全盘会回到原样
// ---------------------------------------------------------------------------

/**
 * 三个劫:
 *  - 劫一(白子等着被黑提)在左上;
 *  - 劫二(黑子等着被白提)在右中;
 *  - 劫三(白子等着被黑提)在左下。
 * 黑提一 → 白提二 → 黑提三 → 白提回一 → 黑提回二 → 白提回三,
 * 最后那一手会让全盘回到开局的样子,必须被超劫挡下来。
 */
const TRIPLE_KO_ROWS = [
  ".XO......",
  "XO.O.....",
  ".XO......",
  "......OX.",
  ".....OX.X",
  "......OX.",
  ".XO......",
  "XO.O.....",
  ".XO......"
];

describe("weiqi-garden · 位置超劫与连环劫", () => {
  it("连环劫转一圈回到同一个盘面时,最后那一手被超劫挡下", () => {
    const board = parseRows(TRIPLE_KO_ROWS);
    const start = createGame({ size: 9, board, turn: BLACK });
    const opening = positionHash(board);
    // 前五手都是正常的提劫
    const five = run(start, [P(2, 1), P(7, 4), P(2, 7), P(1, 1), P(6, 4)]);
    expect(five.turn).toBe(WHITE);
    // 第六手会让全盘回到开局那一刻
    const replay = play(five.board, P(1, 7), WHITE);
    expect(replay).not.toBeNull();
    expect(positionHash(replay!.board)).toBe(opening);
    expect(checkMove(five, P(1, 7))).toBe("superko");
    expect(legalMoves(five.board, WHITE, five.ko, five.history)).not.toContain(P(1, 7));
  });

  it("超劫历史是「只看棋子摆位」的,开局盘面也在里面", () => {
    const board = parseRows(TRIPLE_KO_ROWS);
    const start = createGame({ size: 9, board, turn: BLACK });
    expect(start.history.has(positionHash(board))).toBe(true);
    expect(start.history.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 合法点、停手与终局
// ---------------------------------------------------------------------------

describe("weiqi-garden · 合法点与终局", () => {
  it("legalMoves 把自杀点筛掉了", () => {
    const board = parseRows(rows9(".O.......", "O.O......", ".O......."));
    expect(legalMoves(board, BLACK)).not.toContain(P(1, 1));
    expect(legalMoves(board, WHITE)).toContain(P(1, 1));
  });

  it("双方连着停两手就终局,中间插一手就重新数", () => {
    const start = createGame({ size: 9 });
    const once = passMove(start);
    expect(once.over).toBe(false);
    expect(once.passes).toBe(1);
    const twice = passMove(once);
    expect(twice.over).toBe(true);
    expect(passMove(twice)).toBe(twice);

    const broken = run(passMove(start), [P(4, 4)]);
    expect(broken.passes).toBe(0);
    expect(passMove(broken).over).toBe(false);
  });

  it("提子数按方累计,轮次跟着换", () => {
    const state = createGame({ size: 9, board: parseRows(KO_ROWS), turn: BLACK });
    const after = run(state, [P(2, 1)]);
    expect(after.captures[BLACK]).toBe(1);
    expect(after.captures[WHITE]).toBe(0);
    expect(after.turn).toBe(WHITE);
  });

  it("悔一手能退回上一步", () => {
    const opts = { size: 9 as const };
    const two = run(createGame(opts), [P(2, 2), P(6, 6)]);
    const back = undoMove(two, opts);
    expect(back.moves).toHaveLength(1);
    expect(back.board.cells[P(6, 6)]).toBe(0);
    expect(back.turn).toBe(WHITE);
  });

  it("让子:黑先摆好子,轮到白先走,贴还由 score 负责", () => {
    const state = createGame({ size: 9, handicap: 2 });
    expect(state.handicap).toBe(2);
    expect(state.turn).toBe(WHITE);
    let stones = 0;
    for (let i = 0; i < state.board.cells.length; i++) if (state.board.cells[i] === BLACK) stones++;
    expect(stones).toBe(2);
  });

  it("终局之后不再收子", () => {
    const over = passMove(passMove(createGame({ size: 9 })));
    expect(checkMove(over, P(4, 4))).toBe("over");
  });

  it("眼形判定:四周全是自己的子才算眼", () => {
    const board = parseRows(rows9(".X.......", "X.X......", ".X......."));
    expect(isEyeLike(board, P(1, 1), BLACK)).toBe(true);
    expect(isEyeLike(board, P(5, 5), BLACK)).toBe(false);
  });

  it("非法提示语全是温柔的说法,不批评人", () => {
    for (const text of Object.values(ILLEGAL_TEXT)) {
      expect(text.length).toBeGreaterThan(6);
      expect(text).not.toMatch(/笨|蠢|错了|不许|傻/);
    }
  });
});
