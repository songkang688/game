import { describe, expect, it } from "vitest";
import { type Board, type Piece, applyMove, idx, initialBoard, makeEmptyBoard } from "./logic";
import {
  fileNumber,
  friendlyLine,
  moveToChinese,
  numeral,
  recordLine,
  sameFilePieces,
  stackWord,
} from "./notation";

function put(b: Board, x: number, y: number, p: Piece): void {
  b[idx(x, y)] = p;
}

const mv = (x: number, y: number, tx: number, ty: number) => ({ from: { x, y }, to: { x: tx, y: ty } });

describe("纵线怎么数", () => {
  it("红方从自己右手边数一~九", () => {
    expect(fileNumber(8, "red")).toBe(1);
    expect(fileNumber(4, "red")).toBe(5);
    expect(fileNumber(0, "red")).toBe(9);
  });

  it("黑方从自己右手边数 1~9", () => {
    expect(fileNumber(0, "black")).toBe(1);
    expect(fileNumber(4, "black")).toBe(5);
    expect(fileNumber(8, "black")).toBe(9);
  });

  it("红用汉字、黑用阿拉伯数字", () => {
    expect(numeral(5, "red")).toBe("五");
    expect(numeral(9, "red")).toBe("九");
    expect(numeral(5, "black")).toBe("5");
    expect(numeral(1, "black")).toBe("1");
  });
});

describe("开局那几手的标准写法", () => {
  const b = initialBoard();

  it("炮二平五", () => {
    expect(moveToChinese(b, mv(7, 7, 4, 7))).toBe("炮二平五");
  });

  it("马二进三", () => {
    expect(moveToChinese(b, mv(7, 9, 6, 7))).toBe("马二进三");
  });

  it("兵七进一", () => {
    expect(moveToChinese(b, mv(2, 6, 2, 5))).toBe("兵七进一");
  });

  it("黑方：马8进7、炮8平5、卒7进1", () => {
    expect(moveToChinese(b, mv(7, 0, 6, 2))).toBe("马8进7");
    expect(moveToChinese(b, mv(7, 2, 4, 2))).toBe("炮8平5");
    expect(moveToChinese(b, mv(6, 3, 6, 4))).toBe("卒7进1");
  });

  it("车一平二（要先把马挪开）", () => {
    const after = applyMove(b, mv(7, 9, 6, 7));
    expect(moveToChinese(after, mv(8, 9, 7, 9))).toBe("车一平二");
  });
});

describe("进 / 退 / 平", () => {
  it("直着走的子写走了几格", () => {
    const b = makeEmptyBoard();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 4, 9, { side: "red", type: "K" });
    put(b, 4, 0, { side: "black", type: "K" });
    expect(moveToChinese(b, mv(0, 9, 0, 5))).toBe("车九进四");
    const b2 = makeEmptyBoard();
    put(b2, 0, 5, { side: "red", type: "R" });
    expect(moveToChinese(b2, mv(0, 5, 0, 8))).toBe("车九退三");
    expect(moveToChinese(b2, mv(0, 5, 3, 5))).toBe("车九平六");
  });

  it("斜着走的子写落到第几条线", () => {
    const b = makeEmptyBoard();
    put(b, 4, 8, { side: "red", type: "A" });
    expect(moveToChinese(b, mv(4, 8, 3, 9))).toBe("仕五退六");
    const b2 = makeEmptyBoard();
    put(b2, 2, 9, { side: "red", type: "E" });
    expect(moveToChinese(b2, mv(2, 9, 4, 7))).toBe("相七进五");
    const b3 = makeEmptyBoard();
    put(b3, 4, 5, { side: "red", type: "H" });
    expect(moveToChinese(b3, mv(4, 5, 3, 3))).toBe("马五进六");
  });

  it("黑方的进退方向相反", () => {
    const b = makeEmptyBoard();
    put(b, 0, 0, { side: "black", type: "R" });
    expect(moveToChinese(b, mv(0, 0, 0, 4))).toBe("车1进4");
    expect(moveToChinese(b, mv(0, 0, 4, 0))).toBe("车1平5");
  });
});

describe("一条线上有好几个同种子", () => {
  it("两个写前后", () => {
    const b = makeEmptyBoard();
    put(b, 4, 5, { side: "red", type: "R" });
    put(b, 4, 8, { side: "red", type: "R" });
    expect(moveToChinese(b, mv(4, 5, 4, 4))).toBe("前车进一");
    expect(moveToChinese(b, mv(4, 8, 4, 7))).toBe("后车进一");
  });

  it("三个兵写前中后", () => {
    const b = makeEmptyBoard();
    put(b, 3, 2, { side: "red", type: "P" });
    put(b, 3, 3, { side: "red", type: "P" });
    put(b, 3, 4, { side: "red", type: "P" });
    expect(moveToChinese(b, mv(3, 2, 3, 1))).toBe("前兵进一");
    expect(moveToChinese(b, mv(3, 3, 2, 3))).toBe("中兵平七");
    expect(moveToChinese(b, mv(3, 4, 3, 3))).toBe("后兵进一");
  });

  it("黑方同一条线上的两个卒也写前后", () => {
    const b = makeEmptyBoard();
    put(b, 6, 5, { side: "black", type: "P" });
    put(b, 6, 7, { side: "black", type: "P" });
    expect(moveToChinese(b, mv(6, 7, 6, 8))).toBe("前卒进1");
    expect(moveToChinese(b, mv(6, 5, 6, 6))).toBe("后卒进1");
  });

  it("sameFilePieces 从前到后排，stackWord 给得出前中后", () => {
    const b = makeEmptyBoard();
    put(b, 3, 2, { side: "red", type: "P" });
    put(b, 3, 4, { side: "red", type: "P" });
    expect(sameFilePieces(b, 3, "red", "P")).toEqual([2, 4]);
    expect(stackWord(0, 2, "red")).toBe("前");
    expect(stackWord(1, 2, "red")).toBe("后");
    expect(stackWord(1, 3, "red")).toBe("中");
    expect(stackWord(1, 4, "red")).toBe("二");
    expect(stackWord(0, 1, "red")).toBe("");
  });
});

describe("复盘条与解说", () => {
  it("recordLine 带上回合号与红黑", () => {
    expect(recordLine(3, "red", "炮二平五")).toBe("3. 红 炮二平五");
    expect(recordLine(4, "black", "马8进7")).toBe("4. 黑 马8进7");
  });

  it("吃子说成「请回家休息」，不出现打杀字眼", () => {
    const b = makeEmptyBoard();
    put(b, 0, 9, { side: "red", type: "R" });
    put(b, 0, 3, { side: "black", type: "H" });
    const line = friendlyLine(b, mv(0, 9, 0, 3));
    expect(line).toContain("回家休息");
    expect(line).toContain("车九进六");
    expect(line).not.toContain("吃掉");
    expect(line).not.toContain("死");
  });

  it("空点上的一步没有棋子时返回空串", () => {
    const b = makeEmptyBoard();
    expect(moveToChinese(b, mv(0, 0, 0, 1))).toBe("");
    expect(friendlyLine(b, mv(0, 0, 0, 1))).toBe("");
  });
});
