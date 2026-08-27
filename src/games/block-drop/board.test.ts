import { describe, expect, it } from "vitest";
import {
  BUFFER_ROWS,
  COLS,
  GARBAGE_CELL,
  ROWS,
  VISIBLE_ROWS,
  absCells,
  addGarbage,
  buildBoard,
  bumpiness,
  clearLines,
  cloneBoard,
  collides,
  columnHeights,
  countHoles,
  createBoard,
  dropPosition,
  filledCount,
  fullRows,
  isTopOut,
  lockPiece,
  maxHeight,
  rowFull,
  wellDepths
} from "./board";
import { cellsFor } from "./pieces";

describe("block-drop · 场地", () => {
  it("十列二十行,顶上再留两行缓冲", () => {
    expect(COLS).toBe(10);
    expect(VISIBLE_ROWS).toBe(20);
    expect(BUFFER_ROWS).toBe(2);
    expect(ROWS).toBe(22);
    const b = createBoard();
    expect(b).toHaveLength(22);
    expect(b[0]).toHaveLength(10);
    expect(filledCount(b)).toBe(0);
  });

  it("复制出来的场地改了不影响原来的", () => {
    const b = createBoard();
    const c = cloneBoard(b);
    c[5][5] = 3;
    expect(b[5][5]).toBe(0);
    expect(filledCount(c)).toBe(1);
  });

  it("方框坐标换算成场地坐标", () => {
    expect(absCells([{ x: 1, y: 2 }], 3, 4)).toEqual([{ x: 4, y: 6 }]);
  });

  it("碰撞:左、右、底三个边界都拦得住", () => {
    const b = createBoard();
    const o = cellsFor("O", 0);
    expect(collides(b, o, -2, 5)).toBe(true); // 出左边
    expect(collides(b, o, 9, 5)).toBe(true); // 出右边
    expect(collides(b, o, 4, ROWS - 1)).toBe(true); // 掉出底
    expect(collides(b, o, 4, ROWS - 2)).toBe(false);
  });

  it("碰撞:顶上缓冲区之外的格子先不判,压到砖才算撞", () => {
    const b = createBoard();
    expect(collides(b, cellsFor("I", 1), 4, -6)).toBe(false);
    b[10][4] = 2;
    expect(collides(b, cellsFor("O", 0), 4, 9)).toBe(true);
    expect(collides(b, cellsFor("O", 0), 4, 8)).toBe(false);
  });

  it("钉块只改新场地,颜色写进去", () => {
    const b = createBoard();
    const out = lockPiece(b, cellsFor("O", 0), 4, 10, 5);
    expect(filledCount(b)).toBe(0);
    expect(filledCount(out)).toBe(4);
    expect(out[10][4]).toBe(5);
    expect(out[11][5]).toBe(5);
  });

  it("幽灵落点就是硬降落点:再往下一格一定撞", () => {
    const b = buildBoard([[3], [3]]);
    for (const x of [0, 2, 3, 6]) {
      const cells = cellsFor("T", 0);
      const y = dropPosition(b, cells, x, -2);
      expect(collides(b, cells, x, y)).toBe(false);
      expect(collides(b, cells, x, y + 1)).toBe(true);
    }
  });

  it("空场地上硬降落到最底下", () => {
    const b = createBoard();
    const cells = cellsFor("I", 0);
    // 长条出生态占方框第 1 行,落到底时那一行应该是最后一行
    const y = dropPosition(b, cells, 3, -2);
    expect(y + 1).toBe(ROWS - 1);
  });

  it("整行满了才算满", () => {
    const b = createBoard();
    for (let c = 0; c < COLS - 1; c++) b[21][c] = 1;
    expect(rowFull(b, 21)).toBe(false);
    b[21][COLS - 1] = 1;
    expect(rowFull(b, 21)).toBe(true);
    expect(fullRows(b)).toEqual([21]);
  });

  it("消一行:上面的整体塌下来", () => {
    const b = buildBoard([[], [4]]); // 底下一行满,上面一行缺第 4 列
    const r = clearLines(b);
    expect(r.count).toBe(1);
    expect(r.rows).toEqual([ROWS - 1]);
    expect(r.board[ROWS - 1][4]).toBe(0);
    expect(r.board[ROWS - 1][0]).toBe(GARBAGE_CELL);
    expect(filledCount(r.board)).toBe(COLS - 1);
  });

  it("一次消四行,剩下的行保持原来的上下顺序", () => {
    const b = buildBoard([[], [], [], [], [0, 1], [8, 9]]);
    const before = [b[ROWS - 5].join(""), b[ROWS - 6].join("")];
    const r = clearLines(b);
    expect(r.count).toBe(4);
    expect(r.board[ROWS - 1].join("")).toBe(before[0]);
    expect(r.board[ROWS - 2].join("")).toBe(before[1]);
    expect(filledCount(r.board)).toBe(filledCount(b) - 4 * COLS);
  });

  it("中间夹着不满的行,只消满的那几行", () => {
    const b = buildBoard([[], [3], []]);
    const r = clearLines(b);
    expect(r.count).toBe(2);
    expect(r.rows).toEqual([ROWS - 3, ROWS - 1]);
    expect(r.board[ROWS - 1][3]).toBe(0);
  });

  it("没有满行就原样返回一份复制", () => {
    const b = buildBoard([[3]]);
    const r = clearLines(b);
    expect(r.count).toBe(0);
    expect(r.board).toEqual(b);
    expect(r.board).not.toBe(b);
  });

  it("垃圾行从底下升起来,同一波的洞在同一列", () => {
    const b = createBoard();
    b[ROWS - 1][0] = 3;
    const out = addGarbage(b, 3, 7);
    expect(out).toHaveLength(ROWS);
    for (let r = ROWS - 3; r < ROWS; r++) {
      expect(out[r][7]).toBe(0);
      expect(out[r].filter((v) => v === GARBAGE_CELL)).toHaveLength(COLS - 1);
    }
    // 原来底下那一块被顶上去了三格
    expect(out[ROWS - 4][0]).toBe(3);
  });

  it("垃圾行 0 条就等于什么也没发生", () => {
    const b = buildBoard([[2]]);
    expect(addGarbage(b, 0, 3)).toEqual(b);
    expect(addGarbage(b, -2, 3)).toEqual(b);
  });

  it("洞的列号超出范围会绕回来", () => {
    const b = createBoard();
    expect(addGarbage(b, 1, 12)[ROWS - 1][2]).toBe(0);
    expect(addGarbage(b, 1, -1)[ROWS - 1][9]).toBe(0);
  });

  it("新块出生位置被占住就是这一局到头了", () => {
    const b = createBoard();
    expect(isTopOut(b, "T", 0, 3, 0)).toBe(false);
    for (let c = 0; c < COLS; c++) b[1][c] = 1;
    expect(isTopOut(b, "T", 0, 3, 0)).toBe(true);
  });

  it("列高、洞、平整度、井深都算得对", () => {
    // 底下三行:第 9 列空着当井,第 3 列上面盖了一层留了个洞
    const b = createBoard();
    for (let c = 0; c < 9; c++) b[ROWS - 1][c] = 1;
    b[ROWS - 2][3] = 0;
    b[ROWS - 3][3] = 1;
    const h = columnHeights(b);
    expect(h[0]).toBe(1);
    expect(h[3]).toBe(3);
    expect(h[9]).toBe(0);
    expect(maxHeight(b)).toBe(3);
    expect(countHoles(b)).toBe(1);
    expect(bumpiness(b)).toBe(Math.abs(1 - 3) + Math.abs(3 - 1) + 1);
    expect(wellDepths(b)[9]).toBe(1);
  });

  it("空场地的指标全是 0", () => {
    const b = createBoard();
    expect(columnHeights(b).every((v) => v === 0)).toBe(true);
    expect(countHoles(b)).toBe(0);
    expect(bumpiness(b)).toBe(0);
    expect(maxHeight(b)).toBe(0);
  });

  it("buildBoard 从底往上写,列表里的列是空着的", () => {
    const b = buildBoard([[0, 1], [5]]);
    expect(b[ROWS - 1][0]).toBe(0);
    expect(b[ROWS - 1][1]).toBe(0);
    expect(b[ROWS - 1][2]).toBe(GARBAGE_CELL);
    expect(b[ROWS - 2][5]).toBe(0);
    expect(b[ROWS - 3].every((v) => v === 0)).toBe(true);
  });
});
