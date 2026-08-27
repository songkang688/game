import { describe, expect, it } from "vitest";
import {
  BLACK,
  BOARD_SIZES,
  WHITE,
  colorName,
  coordLabel,
  createBoard,
  diagonals,
  emptyPoints,
  formatRows,
  groupAt,
  groups,
  handicapPoints,
  liberties,
  neighbors,
  other,
  parseRows,
  pointOf,
  positionHash,
  starPoints,
  stoneCount,
  xy
} from "./board";
import { rows9 } from "./testkit";

describe("weiqi-garden · 连通块与气", () => {
  it("上下左右挨着的同色子是一块,斜着的不算", () => {
    const board = parseRows(rows9("XX.......", "X.X......"));
    const g = groupAt(board, pointOf(9, 0, 0));
    expect(g?.stones).toEqual([pointOf(9, 0, 0), pointOf(9, 1, 0), pointOf(9, 0, 1)].sort((a, b) => a - b));
    // (2,1) 只和 (1,0) 斜着挨着,自己单独一块
    expect(groupAt(board, pointOf(9, 2, 1))?.stones).toEqual([pointOf(9, 2, 1)]);
  });

  it("气就是这块棋连着的空点,数得出来", () => {
    const board = parseRows(rows9(".X.......", "XOX......"));
    const white = groupAt(board, pointOf(9, 1, 1));
    expect(white?.color).toBe(WHITE);
    expect(white?.liberties).toEqual([pointOf(9, 1, 2)]);
    const blackTop = groupAt(board, pointOf(9, 1, 0));
    expect(blackTop?.liberties.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("liberties() 对一串子求气,重复的只算一次", () => {
    const board = parseRows(rows9("XX.......", "........."));
    expect(liberties(board, [pointOf(9, 0, 0), pointOf(9, 1, 0)])).toEqual(
      [pointOf(9, 2, 0), pointOf(9, 0, 1), pointOf(9, 1, 1)].sort((a, b) => a - b)
    );
    expect(liberties(board, [])).toEqual([]);
  });

  it("groups() 把每块棋只列一次,斜着挨的白子算两块", () => {
    const board = parseRows(rows9("XX..O....", ".....O..."));
    expect(groups(board)).toHaveLength(3);
    expect(stoneCount(board, BLACK)).toBe(2);
    expect(stoneCount(board, WHITE)).toBe(2);
    // 白的两颗只是斜着挨着,各自成块
    expect(groups(board).filter((g) => g.color === WHITE)).toHaveLength(2);
  });

  it("空点没有块,数得出盘上还剩几个空", () => {
    const board = parseRows(rows9("X........"));
    expect(groupAt(board, pointOf(9, 5, 5))).toBeNull();
    expect(emptyPoints(board)).toHaveLength(80);
  });

  it("邻点数:角 2 个、边 3 个、中间 4 个;斜邻同理", () => {
    expect(neighbors(9, pointOf(9, 0, 0))).toHaveLength(2);
    expect(neighbors(9, pointOf(9, 4, 0))).toHaveLength(3);
    expect(neighbors(9, pointOf(9, 4, 4))).toHaveLength(4);
    expect(diagonals(9, pointOf(9, 0, 0))).toHaveLength(1);
    expect(diagonals(9, pointOf(9, 4, 4))).toHaveLength(4);
  });
});

describe("weiqi-garden · 盘面指纹与文本盘面", () => {
  it("同一个盘面指纹一样,多一颗子就不一样", () => {
    const a = createBoard(9);
    const b = createBoard(9);
    expect(positionHash(a)).toBe(positionHash(b));
    b.cells[0] = BLACK;
    expect(positionHash(a)).not.toBe(positionHash(b));
  });

  it("带轮次的指纹和不带轮次的指纹是两码事(本作超劫用不带轮次的那种)", () => {
    const a = createBoard(9);
    expect(positionHash(a, BLACK)).not.toBe(positionHash(a));
    expect(positionHash(a, BLACK)).not.toBe(positionHash(a, WHITE));
  });

  it("文本盘面读进来再写出去,一个字都不差", () => {
    const rows = rows9("X.O......", ".XO......");
    expect(formatRows(parseRows(rows))).toEqual(rows);
  });
});

describe("weiqi-garden · 坐标、星位与让子", () => {
  it("列名跳过容易看错的 I,行号从下往上", () => {
    expect(coordLabel(9, pointOf(9, 0, 8))).toBe("A1");
    expect(coordLabel(9, pointOf(9, 7, 0))).toBe("H9");
    // 第 9 列直接跳到 J,盘上不会出现 I
    expect(coordLabel(9, pointOf(9, 8, 0))).toBe("J9");
    expect(coordLabel(19, pointOf(19, 18, 0))).toBe("T19");
  });

  it("三种路数的星位数量对得上,天元在正中间", () => {
    expect(BOARD_SIZES).toEqual([9, 13, 19]);
    expect(starPoints(9)).toHaveLength(5);
    expect(starPoints(13)).toHaveLength(5);
    expect(starPoints(19)).toHaveLength(9);
    expect(starPoints(9)).toContain(pointOf(9, 4, 4));
    expect(xy(19, starPoints(19)[4])).toEqual({ x: 9, y: 9 });
  });

  it("九路让 2 / 3 子都摆在星位上,让不足 2 子就是分先", () => {
    const two = handicapPoints(9, 2);
    const three = handicapPoints(9, 3);
    expect(two).toHaveLength(2);
    expect(three).toHaveLength(3);
    for (const pt of three) expect(starPoints(9)).toContain(pt);
    expect(handicapPoints(9, 1)).toEqual([]);
    expect(handicapPoints(9, 0)).toEqual([]);
  });

  it("黑是朵朵、白是星星,换手换得对", () => {
    expect(other(BLACK)).toBe(WHITE);
    expect(other(WHITE)).toBe(BLACK);
    expect(colorName(BLACK)).toContain("朵朵");
    expect(colorName(WHITE)).toContain("星星");
  });
});
