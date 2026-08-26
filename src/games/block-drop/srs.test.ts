import { describe, expect, it } from "vitest";
import { KICKS_I, KICKS_JLSTZ, kicksFor, tryRotate, type KickKey } from "./srs";
import { PIECE_IDS, ROTS, cellsFor, rotStep, type PieceId, type Rot } from "./pieces";
import { buildBoard, collides, createBoard, type Board } from "./board";

const TURNS: KickKey[] = ["0>1", "1>0", "1>2", "2>1", "2>3", "3>2", "3>0", "0>3"];

function collideOn(board: Board) {
  return (cells: { x: number; y: number }[], x: number, y: number) => collides(board, cells, x, y);
}

describe("block-drop · 踢墙表", () => {
  it("两张表都把八种相邻转向写全了,每种五组偏移", () => {
    for (const k of TURNS) {
      expect(KICKS_JLSTZ[k]).toHaveLength(5);
      expect(KICKS_I[k]).toHaveLength(5);
    }
  });

  it("每一组的第一次尝试都是原地", () => {
    for (const k of TURNS) {
      expect(KICKS_JLSTZ[k][0]).toEqual([0, 0]);
      expect(KICKS_I[k][0]).toEqual([0, 0]);
    }
  });

  it("三格宽那张表:12 条具体数值逐条核对", () => {
    expect(KICKS_JLSTZ["0>1"]).toEqual([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]);
    expect(KICKS_JLSTZ["1>0"]).toEqual([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]);
    expect(KICKS_JLSTZ["1>2"]).toEqual([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]);
    expect(KICKS_JLSTZ["2>1"]).toEqual([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]);
    expect(KICKS_JLSTZ["2>3"]).toEqual([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]);
    expect(KICKS_JLSTZ["3>2"]).toEqual([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
    expect(KICKS_JLSTZ["3>0"]).toEqual([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
    expect(KICKS_JLSTZ["0>3"]).toEqual([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]);
    // 长条另外四条
    expect(KICKS_I["0>1"]).toEqual([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]);
    expect(KICKS_I["1>2"]).toEqual([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]);
    expect(KICKS_I["2>3"]).toEqual([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]);
    expect(KICKS_I["3>0"]).toEqual([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]);
  });

  it("来回转的两组偏移互为相反数", () => {
    const pairs: [KickKey, KickKey][] = [
      ["0>1", "1>0"],
      ["1>2", "2>1"],
      ["2>3", "3>2"],
      ["3>0", "0>3"]
    ];
    for (const table of [KICKS_JLSTZ, KICKS_I]) {
      for (const [f, r] of pairs) {
        for (let i = 0; i < 5; i++) {
          expect(table[r][i][0] + table[f][i][0]).toBe(0);
          expect(table[r][i][1] + table[f][i][1]).toBe(0);
        }
      }
    }
  });

  it("拿到手的偏移已经换成向下为正的场地坐标", () => {
    // 表里 0>1 的第三组是 [-1, 1](向上一格),场地里应该是 dy = -1
    expect(kicksFor("T", 0, 1)[2]).toEqual({ dx: -1, dy: -1 });
    expect(kicksFor("I", 0, 1)[4]).toEqual({ dx: 1, dy: -2 });
  });

  it("小方块不参与踢墙,只有原地一组", () => {
    for (const from of ROTS) {
      for (const to of ROTS) {
        expect(kicksFor("O", from, to)).toEqual([{ dx: 0, dy: 0 }]);
      }
    }
  });

  it("长条用的是自己那张表,和三格宽的不一样", () => {
    expect(kicksFor("I", 0, 1)).not.toEqual(kicksFor("T", 0, 1));
    for (const id of ["T", "S", "Z", "J", "L"] as PieceId[]) {
      expect(kicksFor(id, 0, 1)).toEqual(kicksFor("T", 0, 1));
    }
  });
});

describe("block-drop · 转一转", () => {
  it("空场地上原地就能转成,不算踢墙", () => {
    const board = createBoard();
    for (const id of PIECE_IDS) {
      const r = tryRotate(id, 0, 3, 5, 1, collideOn(board));
      expect(r).not.toBeNull();
      expect(r?.kickIndex).toBe(0);
      expect(r?.kicked).toBe(false);
      expect(r?.rot).toBe(rotStep(0, 1));
    }
  });

  it("贴着左墙竖着的长条会被推回场内", () => {
    const board = createBoard();
    // 长条 rot=1 时占的是方框第 2 列,x=-2 才让它贴住左墙
    const r = tryRotate("I", 1, -2, 6, -1, collideOn(board));
    expect(r).not.toBeNull();
    expect(r?.kicked).toBe(true);
    const cells = cellsFor("I", r!.rot).map((c) => c.x + r!.x);
    expect(Math.min(...cells)).toBeGreaterThanOrEqual(0);
  });

  it("贴着右墙转也不会伸出场地", () => {
    const board = createBoard();
    for (const id of PIECE_IDS) {
      const r = tryRotate(id, 0, 8, 6, 1, collideOn(board));
      if (!r) continue;
      const xs = cellsFor(id, r.rot).map((c) => c.x + r.x);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThan(10);
    }
  });

  it("窄缝里靠踢墙才塞得进去,而且塞进去不撞", () => {
    // 第 4 列留一条两格深的缝,右边搭着屋檐
    const board = buildBoard([[4], [4], [4, 5, 6, 7, 8, 9]]);
    const r = tryRotate("J", 0, 3, 19, 1, collideOn(board));
    if (r) {
      expect(collides(board, cellsFor("J", r.rot), r.x, r.y)).toBe(false);
    }
    // 至少要有一个块能靠踢墙落进这条缝
    let kicked = false;
    for (const id of PIECE_IDS) {
      for (const rot of ROTS) {
        for (let x = 0; x < 10; x++) {
          const res = tryRotate(id, rot, x, 19, 1, collideOn(board));
          if (res?.kicked) kicked = true;
        }
      }
    }
    expect(kicked).toBe(true);
  });

  it("五组都塞不进去就返回 null,外面保持原样", () => {
    // 整块场地填满,任何位置都转不动
    const board = createBoard().map(() => new Array<number>(10).fill(1));
    for (const id of PIECE_IDS) {
      expect(tryRotate(id, 0, 4, 10, 1, collideOn(board))).toBeNull();
    }
  });

  it("转出去的结果一定不撞", () => {
    const board = buildBoard([[2, 3], [3], [7, 8, 9]]);
    for (const id of PIECE_IDS) {
      for (const rot of ROTS) {
        for (let x = -1; x < 11; x++) {
          for (const dir of [1, -1] as const) {
            const r = tryRotate(id, rot, x, 17, dir, collideOn(board));
            if (!r) continue;
            expect(collides(board, cellsFor(id, r.rot), r.x, r.y)).toBe(false);
            expect(r.rot).toBe(rotStep(rot as Rot, dir));
          }
        }
      }
    }
  });

  it("kickIndex 就是用了第几组偏移,0 表示原地转成", () => {
    const board = createBoard();
    const r = tryRotate("T", 0, 4, 8, 1, collideOn(board));
    expect(r?.kickIndex).toBe(0);
    const wall = tryRotate("I", 1, -2, 6, -1, collideOn(board));
    expect(wall?.kickIndex).toBeGreaterThan(0);
  });
});
