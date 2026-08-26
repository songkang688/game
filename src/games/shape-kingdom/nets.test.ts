import { describe, expect, it } from "vitest";
import { cellSet } from "./geometry";
import {
  allPolyominoes,
  auditStaticNets,
  cellsToNet,
  checkPolygonNet,
  coneNetOk,
  coneSectorDegrees,
  convexOverlap,
  cubeNetSVG,
  cubeNets,
  cylinderNetOk,
  foldsIntoCube,
  hasFaceMapping,
  netHinges,
  nonCubeNets,
  polygonNetOf,
  polygonNetSVG,
  squarePyramidNet,
  triPrismNet,
  triPyramidNet,
} from "./nets";

/** 一行行写出来的图案，`#` 是有格子 */
function fromArt(rows: string[]): Set<string> {
  const list: Array<[number, number]> = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "#") list.push([r, c]);
    });
  });
  return cellSet(list);
}

describe("折叠校验器 · 正方体展开图", () => {
  it("六连方格一共 35 种，其中恰好 11 种能折成正方体", () => {
    expect(allPolyominoes(6)).toHaveLength(35);
    expect(cubeNets()).toHaveLength(11);
    expect(nonCubeNets()).toHaveLength(24);
  });

  it("1-4-1 型的六张全部折得成", () => {
    // 一排四格，上面一格、下面一格，两格的列位置任意组合
    for (const top of [0, 1, 2, 3]) {
      for (const bottom of [0, 1, 2, 3]) {
        const cells = cellSet([
          [1, 0], [1, 1], [1, 2], [1, 3],
          [0, top], [2, bottom],
        ]);
        expect(foldsIntoCube(cells), `top=${top} bottom=${bottom}`).toBe(true);
      }
    }
  });

  it("经典错图逐张被判否：1×6 长条 / 2×3 矩形 / 五格一排带尾 / 含 2×2 方块", () => {
    // 一排六格：折到第五格就撞回第一格
    expect(foldsIntoCube(fromArt(["######"]))).toBe(false);
    // 2×3 矩形：折痕多到成不了树，中间那两格会重叠
    expect(foldsIntoCube(fromArt(["###", "###"]))).toBe(false);
    // 一排五格再挂一格：五格已经绕不回来了
    expect(foldsIntoCube(fromArt(["#####", "#...."]))).toBe(false);
    // 含 2×2 方块的六连方格一律折不成（四格挤在同一个角上）
    expect(foldsIntoCube(fromArt(["##", "##", "#.", "#."]))).toBe(false);
    expect(foldsIntoCube(fromArt(["##.", "##.", ".##"]))).toBe(false);
  });

  it("看着像 1-4-1、其实两片翅膀在同一格上的那张是对的（校验器不冤枉好图）", () => {
    expect(foldsIntoCube(fromArt([".#.", "###", ".#.", ".#."]))).toBe(true);
  });

  it("1×6 长条是「组合上像树、几何上折不成」的典型：三维模拟才抓得住", () => {
    const strip = fromArt(["######"]);
    const faces = cellsToNet(strip);
    // 折痕数正好 5、连成一棵树，组合校验会放行
    expect(netHinges(faces)).toHaveLength(5);
    expect(checkPolygonNet(faces, "cube").ok).toBe(true);
    // 但真折起来第 5 格会撞回第 1 格
    expect(foldsIntoCube(strip)).toBe(false);
  });

  it("格子数不对、不连通的一律折不成", () => {
    expect(foldsIntoCube(fromArt(["#####"]))).toBe(false);
    expect(foldsIntoCube(fromArt(["#######"]))).toBe(false);
    expect(foldsIntoCube(fromArt(["###.###"]))).toBe(false);
    expect(foldsIntoCube(fromArt(["###", "##.", "#.."]))).toBe(false);
  });

  it("旋转和翻转不影响结论", () => {
    for (const net of cubeNets().slice(0, 4)) {
      const list = [...net].map((k) => k.split(",").map(Number));
      const rotated = cellSet(list.map(([r, c]) => [c, -r] as [number, number]));
      const mirrored = cellSet(list.map(([r, c]) => [r, -c] as [number, number]));
      expect(foldsIntoCube(rotated)).toBe(true);
      expect(foldsIntoCube(mirrored)).toBe(true);
    }
  });

  it("11 张正确展开图互不相同，画出来的 SVG 带得上 data-net", () => {
    const keys = cubeNets().map((n) => [...n].sort().join(" "));
    expect(new Set(keys).size).toBe(11);
    for (const net of cubeNets()) {
      const svg = cubeNetSVG(net, 84);
      expect(svg).toContain("<svg");
      expect(svg).toContain("data-net=");
      expect((svg.match(/<rect/g) ?? []).length).toBe(6);
    }
  });
});

describe("折叠校验器 · 多边形展开图", () => {
  it("三棱柱 / 四棱锥 / 三棱锥的展开图都折得成", () => {
    expect(checkPolygonNet(triPrismNet(), "triPrism")).toEqual({ ok: true });
    expect(checkPolygonNet(squarePyramidNet(), "squarePyramid")).toEqual({ ok: true });
    expect(checkPolygonNet(triPyramidNet(), "triPyramid")).toEqual({ ok: true });
  });

  it("折痕条数恰好是面数减一，而且连成一棵树", () => {
    for (const faces of [triPrismNet(), squarePyramidNet(), triPyramidNet()]) {
      expect(netHinges(faces)).toHaveLength(faces.length - 1);
    }
  });

  it("面数或边数对不上就判否", () => {
    expect(checkPolygonNet(triPrismNet().slice(0, 4), "triPrism").ok).toBe(false);
    // 拿三棱锥的四个三角形去冒充四棱锥：边数多重集对不上
    expect(checkPolygonNet(triPyramidNet(), "squarePyramid").ok).toBe(false);
  });

  it("折痕连到立体上并不相邻的两个面就判否", () => {
    // 正方体：一排三格 + 另一排三格错开搭成的树，若强行说成四棱锥必然映射失败
    expect(hasFaceMapping([4, 4, 4, 4, 4], [[0, 1], [1, 2], [2, 3], [3, 4]], {
      faceSides: [4, 3, 3, 3, 3],
      adjacency: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]],
    })).toBe(false);
    // 四棱锥的正确折痕树（底面拖四个三角形）映射得上
    expect(hasFaceMapping([4, 3, 3, 3, 3], [[0, 1], [0, 2], [0, 3], [0, 4]], {
      faceSides: [4, 3, 3, 3, 3],
      adjacency: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]],
    })).toBe(true);
  });

  it("纸面上就压在一起的两个面判否（分离轴定理）", () => {
    const a = { pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
    const b = { pts: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }] };
    const touching = { pts: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }] };
    expect(convexOverlap(a, b)).toBe(true);
    expect(convexOverlap(a, touching)).toBe(false);
  });

  it("题库里的每一张静态展开图都过了校验器", () => {
    expect(auditStaticNets()).toEqual([]);
    expect(polygonNetOf("sphere")).toBeNull();
    expect(polygonNetOf("cylinder")).toBeNull();
  });

  it("多边形展开图画得出 SVG", () => {
    const svg = polygonNetSVG(squarePyramidNet(), "四棱锥的展开图", 110);
    expect(svg).toContain("data-netfaces=\"5\"");
    expect((svg.match(/<polygon/g) ?? []).length).toBe(5);
  });
});

describe("折叠校验器 · 圆柱与圆锥的长度关系", () => {
  it("圆柱侧面长方形的长必须等于底面周长", () => {
    const r = 3;
    expect(cylinderNetOk(r, 2 * Math.PI * r, 5, 5)).toBe(true);
    expect(cylinderNetOk(r, 2 * Math.PI * r + 0.5, 5, 5)).toBe(false);
    expect(cylinderNetOk(r, 2 * Math.PI * r, 4, 5)).toBe(false);
  });

  it("圆锥扇形的圆心角 = 360° × 底面半径 ÷ 母线长", () => {
    expect(coneSectorDegrees(3, 6)).toBeCloseTo(180, 9);
    expect(coneSectorDegrees(2, 8)).toBeCloseTo(90, 9);
    expect(coneNetOk(3, 6, 180)).toBe(true);
    expect(coneNetOk(3, 6, 120)).toBe(false);
  });
});
