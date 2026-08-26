import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DIRECTIONS,
  POLYHEDRA,
  SHAPE_COLORS,
  SHAPE_KINDS,
  SHAPE_SIDES,
  SIDED_SHAPES,
  SOLID_EDGES,
  SOLID_FACES,
  SOLID_KINDS,
  SOLID_NAMES,
  SOLID_NETS,
  SOLID_VERTICES,
  SYMMETRIC_SHAPES,
  SYMMETRY_AXES,
  cellsKey,
  formatPoint,
  keyCells,
  lShapeArea,
  lShapePerimeter,
  makeRoundForLevel,
  makeShapeRound,
  makeSidesRound,
  makeSizeRound,
  mirrorCellsH,
  movePoint,
  rectArea,
  rectPerimeter,
  rotateCells,
  triangleArea,
} from "./logic";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("题库扩容：形状 8 种、颜色 6 种", () => {
  assert.equal(SHAPE_KINDS.length, 8);
  assert.equal(SHAPE_COLORS.length, 6);
  assert.equal(new Set(SHAPE_KINDS).size, 8);
  assert.equal(new Set(SHAPE_COLORS).size, 6);
});

test("makeShapeRound: 400 轮门与答案一致", () => {
  const rand = seeded(42);
  for (let i = 0; i < 400; i++) {
    const r = makeShapeRound(rand);
    assert.equal(r.bins.length, 3);
    assert.equal(new Set(r.bins).size, 3, "三扇门必须互不相同");
    const answer = r.bins[r.answerIndex];
    if (r.mode === "shape") {
      assert.equal(answer, r.shape);
      for (const b of r.bins) assert.ok((SHAPE_KINDS as string[]).includes(b));
    } else {
      assert.equal(answer, r.color);
      for (const b of r.bins) assert.ok((SHAPE_COLORS as string[]).includes(b));
    }
  }
});

test("makeSizeRound: 300 轮目标正确", () => {
  const rand = seeded(7);
  for (let i = 0; i < 300; i++) {
    const r = makeSizeRound(rand);
    assert.equal(r.mode, "size");
    const sizes = r.bins.map(Number);
    assert.equal(new Set(sizes).size, 3);
    const answer = sizes[r.answerIndex];
    if (r.goal === "big") assert.equal(answer, Math.max(...sizes));
    else assert.equal(answer, Math.min(...sizes));
  }
});

test("makeSidesRound: 300 轮边数正确", () => {
  const rand = seeded(99);
  for (let i = 0; i < 300; i++) {
    const r = makeSidesRound(rand);
    assert.equal(r.mode, "sides");
    assert.ok(SIDED_SHAPES.includes(r.shape), `数边题形状: ${r.shape}`);
    const answer = Number(r.bins[r.answerIndex]);
    assert.equal(answer, SHAPE_SIDES[r.shape]);
    assert.equal(new Set(r.bins).size, 3);
  }
});

test("makeRoundForLevel: 各关题型符合设计", () => {
  const rand = seeded(5);
  for (let i = 0; i < 200; i++) {
    assert.equal(makeRoundForLevel(1, rand).mode, "shape");
    assert.equal(makeRoundForLevel(2, rand).mode, "color");
    assert.equal(makeRoundForLevel(3, rand).mode, "size");
    assert.equal(makeRoundForLevel(4, rand).mode, "sides");
    const mix = makeRoundForLevel(5, rand);
    assert.ok(["shape", "color", "size", "sides"].includes(mix.mode));
  }
});

// --- 1.1 新增：第 100–188 关用到的纯逻辑 ---

test("周长与面积：长方形、直角三角形、缺角 L 形", () => {
  assert.equal(rectPerimeter(8, 5), 26);
  assert.equal(rectArea(8, 5), 40);
  assert.equal(triangleArea(6, 4), 12);
  assert.equal(triangleArea(5, 4), 10);
  // 缺一个角：面积变小，周长不变
  assert.equal(lShapeArea(6, 4, 2, 1), 22);
  assert.equal(lShapePerimeter(6, 4), rectPerimeter(6, 4));
  for (let w = 3; w <= 10; w++) {
    for (let h = 2; h <= 8; h++) {
      assert.equal(lShapePerimeter(w, h), 2 * (w + h));
      assert.ok(lShapeArea(w, h, 1, 1) < rectArea(w, h));
    }
  }
});

test("对称轴表：圆是无数条，其余都是确定的正整数", () => {
  assert.equal(SYMMETRY_AXES.circle, -1);
  assert.equal(SYMMETRY_AXES.square, 4);
  assert.equal(SYMMETRY_AXES.rectangle, 2);
  assert.equal(SYMMETRY_AXES.star, 5);
  assert.equal(SYMMETRY_AXES.pentagon, 5);
  assert.ok(!SYMMETRIC_SHAPES.includes("circle"), "圆不该进出题池");
  for (const s of SYMMETRIC_SHAPES) {
    assert.ok(SYMMETRY_AXES[s] >= 1, `${s} 的对称轴条数要是正整数`);
    assert.ok(SHAPE_KINDS.includes(s));
  }
});

test("rotateCells：转四次回到原样，转两次等于上下左右都翻", () => {
  const size = 3;
  const cells = keyCells("110010001");
  assert.equal(cellsKey(rotateCells(cells, size, 4)), cellsKey(cells));
  assert.equal(cellsKey(rotateCells(cells, size, 0)), cellsKey(cells));
  assert.equal(
    cellsKey(rotateCells(rotateCells(cells, size, 1), size, 1)),
    cellsKey(rotateCells(cells, size, 2))
  );
  // 顺时针 90°：第一行会变成最后一列
  assert.equal(cellsKey(rotateCells(keyCells("100000000"), 3, 1)), "001000000");
});

test("mirrorCellsH：照两次镜子回到原样", () => {
  const cells = keyCells("1100100010000110");
  assert.equal(cellsKey(mirrorCellsH(mirrorCellsH(cells, 4), 4)), cellsKey(cells));
  assert.equal(cellsKey(mirrorCellsH(keyCells("100000000"), 3)), "001000000");
});

test("cellsKey / keyCells 来回转换一致", () => {
  for (const key of ["000", "101", "110010001", "1100100010000110"]) {
    assert.equal(cellsKey(keyCells(key)), key);
  }
});

test("立体图形表：面棱顶点齐全，多面体满足欧拉公式", () => {
  assert.equal(SOLID_KINDS.length, 8);
  for (const k of SOLID_KINDS) {
    assert.ok(SOLID_NAMES[k].length > 0, `${k} 缺中文名`);
    assert.ok(SOLID_FACES[k] >= 1, `${k} 缺面数`);
    assert.ok(SOLID_NETS[k].length > 0, `${k} 缺展开图描述`);
  }
  for (const k of POLYHEDRA) {
    // 欧拉公式：顶点 − 棱 + 面 = 2
    assert.equal(SOLID_VERTICES[k] - SOLID_EDGES[k] + SOLID_FACES[k], 2, `${k} 不满足欧拉公式`);
  }
  assert.equal(SOLID_FACES.cylinder, 3);
  assert.equal(SOLID_FACES.cone, 2);
  assert.equal(SOLID_FACES.sphere, 1);
});

test("movePoint：按方位一步步走", () => {
  assert.deepEqual(movePoint(2, 1, [{ dir: "右", steps: 3 }, { dir: "上", steps: 2 }]), { x: 5, y: 3 });
  assert.deepEqual(movePoint(5, 5, [{ dir: "左", steps: 2 }, { dir: "下", steps: 4 }]), { x: 3, y: 1 });
  assert.deepEqual(movePoint(3, 3, []), { x: 3, y: 3 });
  assert.equal(DIRECTIONS.length, 4);
  // 走回去一定回到原点
  for (const dir of DIRECTIONS) {
    const back = dir === "右" ? "左" : dir === "左" ? "右" : dir === "上" ? "下" : "上";
    assert.deepEqual(movePoint(3, 3, [{ dir, steps: 2 }, { dir: back, steps: 2 }]), { x: 3, y: 3 });
  }
});

test("formatPoint：坐标写法", () => {
  assert.equal(formatPoint(3, 2), "(3, 2)");
  assert.equal(formatPoint(1, 1), "(1, 1)");
});
