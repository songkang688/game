import { describe, expect, it } from "vitest";
import {
  cellKey,
  cellSet,
  compositeArea,
  countSymmetryAxes,
  edgesFromFaceSides,
  eulerHolds,
  isConnected,
  lShapeCells,
  mirrorCellSetH,
  normalizeCells,
  notchCells,
  notchPerimeter,
  pieceOrientations,
  polyominoArea,
  polyominoPerimeter,
  rectCells,
  regularPolygonPoints,
  rotateCellSetCW,
  rotatePoints,
  sameCells,
  sortedCells,
  stackedCells,
  starInnerRadius,
  starPoints,
  translateCells,
} from "./geometry";
import { POLYHEDRA, SOLID_EDGES, SOLID_FACES, SOLID_VERTICES, lShapeArea, lShapePerimeter, rectArea, rectPerimeter, triangleArea } from "./logic";

describe("几何 · 面积与周长（公式和格子集合互相验算）", () => {
  it("长方形：公式算的和一格格数出来的完全一致", () => {
    for (let w = 1; w <= 12; w++) {
      for (let h = 1; h <= 9; h++) {
        const cells = rectCells(w, h);
        expect(polyominoArea(cells), `${w}×${h} 面积`).toBe(rectArea(w, h));
        expect(polyominoPerimeter(cells), `${w}×${h} 周长`).toBe(rectPerimeter(w, h));
      }
    }
  });

  it("缺一个角的 L 形：面积变小、周长和原长方形一模一样", () => {
    let checked = 0;
    for (let w = 3; w <= 10; w++) {
      for (let h = 2; h <= 8; h++) {
        for (const cutW of [1, 2, w - 1]) {
          for (const cutH of [1, h - 1]) {
            if (cutW < 1 || cutW >= w || cutH < 1 || cutH >= h) continue;
            const cells = lShapeCells(w, h, cutW, cutH);
            expect(polyominoArea(cells)).toBe(lShapeArea(w, h, cutW, cutH));
            expect(polyominoPerimeter(cells), `${w}×${h} 缺 ${cutW}×${cutH}`).toBe(lShapePerimeter(w, h));
            expect(polyominoPerimeter(cells)).toBe(rectPerimeter(w, h));
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("缺口啃在边中间时周长会变大：这正是「缺角不改周长」讲不了的情形", () => {
    for (let w = 5; w <= 10; w++) {
      for (let h = 3; h <= 7; h++) {
        for (const notchH of [1, 2]) {
          const cells = notchCells(w, h, 2, notchH, 2);
          expect(polyominoPerimeter(cells), `${w}×${h} 凹槽深 ${notchH}`).toBe(notchPerimeter(w, h, notchH));
          expect(polyominoPerimeter(cells)).toBeGreaterThan(rectPerimeter(w, h));
        }
      }
    }
  });

  it("直角三角形面积：底 × 高 ÷ 2，含边界值", () => {
    expect(triangleArea(1, 2)).toBe(1);
    expect(triangleArea(6, 4)).toBe(12);
    expect(triangleArea(5, 4)).toBe(10);
    expect(triangleArea(12, 9)).toBe(54);
    // 底或高是 0 就退化成一条线，面积 0
    expect(triangleArea(0, 5)).toBe(0);
    expect(triangleArea(7, 0)).toBe(0);
    // 底 × 高 是奇数时面积带半格，出题时要避开
    expect(triangleArea(3, 3)).toBe(4.5);
  });

  it("组合图形：上下两块长方形拼起来，面积等于两块之和", () => {
    for (const [tw, th, bw, bh] of [[3, 2, 5, 3], [4, 1, 4, 4], [2, 3, 6, 2]] as const) {
      const cells = stackedCells(tw, th, bw, bh);
      expect(polyominoArea(cells)).toBe(compositeArea([{ w: tw, h: th }, { w: bw, h: bh }]));
      expect(isConnected(cells)).toBe(true);
    }
  });

  it("单格与空集这些边界值也不会算崩", () => {
    expect(polyominoArea(rectCells(1, 1))).toBe(1);
    expect(polyominoPerimeter(rectCells(1, 1))).toBe(4);
    expect(polyominoArea(new Set())).toBe(0);
    expect(polyominoPerimeter(new Set())).toBe(0);
    expect(isConnected(new Set())).toBe(false);
    expect(isConnected(cellSet([[0, 0], [0, 2]]))).toBe(false);
  });
});

describe("几何 · 格子集合的搬运与比较", () => {
  it("转四次回原样、照两次镜子回原样", () => {
    const piece = cellSet([[0, 0], [1, 0], [2, 0], [2, 1]]);
    let cur = piece;
    for (let i = 0; i < 4; i++) cur = rotateCellSetCW(cur);
    expect(sameCells(cur, normalizeCells(piece))).toBe(true);
    expect(sameCells(mirrorCellSetH(mirrorCellSetH(piece)), normalizeCells(piece))).toBe(true);
  });

  it("平移不改变形状，集合相等的判定跟位置无关", () => {
    const piece = cellSet([[0, 0], [0, 1], [1, 1]]);
    const moved = translateCells(piece, 3, 5);
    expect(sameCells(piece, moved)).toBe(false);
    expect(sameCells(normalizeCells(moved), piece)).toBe(true);
    expect(sortedCells(moved)).toEqual([cellKey(3, 5), cellKey(3, 6), cellKey(4, 6)]);
  });

  it("骨牌的摆法数：正方形 1 种、一字骨牌 2 种、L 形四格 8 种", () => {
    expect(pieceOrientations(cellSet([[0, 0], [0, 1], [1, 0], [1, 1]]))).toHaveLength(1);
    expect(pieceOrientations(cellSet([[0, 0], [0, 1]]))).toHaveLength(2);
    expect(pieceOrientations(cellSet([[0, 0], [1, 0], [2, 0], [2, 1]]))).toHaveLength(8);
  });
});

describe("几何 · 对称轴条数（数值求解）", () => {
  it("正 n 边形就有 n 条对称轴", () => {
    for (let n = 3; n <= 8; n++) {
      expect(countSymmetryAxes(regularPolygonPoints(n, 50, 50, 40)), `正 ${n} 边形`).toBe(n);
    }
  });

  it("正五角星 5 条，正六角星 6 条", () => {
    expect(countSymmetryAxes(starPoints(5, 50, 52, 46, starInnerRadius(5, 46)))).toBe(5);
    expect(countSymmetryAxes(starPoints(6, 50, 50, 44, starInnerRadius(6, 44)))).toBe(6);
  });

  it("长方形 2 条、正方形 4 条、菱形 2 条、等腰三角形 1 条、不等边三角形 0 条", () => {
    expect(countSymmetryAxes([{ x: 5, y: 26 }, { x: 95, y: 26 }, { x: 95, y: 74 }, { x: 5, y: 74 }])).toBe(2);
    expect(countSymmetryAxes([{ x: 15, y: 15 }, { x: 85, y: 15 }, { x: 85, y: 85 }, { x: 15, y: 85 }])).toBe(4);
    expect(countSymmetryAxes([{ x: 50, y: 8 }, { x: 88, y: 50 }, { x: 50, y: 92 }, { x: 12, y: 50 }])).toBe(2);
    expect(countSymmetryAxes([{ x: 50, y: 10 }, { x: 90, y: 85 }, { x: 10, y: 85 }])).toBe(1);
    expect(countSymmetryAxes([{ x: 10, y: 10 }, { x: 90, y: 30 }, { x: 30, y: 85 }])).toBe(0);
  });

  it("1.1 画的那个「五边形」其实不是正五边形，只有 1 条对称轴", () => {
    const drawn = [
      { x: 50, y: 8 },
      { x: 90, y: 38 },
      { x: 75, y: 88 },
      { x: 25, y: 88 },
      { x: 10, y: 38 },
    ];
    expect(countSymmetryAxes(drawn)).toBe(1);
    // 换成精确的正五边形才配得上「5 条对称轴」这个答案
    expect(countSymmetryAxes(regularPolygonPoints(5, 50, 54, 44))).toBe(5);
  });

  it("平行四边形只有中心对称，没有对称轴", () => {
    expect(countSymmetryAxes([{ x: 10, y: 20 }, { x: 70, y: 20 }, { x: 90, y: 70 }, { x: 30, y: 70 }])).toBe(0);
  });

  it("旋转整块图形不改变对称轴条数", () => {
    const pentagon = regularPolygonPoints(5, 50, 50, 40);
    for (const q of [1, 2, 3]) {
      expect(countSymmetryAxes(rotatePoints(pentagon, q))).toBe(5);
    }
  });
});

describe("几何 · 多面体的面棱顶点", () => {
  it("每个多面体都满足欧拉公式 V − E + F = 2", () => {
    for (const k of POLYHEDRA) {
      expect(
        eulerHolds(SOLID_VERTICES[k], SOLID_EDGES[k], SOLID_FACES[k]),
        `${k}: V=${SOLID_VERTICES[k]} E=${SOLID_EDGES[k]} F=${SOLID_FACES[k]}`
      ).toBe(true);
    }
    expect(eulerHolds(8, 12, 6)).toBe(true);
    expect(eulerHolds(8, 12, 7)).toBe(false);
  });

  it("棱数也能由各面的边数推出来（每条棱被两个面共用）", () => {
    expect(edgesFromFaceSides([4, 4, 4, 4, 4, 4])).toBe(SOLID_EDGES.cube);
    expect(edgesFromFaceSides([3, 3, 4, 4, 4])).toBe(SOLID_EDGES.triPrism);
    expect(edgesFromFaceSides([4, 3, 3, 3, 3])).toBe(SOLID_EDGES.squarePyramid);
    expect(edgesFromFaceSides([3, 3, 3, 3])).toBe(SOLID_EDGES.triPyramid);
  });
});
