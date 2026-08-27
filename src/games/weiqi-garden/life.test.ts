import { describe, expect, it } from "vitest";
import { BLACK, WHITE, groupAt, groups, parseRows } from "./board";
import { P9, board9 } from "./testkit";
import {
  STATUS_TEXT,
  aliveAt,
  autoDeadStones,
  contactGroups,
  enclosingGroups,
  expandDead,
  eyesOf,
  groupStatus,
  isSeki,
  isTrueEye,
  sekiPoints,
  surroundedBy,
  twoEyes
} from "./life";

describe("weiqi-garden · 真眼与假眼", () => {
  it("四周全是自己的子、斜角也干净,就是真眼", () => {
    const board = board9("....X....", "...X.X...", "....X....");
    expect(isTrueEye(board, P9(4, 1), BLACK)).toBe(true);
    expect(isTrueEye(board, P9(4, 1), WHITE)).toBe(false);
  });

  it("盘中间被占掉两个斜角就是假眼,占一个还算真眼", () => {
    const one = board9("...OX....", "...X.X...", "....X....");
    expect(isTrueEye(one, P9(4, 1), BLACK)).toBe(true);
    const two = board9("...OXO...", "...X.X...", "....X....");
    expect(isTrueEye(two, P9(4, 1), BLACK)).toBe(false);
    expect(groups(two).length).toBeGreaterThan(0);
  });

  it("靠边靠角更严:斜角上有一颗对方子就算假眼", () => {
    const clean = board9(".X.......", "X........");
    expect(isTrueEye(clean, P9(0, 0), BLACK)).toBe(true);
    const dirty = board9(".X.......", "XO.......");
    expect(isTrueEye(dirty, P9(0, 0), BLACK)).toBe(false);
  });
});

describe("weiqi-garden · 两眼判活", () => {
  it("两只分开的真眼就是活棋", () => {
    const board = board9("X.X.X....", "XXXXX....", ".........");
    const g = groupAt(board, P9(0, 0));
    expect(g).not.toBeNull();
    expect(eyesOf(board, g!).length).toBe(2);
    expect(twoEyes(board, g!)).toBe(true);
    expect(aliveAt(board, P9(0, 0))).toBe(true);
  });

  it("三个空点连成一片只算一只大眼,还不算活", () => {
    const board = board9("X...X....", "XXXXX....");
    const g = groupAt(board, P9(0, 0));
    expect(twoEyes(board, g!)).toBe(false);
    expect(eyesOf(board, g!)).toHaveLength(0);
  });

  it("空点上问活没活,回答是「这里还是空点」", () => {
    const board = board9();
    expect(aliveAt(board, P9(4, 4))).toBe(false);
    expect(groupStatus(board, P9(4, 4))).toBe("empty");
    expect(STATUS_TEXT.empty).toContain("空点");
  });
});

describe("weiqi-garden · 双活", () => {
  /**
   * 整盘只剩两个空点,黑白两块各自都只有这两口公气、都没有真眼 ——
   * 谁先去填谁自己先没气,所以两块都活着,这就是双活。
   */
  const seki = parseRows([
    "XXXX.OOOO",
    "XXXX.OOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO"
  ]);

  it("两块都没真眼、只剩同样的两口公气,判双活", () => {
    const black = groupAt(seki, P9(0, 0));
    const white = groupAt(seki, P9(8, 0));
    expect(black?.liberties).toEqual([P9(4, 0), P9(4, 1)]);
    expect(isSeki(seki, black!)).toBe(true);
    expect(isSeki(seki, white!)).toBe(true);
    expect(sekiPoints(seki)).toEqual([P9(4, 0), P9(4, 1)]);
    expect(groupStatus(seki, P9(0, 0))).toBe("seki");
    expect(STATUS_TEXT.seki).toContain("双活");
  });

  it("双活里的两块都不许判死", () => {
    expect(autoDeadStones(seki)).toEqual([]);
  });

  it("活棋不会被当成双活", () => {
    const board = board9("X.X.X....", "XXXXX....");
    const g = groupAt(board, P9(0, 0));
    expect(isSeki(board, g!)).toBe(false);
  });
});

describe("weiqi-garden · 自动标死子", () => {
  /**
   * 一盘下完的九路棋:左边整片黑、右边整片白,各留两只真眼所以都活着;
   * 黑地里困着一颗白、白地里困着一颗黑,那两颗才是走不掉的。
   */
  const finished = parseRows([
    "XXXXXOOOO",
    ".XOXXOXO.",
    "XX.XXO.OO",
    ".XXXXOOO.",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "XXXXXOOOO",
    "..XXXOOOO"
  ]);

  it("被活棋整个包住、又做不出两眼的子判死", () => {
    const dead = autoDeadStones(finished);
    expect(dead).toEqual([P9(2, 1), P9(6, 1)]);
    expect(groupStatus(finished, P9(2, 1))).toBe("dead");
  });

  it("大墙自己没做眼,也不会被误判成死子", () => {
    // 黑白两堵墙贴在一起,谁都还没做出两只眼,这时候一颗都不许标死
    const rows: string[] = [];
    for (let y = 0; y < 9; y++) rows.push("..X.O....");
    expect(autoDeadStones(parseRows(rows))).toEqual([]);
  });

  it("围着它的是哪几块棋,列得出来", () => {
    const g = groupAt(finished, P9(2, 1));
    expect(g).not.toBeNull();
    expect(surroundedBy(finished, g!, BLACK)).toBe(true);
    const jailers = enclosingGroups(finished, g!);
    expect(jailers.length).toBeGreaterThanOrEqual(1);
    expect(jailers.every((j) => j.color === BLACK)).toBe(true);
    expect(contactGroups(finished, g!).length).toBeGreaterThanOrEqual(1);
  });

  it("点一颗子就把整块标上", () => {
    const board = board9(".OOO.....", ".........");
    expect(expandDead(board, [P9(1, 0)])).toEqual([P9(1, 0), P9(2, 0), P9(3, 0)]);
    expect(expandDead(board, [P9(5, 5)])).toEqual([]);
  });
});
