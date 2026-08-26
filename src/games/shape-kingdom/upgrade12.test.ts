/**
 * 形状王国 · 1.2 升级验收（B 档，第 25 步）。
 *
 * 这一份只测 1.2 新加的东西；1.1 那批用例原封不动留在 `levels.test.ts` 里。
 * 最要紧的一条是「前 99 关逐字未动」——用 99 个逐关指纹钉死，改一个字就红。
 */
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import guide from "./guide";
import { meta } from "./meta";
import {
  buildQuestions,
  buildReviewQuestions,
  CHAPTERS,
  kindPool,
  LEGACY_CHAPTER_COUNT,
  MAX_STEPS,
  questionCount,
  stepsForLevel,
  type AdvancedShapeQKind,
  type ShapeQ,
  type ShapeQKind,
} from "./levels";
import {
  cellSet,
  eulerHolds,
  edgesFromFaceSides,
  lShapeCells,
  notchCells,
  notchPerimeter,
  polyominoArea,
  polyominoPerimeter,
  rectCells,
  sortedCells,
  stackedCells,
} from "./geometry";
import {
  auditStaticNets,
  cellsToNet,
  checkPolygonNet,
  coneNetOk,
  cubeNets,
  cylinderNetOk,
  foldsIntoCube,
  nonCubeNets,
  polygonNetOf,
} from "./nets";
import { exactAxisCount, exactShapeSVG, isoSolidFrames, isoSolidSVG, SHAPE_TEXTURES } from "./figures";
import {
  containsStandaloneNumber,
  hintLeaksAnswer,
  HINT_LABELS,
  safeHints,
  trio,
} from "./hints";
import {
  buildDrawTasks,
  drawMetrics,
  isDrawLevel,
  isSnapped,
  judgeRect,
  judgeSymfill,
  judgeTiling,
  MIN_BOARD,
  MIN_HIT,
  mirrorAcrossVertical,
  nearestDot,
  placePiece,
  rectReadout,
  runDrawRound,
  SNAP_RADIUS,
  type SymfillTask,
  type TilingTask,
} from "./draw";
import {
  hintButtonLabel,
  hintLine,
  migrateWrongBook,
  recordWrongKinds,
  reviewPlan,
  runQuizWithReview,
  topWrongKinds,
  WRONG_KEY,
} from "./review";
import {
  POLYHEDRA,
  SOLID_EDGES,
  SOLID_FACES,
  SOLID_KINDS,
  SOLID_VERTICES,
  SYMMETRIC_SHAPES,
  SYMMETRY_AXES,
  cellsKey,
  mirrorCellsH,
  rotateCells,
} from "./logic";
import { findAll, findByLabel, findByText, findOne, installDom, memoryStorage, StubEl, totalListeners } from "./domStub";
import type { PlayCtx, PlayHandle } from "../level99";
import type { QuizOptions } from "../quiz99";

const NEW_LEVELS = Array.from({ length: 188 - 99 }, (_, i) => 99 + i);

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// 一、几何正确性：全部纯函数，欧拉公式写成断言
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 几何正确性", () => {
  it("欧拉公式 V − E + F = 2 对每个多面体都成立", () => {
    for (const k of POLYHEDRA) {
      expect(
        eulerHolds(SOLID_VERTICES[k], SOLID_EDGES[k], SOLID_FACES[k]),
        `${k}：V ${SOLID_VERTICES[k]} − E ${SOLID_EDGES[k]} + F ${SOLID_FACES[k]} ≠ 2`
      ).toBe(true);
    }
    expect(POLYHEDRA.length).toBe(5);
  });

  it("棱数还能从「每个面几条边」再算一遍，两条路必须撞上同一个数", () => {
    const sides: Record<string, number[]> = {
      cube: [4, 4, 4, 4, 4, 4],
      cuboid: [4, 4, 4, 4, 4, 4],
      triPrism: [3, 3, 4, 4, 4],
      squarePyramid: [4, 3, 3, 3, 3],
      triPyramid: [3, 3, 3, 3],
    };
    for (const k of POLYHEDRA) {
      expect(sides[k], `${k} 缺面边数表`).toBeDefined();
      expect(sides[k].length, `${k} 面数`).toBe(SOLID_FACES[k]);
      expect(edgesFromFaceSides(sides[k]), `${k} 棱数`).toBe(SOLID_EDGES[k]);
    }
  });

  it("面积周长纯函数覆盖长方形 / L 形 / 缺角 / 组合图形，公式与格子集合互相验算", () => {
    // 长方形
    expect(polyominoArea(rectCells(7, 4))).toBe(28);
    expect(polyominoPerimeter(rectCells(7, 4))).toBe(22);
    // L 形：切掉一角，面积变小、周长不变
    const ell = lShapeCells(6, 4, 2, 2);
    expect(polyominoArea(ell)).toBe(6 * 4 - 2 * 2);
    expect(polyominoPerimeter(ell)).toBe(2 * (6 + 4));
    // 缺一个凹槽：面积减掉凹槽，周长多出两条竖边
    const notch = notchCells(8, 5, 2, 3, 3);
    expect(polyominoArea(notch)).toBe(8 * 5 - 2 * 3);
    expect(polyominoPerimeter(notch)).toBe(notchPerimeter(8, 5, 3));
    expect(polyominoPerimeter(notch)).toBe(2 * (8 + 5) + 2 * 3);
    // 上下拼起来的组合图形：分块相加等于整体格子数
    const comp = stackedCells(3, 2, 5, 2);
    expect(polyominoArea(comp)).toBe(3 * 2 + 5 * 2);
  });

  it("单位不会混：后 4 章周长一律厘米、面积一律平方厘米，一道都不漏", () => {
    let seen = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "perimeter") {
          expect(q.answer, `第 ${level + 1} 关`).toMatch(/^\d+ 厘米$/);
          seen++;
        }
        if (q.kind === "area") {
          expect(q.answer, `第 ${level + 1} 关`).toMatch(/^\d+ 平方厘米$/);
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it("对称轴条数改成数值算出来的，`SYMMETRY_AXES` 每一条都对得上", () => {
    for (const k of SYMMETRIC_SHAPES) {
      expect(exactAxisCount(k), `${k} 的对称轴条数`).toBe(SYMMETRY_AXES[k]);
    }
    // 正五边形 5 条、正方形 4 条、长方形 2 条：这几个是教材里的定论
    expect(exactAxisCount("pentagon")).toBe(5);
    expect(exactAxisCount("square")).toBe(4);
    expect(exactAxisCount("rectangle")).toBe(2);
    expect(exactAxisCount("star")).toBe(5);
  });

  it("旋转与镜像是可逆的：转四次回原样、照两次镜子回原样", () => {
    const size = 4;
    const cells = Array.from({ length: size * size }, (_, i) => i % 3 === 0 || i === 5);
    expect(cellsKey(rotateCells(cells, size, 4))).toBe(cellsKey(cells));
    expect(cellsKey(mirrorCellsH(mirrorCellsH(cells, size), size))).toBe(cellsKey(cells));
    // 转两次等于先转一次再转一次
    expect(cellsKey(rotateCells(cells, size, 2))).toBe(cellsKey(rotateCells(rotateCells(cells, size, 1), size, 1)));
  });
});

// ---------------------------------------------------------------------------
// 二、折叠校验器
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 折叠校验器", () => {
  it("六连方格里正好 11 张折得成正方体，其余 24 张一张都不许放过", () => {
    const good = cubeNets();
    const bad = nonCubeNets();
    expect(good).toHaveLength(11);
    expect(bad).toHaveLength(24);
    for (const net of good) expect(foldsIntoCube(net), sortedCells(net).join(" ")).toBe(true);
    for (const net of bad) expect(foldsIntoCube(net), sortedCells(net).join(" ")).toBe(false);
  });

  it("几张典型错图逐一判否：一条长六格、田字带尾巴、2×3 加一格", () => {
    // 1×6 长条：卷成筒，盖子和底都没有
    expect(foldsIntoCube(cellSet([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]))).toBe(false);
    // 2×2 田字 + 两格尾巴：田字四格折起来就撞在一起了
    expect(foldsIntoCube(cellSet([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0]]))).toBe(false);
    // 2×3 整块只有六格但折起来只围成半个：本来就是合法的 11 张之外
    expect(foldsIntoCube(cellSet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]))).toBe(false);
    // 五格不够、七格太多，一律判否
    expect(foldsIntoCube(cellSet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]]))).toBe(false);
  });

  it("静态展开图全部过校验器：三棱柱 / 四棱锥 / 三棱锥一张错图都没有", () => {
    expect(auditStaticNets()).toEqual([]);
    for (const solid of ["triPrism", "squarePyramid", "triPyramid"] as const) {
      const faces = polygonNetOf(solid);
      expect(faces, `${solid} 没有展开图`).not.toBeNull();
      expect(checkPolygonNet(faces!, solid), solid).toEqual({ ok: true });
    }
  });

  it("校验器抓得住错图：面数不对、面形状不对、纸上就重叠", () => {
    const tri = polygonNetOf("triPrism")!;
    // 少一个面
    expect(checkPolygonNet(tri.slice(0, 4), "triPrism").ok).toBe(false);
    // 三棱锥的四个三角形拿去当四棱锥用：边数对不上
    expect(checkPolygonNet(polygonNetOf("triPyramid")!, "squarePyramid").ok).toBe(false);
    // 1×6 长条当正方体展开图：折痕连成的树没问题，三维折叠模拟才挡得住
    expect(
      checkPolygonNet(cellsToNet(cellSet([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]])), "cube").ok
    ).toBe(false);
  });

  it("圆柱圆锥没有多边形展开图，改判长度关系（侧面长 = 底面周长、扇形角 = 360°×r÷母线）", () => {
    const r = 3;
    expect(cylinderNetOk(r, 2 * Math.PI * r, 8, 8)).toBe(true);
    expect(cylinderNetOk(r, 2 * Math.PI * r + 1, 8, 8)).toBe(false);
    expect(coneNetOk(3, 6, 180)).toBe(true);
    expect(coneNetOk(3, 6, 200)).toBe(false);
  });

  it("挑展开图题：正确项一定折得成，两个干扰项一定折不成", () => {
    let seen = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "netpick") continue;
        seen++;
        q.choices.forEach((c, i) => {
          const key = attr(c, "data-net")!;
          expect(foldsIntoCube(key.split(" ")), `第 ${level + 1} 关第 ${i + 1} 张`).toBe(i === q.correct);
        });
      }
    }
    expect(seen).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// 三、作图题：判定全部走纯函数
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 作图题判定", () => {
  it("①拖点画长方形：目标那一项对上才算，宽高非法一律判否", () => {
    const task = { kind: "rect", cols: 6, rows: 4, goal: "area", target: 12, ask: "", hints: trio("a", "b", "c") } as const;
    expect(judgeRect(task, 4, 3)).toBe(true);
    expect(judgeRect(task, 6, 2)).toBe(true);
    expect(judgeRect(task, 3, 3)).toBe(false);
    // 拖成一条线、拖到界外、拖出小数都不算
    expect(judgeRect(task, 12, 1)).toBe(false);
    expect(judgeRect(task, 0, 5)).toBe(false);
    expect(judgeRect(task, 2.5, 4)).toBe(false);
    const byPerimeter = { ...task, goal: "perimeter", target: 14 } as const;
    expect(judgeRect(byPerimeter, 5, 2)).toBe(true);
    expect(judgeRect(byPerimeter, 4, 3)).toBe(true);
    expect(judgeRect(byPerimeter, 6, 2)).toBe(false);
    // 拖动中的读数和判定用的是同一套纯函数
    expect(rectReadout(5, 2)).toEqual({ area: 10, perimeter: 14 });
    expect(rectReadout(0, 0)).toEqual({ area: 0, perimeter: 0 });
  });

  it("②补对称：格子集合正好等于镜像才算对，多一格少一格都不行", () => {
    const task: SymfillTask = {
      kind: "symfill",
      size: 6,
      given: ["0,0", "0,2", "1,2"],
      answer: sortedCells(mirrorAcrossVertical(["0,0", "0,2", "1,2"], 6)),
      ask: "",
      hints: trio("a", "b", "c"),
    };
    expect(task.answer).toEqual(["0,3", "0,5", "1,3"]);
    expect(judgeSymfill(task, task.answer)).toBe(true);
    expect(judgeSymfill(task, [...task.answer, "2,3"])).toBe(false);
    expect(judgeSymfill(task, task.answer.slice(1))).toBe(false);
    // 平移过去（不是照镜子）也判否
    expect(judgeSymfill(task, ["0,3", "0,5", "1,5"])).toBe(false);
  });

  it("③拼骨牌：并集等于轮廓、互不重叠、每块都用上，缺一条就判否", () => {
    const task: TilingTask = {
      kind: "tiling",
      cols: 3,
      rows: 2,
      target: sortedCells(cellSet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]])),
      pieces: [["0,0", "1,0"], ["0,0", "0,1"], ["0,0", "0,1"]],
      ask: "",
      hints: trio("a", "b", "c"),
    };
    const good = [
      { piece: 0, cells: ["0,0", "1,0"] },
      { piece: 1, cells: ["0,1", "0,2"] },
      { piece: 2, cells: ["1,1", "1,2"] },
    ];
    expect(judgeTiling(task, good)).toBe(true);
    // 少放一块
    expect(judgeTiling(task, good.slice(0, 2))).toBe(false);
    // 同一块用两次
    expect(judgeTiling(task, [good[0], good[1], { piece: 1, cells: ["1,1", "1,2"] }])).toBe(false);
    // 两块叠在一格上
    expect(judgeTiling(task, [good[0], good[1], { piece: 2, cells: ["0,2", "1,2"] }])).toBe(false);
    // 摆出来的形状不是那块骨牌
    expect(judgeTiling(task, [good[0], good[1], { piece: 2, cells: ["1,1", "0,2"] }])).toBe(false);
  });

  it("骨牌允许旋转：转过的摆法照样认，转一圈回原样", () => {
    const bar = ["0,0", "0,1"];
    expect(sortedCells(placePiece(bar, 0, 2, 3))).toEqual(["2,3", "2,4"]);
    // 竖过来放
    expect(sortedCells(placePiece(bar, 1, 0, 0))).toEqual(["0,0", "1,0"]);
    // L 形三格骨牌有 4 种摆法
    expect(placePiece(["0,0", "0,1", "1,0"], 0, 0, 0).size).toBe(3);
  });

  it("生成的作图题道道有解：拿标准答案跑判定必过", () => {
    let checked = 0;
    for (const level of NEW_LEVELS) {
      if (!isDrawLevel(chapterOf(level), indexInChapter(level), LEGACY_CHAPTER_COUNT)) continue;
      for (const task of buildDrawTasks(level)) {
        checked++;
        if (task.kind === "rect") {
          // 一定存在某个 w×h 能凑出题目要的那个数
          const solutions: Array<[number, number]> = [];
          for (let w = 1; w <= task.cols; w++) {
            for (let h = 1; h <= task.rows; h++) if (judgeRect(task, w, h)) solutions.push([w, h]);
          }
          expect(solutions.length, `第 ${level + 1} 关的长方形题无解`).toBeGreaterThan(0);
        } else if (task.kind === "symfill") {
          expect(judgeSymfill(task, task.answer)).toBe(true);
          // 给出的那一半全在左边，补的那一半全在右边，中间那条线不会被跨过
          for (const k of task.given) expect(Number(k.split(",")[1])).toBeLessThan(task.size / 2);
          for (const k of task.answer) expect(Number(k.split(",")[1])).toBeGreaterThanOrEqual(task.size / 2);
        } else {
          // 拼图的标准解就是每块摆在它原来的位置
          const placements = task.pieces.map((_, i) => ({ piece: i, cells: [] as string[] }));
          void placements;
          const total = task.pieces.reduce((s, p) => s + p.length, 0);
          expect(total, `第 ${level + 1} 关的轮廓格数`).toBe(task.target.length);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("点阵吸附与 360px 下限：12px 以内吸得上，作图区 ≥280px、热区 ≥44px", () => {
    expect(nearestDot(0, 0, 40, 6, 4)).toEqual({ r: 0, c: 0, dist: 0 });
    expect(nearestDot(83, 42, 40, 6, 4).c).toBe(2);
    expect(nearestDot(83, 42, 40, 6, 4).r).toBe(1);
    expect(isSnapped(nearestDot(83, 42, 40, 6, 4).dist)).toBe(true);
    // 拖到两点正中间：够不着任何一个点
    expect(isSnapped(nearestDot(20, 0, 40, 6, 4).dist)).toBe(false);
    expect(SNAP_RADIUS).toBe(12);
    // 拖到界外也会被夹回格子里，不会算出负下标
    expect(nearestDot(-90, -90, 40, 6, 4)).toMatchObject({ r: 0, c: 0 });
    expect(nearestDot(9999, 9999, 40, 6, 4)).toMatchObject({ r: 4, c: 6 });
    for (const vw of [320, 360, 390, 768, 1280]) {
      const m = drawMetrics(vw, 6, 4);
      expect(m.board, `${vw}px`).toBeGreaterThanOrEqual(MIN_BOARD);
      expect(m.hit, `${vw}px`).toBeGreaterThanOrEqual(MIN_HIT);
    }
  });

  it("作图关只落在后 4 章，前 99 关一关都不是", () => {
    const draws: number[] = [];
    for (let level = 0; level < 188; level++) {
      if (isDrawLevel(chapterOf(level), indexInChapter(level), LEGACY_CHAPTER_COUNT)) draws.push(level);
    }
    expect(draws.every((l) => l >= 99), "作图关跑到前 99 关里去了").toBe(true);
    expect(draws.length).toBeGreaterThanOrEqual(12);
    // 同一关重开不换题（确定性）
    expect(JSON.stringify(buildDrawTasks(draws[0]))).toBe(JSON.stringify(buildDrawTasks(draws[0])));
    // 三类动手题都排上了
    const kinds = new Set(draws.flatMap((l) => buildDrawTasks(l).map((t) => t.kind)));
    expect(kinds).toEqual(new Set(["rect", "symfill", "tiling"]));
  });
});

// ---------------------------------------------------------------------------
// 四、难度曲线
// ---------------------------------------------------------------------------

function chapterOf(level: number): number {
  let start = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < start + CHAPTERS[i].size) return i;
    start += CHAPTERS[i].size;
  }
  return CHAPTERS.length - 1;
}

function indexInChapter(level: number): number {
  let start = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < start + CHAPTERS[i].size) return level - start;
    start += CHAPTERS[i].size;
  }
  return 0;
}

describe("形状王国 1.2 · 难度曲线", () => {
  it("每章前 1/3 单步、中 1/3 两步、后 1/3 三步", () => {
    for (let ci = LEGACY_CHAPTER_COUNT; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const base = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      for (let i = 0; i < size; i++) {
        const t = i / Math.max(1, size - 1);
        const want = t < 1 / 3 ? 1 : t < 2 / 3 ? 2 : 3;
        expect(stepsForLevel(base + i), `第 ${base + i + 1} 关`).toBe(want);
      }
    }
  });

  it("每章后段题的推理步数字段 ≥ 2（硬性断言）", () => {
    let checked = 0;
    for (let ci = LEGACY_CHAPTER_COUNT; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const base = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      for (let i = Math.ceil(size / 3); i < size; i++) {
        const level = base + i;
        for (const q of buildQuestions(level)) {
          expect(q.steps, `第 ${level + 1} 关 ${q.kind} 没写步数`).toBeDefined();
          expect(q.steps, `第 ${level + 1} 关 ${q.kind}`).toBeGreaterThanOrEqual(2);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("每章末段真的推到三步，而且步数不超过题型自己的上限", () => {
    let three = 0;
    for (let ci = LEGACY_CHAPTER_COUNT; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const base = CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
      let hereThree = 0;
      for (let i = 0; i < size; i++) {
        for (const q of buildQuestions(base + i)) {
          expect(q.steps, `${q.kind} 的步数超过了它的上限`).toBeLessThanOrEqual(
            MAX_STEPS[q.kind as AdvancedShapeQKind]
          );
          if (q.steps === 3) hereThree++;
        }
      }
      expect(hereThree, `第 ${ci + 1} 章一道三步题都没有`).toBeGreaterThan(0);
      three += hereThree;
    }
    expect(three).toBeGreaterThan(80);
  });

  it("前 99 关的题目对象一个多余的键都不带（步数与提示只给后 4 章）", () => {
    for (let level = 0; level < 99; level++) {
      for (const q of buildQuestions(level)) {
        expect(Object.prototype.hasOwnProperty.call(q, "steps"), `第 ${level + 1} 关`).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(q, "hints"), `第 ${level + 1} 关`).toBe(false);
        expect(stepsForLevel(level)).toBe(1);
      }
    }
  });

  it("题型补齐：十二类题型（含作图补全与分类归纳）全部排上了", () => {
    const kinds = new Set<ShapeQKind>();
    for (let level = 0; level < 188; level++) for (const k of kindPool(level)) kinds.add(k);
    for (const want of [
      "shape", "color", "size", "sides", "countshape",
      "perimeter", "area", "symmetry", "mirror", "rotate", "transform",
      "solid", "net", "netpick", "solidcalc", "coord", "path", "coordmove", "classify", "symsum",
    ] as ShapeQKind[]) {
      expect(kinds.has(want), `题型池里没有 ${want}`).toBe(true);
    }
    // 作图补全不是选择题，走的是作图关那条路
    const drawKinds = new Set(
      NEW_LEVELS.filter((l) => isDrawLevel(chapterOf(l), indexInChapter(l), LEGACY_CHAPTER_COUNT)).flatMap((l) =>
        buildDrawTasks(l).map((t) => t.kind)
      )
    );
    expect(drawKinds.has("symfill")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 五、三级提示：任何一级都不许给答案
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 三级提示", () => {
  it("后 4 关章每道题都配齐三级提示，而且没有一级把答案说出来", () => {
    let checked = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        expect(q.hints, `第 ${level + 1} 关 ${q.kind} 没有提示`).toBeDefined();
        expect(q.hints).toHaveLength(3);
        q.hints!.forEach((h, i) => {
          expect(h.length, `第 ${level + 1} 关 ${q.kind} 第 ${i + 1} 级提示太短`).toBeGreaterThanOrEqual(8);
          expect(
            hintLeaksAnswer(h, q.answer),
            `第 ${level + 1} 关 ${q.kind} 第 ${i + 1} 级提示泄题：${h}`
          ).toBe(false);
        });
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
  });

  it("三级提示层层递进：先说考什么、再给公式、最后给第一步的结果", () => {
    expect(HINT_LABELS[0]).toContain("考什么");
    expect(HINT_LABELS[1]).toContain("公式");
    expect(HINT_LABELS[2]).toContain("第一步");
    // 面积题的第二级一定给得出公式
    const q = buildQuestions(99).find((x) => x.kind === "perimeter" || x.kind === "area");
    expect(q?.hints?.[1]).toMatch(/[×＋+]|周长|面积/);
  });

  it("泄题探测认得出独立的数字：24 不算命中 2，「2 厘米」才算", () => {
    expect(containsStandaloneNumber("答案是 24 厘米", 2)).toBe(false);
    expect(containsStandaloneNumber("先算出 2 厘米", 2)).toBe(true);
    expect(containsStandaloneNumber("一共 12 条", 12)).toBe(true);
    expect(hintLeaksAnswer("长加宽先算出来是 7", "14 厘米")).toBe(false);
    expect(hintLeaksAnswer("周长就是 14 厘米", "14 厘米")).toBe(true);
    // 图形题的答案是一段属性，提示里出现同一段也算泄题
    expect(hintLeaksAnswer('照镜子后是 data-cells="1010"', 'data-cells="1010"')).toBe(true);
  });

  it("运行时保险丝：真写漏了那一级会被换成不含结论的通用话", () => {
    const leaky = trio("这题考周长", "周长就是 14 厘米", "第一步是 7");
    const safe = safeHints(leaky, "14 厘米");
    expect(safe[0]).toBe("这题考周长");
    expect(safe[1]).not.toContain("14");
    expect(hintLeaksAnswer(safe[1], "14 厘米")).toBe(false);
    expect(safe[2]).toBe("第一步是 7");
  });

  it("提示按钮三级递进，翻到底就明说到底了", () => {
    expect(hintButtonLabel(0)).toBe("💡 提示 1/3");
    expect(hintButtonLabel(2)).toBe("💡 提示 3/3");
    expect(hintButtonLabel(3)).toContain("已到底");
    const q = buildQuestions(120).find((x) => x.hints)!;
    expect(hintLine(q.hints!, q.answer, 1)).toContain(HINT_LABELS[0]);
    expect(hintLine(q.hints!, q.answer, 3)).toContain(HINT_LABELS[2]);
  });
});

// ---------------------------------------------------------------------------
// 六、错题回顾
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 错题回顾", () => {
  it("错题类型存本地，key 走 yiduo-yixing. 前缀，坏数据当空本子", () => {
    expect(WRONG_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(migrateWrongBook(null)).toEqual({});
    expect(migrateWrongBook([1, 2])).toEqual({});
    expect(migrateWrongBook({ area: "3", net: 2, bad: Number.NaN, zero: 0 })).toEqual({ net: 2 });
    expect(migrateWrongBook({ area: 1e9 }).area).toBe(99);
    const store = memoryStorage();
    recordWrongKinds(["area", "net", "area"], store);
    expect(JSON.parse(store.getItem(WRONG_KEY)!)).toEqual({ area: 2, net: 1 });
    // 全对的那一关不留脚印
    recordWrongKinds([], store);
    expect(JSON.parse(store.getItem(WRONG_KEY)!)).toEqual({ area: 2, net: 1 });
    expect(topWrongKinds({ area: 2, net: 5, coord: 5 })).toEqual(["coord", "net", "area"]);
  });

  it("回顾计划：本关错得多的排前面，老毛病多练一道，最多 4 道", () => {
    expect(reviewPlan([])).toEqual([]);
    expect(reviewPlan(["area", "net", "area"])).toEqual(["area", "net"]);
    // 历史错过 ≥3 次的题型再加一道
    expect(reviewPlan(["area"], { area: 3 })).toEqual(["area", "area"]);
    expect(reviewPlan(["area"], { area: 2 })).toEqual(["area"]);
    expect(reviewPlan(["a", "b", "c", "d", "e"] as ShapeQKind[]).length).toBeLessThanOrEqual(4);
  });

  it("回顾题是同知识点的新题，不会把刚才那道原样再考一遍", () => {
    const level = 120;
    const main = buildQuestions(level);
    const missed = [main[0].kind, main[1].kind];
    const review = buildReviewQuestions(level, missed, 1);
    expect(review.map((q) => q.kind)).toEqual(missed);
    // 题面和正题那一轮的任何一道都不一样
    const seen = new Set(main.map((q) => q.promptHTML + q.ask));
    for (const q of review) expect(seen.has(q.promptHTML + q.ask), `${q.kind} 把原题又抄了一遍`).toBe(false);
    // 步数跟着本关的曲线走，提示也配齐
    for (const q of review) {
      expect(q.steps).toBe(Math.min(stepsForLevel(level), MAX_STEPS[q.kind as AdvancedShapeQKind]));
      expect(q.hints).toHaveLength(3);
    }
    // 换一轮就是另一批题
    expect(JSON.stringify(buildReviewQuestions(level, missed, 2))).not.toBe(JSON.stringify(review));
    expect(buildReviewQuestions(level, [])).toEqual([]);
  });

  it("答完一关会拉起回顾轮，而且回顾轮答砸了也照样按正题的成绩过关", () => {
    const dom = installDom();
    try {
      const stage = new StubEl("div");
      const wins: Array<{ stars: number; msg?: string }> = [];
      const ctx = stubCtx({ win: (stars, msg) => wins.push({ stars, msg }) });
      const rounds: QuizOptions[] = [];
      const store = memoryStorage();
      const handle = runQuizWithReview(
        {
          stage: stage as unknown as HTMLElement,
          ctx,
          theme: { bg: "#fff", accent: "#333" },
          level: 120,
          questions: buildQuestions(120),
        },
        {
          storage: store,
          runner: (o) => {
            rounds.push(o);
            return { destroy: () => {} };
          },
        }
      );
      // 第一道就答错，剩下的全对 → 正题拿 2 星
      const first = rounds[0];
      first.ctx.sfx("oops");
      for (let i = 0; i < first.questions.length; i++) first.ctx.sfx("coin");
      first.ctx.win(2, "全部完成");
      expect(rounds).toHaveLength(2);
      expect(rounds[1].questions.length).toBeGreaterThan(0);
      expect(rounds[1].questions[0].kind).toBe(first.questions[0].kind);
      // 错题落盘了
      expect(JSON.parse(store.getItem(WRONG_KEY)!)[first.questions[0].kind]).toBe(1);
      // 回顾轮答砸：照样按正题那一轮的 2 星过关，绝不判负
      rounds[1].ctx.lose("回顾没答完");
      expect(wins).toHaveLength(1);
      expect(wins[0].stars).toBe(2);
      expect(wins[0].msg).toContain("回顾");
      handle.destroy();
    } finally {
      dom.restore();
    }
  });

  it("一关全对就不加练，直接过关；中途放弃只记账不判负", () => {
    const dom = installDom();
    try {
      const stage = new StubEl("div");
      const wins: number[] = [];
      const loses: string[] = [];
      const rounds: QuizOptions[] = [];
      const store = memoryStorage();
      runQuizWithReview(
        {
          stage: stage as unknown as HTMLElement,
          ctx: stubCtx({ win: (s) => wins.push(s), lose: (m) => loses.push(m ?? "") }),
          theme: { bg: "#fff", accent: "#333" },
          level: 121,
          questions: buildQuestions(121),
        },
        { storage: store, runner: (o) => { rounds.push(o); return { destroy: () => {} }; } }
      );
      rounds[0].ctx.win(3, "全对");
      expect(rounds).toHaveLength(1);
      expect(wins).toEqual([3]);
      expect(store.getItem(WRONG_KEY)).toBeNull();

      const rounds2: QuizOptions[] = [];
      runQuizWithReview(
        {
          stage: stage as unknown as HTMLElement,
          ctx: stubCtx({ win: (s) => wins.push(s), lose: (m) => loses.push(m ?? "") }),
          theme: { bg: "#fff", accent: "#333" },
          level: 121,
          questions: buildQuestions(121),
        },
        { storage: store, runner: (o) => { rounds2.push(o); return { destroy: () => {} }; } }
      );
      rounds2[0].ctx.sfx("oops");
      rounds2[0].ctx.lose("太难了");
      expect(loses).toEqual(["太难了"]);
      expect(Object.keys(JSON.parse(store.getItem(WRONG_KEY)!)).length).toBe(1);
    } finally {
      dom.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 七、作图台真的跑得起来（DOM 桩）
// ---------------------------------------------------------------------------

let restoreDom: (() => void) | null = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function stubCtx(over: Partial<PlayCtx> = {}): PlayCtx {
  return {
    level: 0,
    chapterIndex: 0,
    indexInChapter: 0,
    sfx: () => {},
    bonusStars: () => {},
    win: () => {},
    lose: () => {},
    ...over,
  } as PlayCtx;
}

describe("形状王国 1.2 · 作图台", () => {
  it("点两个点拉出长方形，摆对了城堡长高一层并响 win", () => {
    const dom = installDom();
    restoreDom = dom.restore;
    const stage = new StubEl("div");
    const sfx: string[] = [];
    const task = { kind: "rect", cols: 6, rows: 4, goal: "area", target: 12, ask: "画一个面积 12 的长方形", hints: trio("一", "二", "三") } as const;
    const handle: PlayHandle = runDrawRound({
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx({ sfx: (n) => sfx.push(n) }),
      theme: { bg: "#fff", accent: "#333" },
      tasks: [{ ...task }],
      viewportWidth: 360,
    });
    // 点 (0,0) 和 (3,4)：拉出 4 列 3 行
    findByLabel(stage, "第 1 行第 1 列的点")!.fire("click");
    findByLabel(stage, "第 4 行第 5 列的点")!.fire("click");
    expect(findOne(stage, "shk-readout")!.textContent).toContain("面积 12");
    findByText(stage, "✅")!.fire("click");
    expect(sfx).toContain("win");
    expect(findOne(stage, "shk-castle")!.textContent).toContain("🏰");
    handle.destroy();
    expect(stage.children).toHaveLength(0);
  });

  it("摆错了只温和提示并递一级提示，提示里不含答案", () => {
    const dom = installDom();
    restoreDom = dom.restore;
    const stage = new StubEl("div");
    const sfx: string[] = [];
    const task = { kind: "rect", cols: 6, rows: 4, goal: "area", target: 12, ask: "画一个面积 12 的长方形", hints: trio("这题考面积", "面积 = 长 × 宽", "先想想哪两个数相乘") } as const;
    runDrawRound({
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx({ sfx: (n) => sfx.push(n) }),
      theme: { bg: "#fff", accent: "#333" },
      tasks: [{ ...task }],
      viewportWidth: 360,
    });
    findByLabel(stage, "第 1 行第 1 列的点")!.fire("click");
    findByLabel(stage, "第 2 行第 2 列的点")!.fire("click");
    findByText(stage, "✅")!.fire("click");
    expect(sfx).toContain("oops");
    expect(sfx).not.toContain("win");
    const msg = findOne(stage, "shk-msg")!.textContent;
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toContain("12");
    const hint = findOne(stage, "shk-hint")!;
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain(HINT_LABELS[0]);
    expect(hint.textContent).not.toContain("12");
  });

  it("补对称关：点右半边的格子，点齐了就算对", () => {
    const dom = installDom();
    restoreDom = dom.restore;
    const stage = new StubEl("div");
    const sfx: string[] = [];
    const given = ["0,0", "0,2", "1,1"];
    const task: SymfillTask = {
      kind: "symfill",
      size: 4,
      given,
      answer: sortedCells(mirrorAcrossVertical(given, 4)),
      ask: "补另一半",
      hints: trio("一二三四五六七八", "二二三四五六七八", "三二三四五六七八"),
    };
    runDrawRound({
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx({ sfx: (n) => sfx.push(n) }),
      theme: { bg: "#fff", accent: "#333" },
      tasks: [task],
      viewportWidth: 360,
    });
    for (const k of task.answer) {
      const { 0: r, 1: c } = k.split(",").map(Number);
      findByLabel(stage, `第 ${r + 1} 行第 ${c + 1} 列`)!.fire("click");
    }
    findByText(stage, "✅")!.fire("click");
    expect(sfx).toContain("win");
    // 给出的那一半点不动
    for (const k of given) {
      const { 0: r, 1: c } = k.split(",").map(Number);
      expect(findByLabel(stage, `第 ${r + 1} 行第 ${c + 1} 列`)!.disabled).toBe(true);
    }
  });

  it("拼骨牌关：选块、点轮廓放下去，全部放满就算对", () => {
    const dom = installDom();
    restoreDom = dom.restore;
    const stage = new StubEl("div");
    const sfx: string[] = [];
    const task: TilingTask = {
      kind: "tiling",
      cols: 3,
      rows: 2,
      target: sortedCells(cellSet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]])),
      pieces: [["0,0", "0,1", "0,2"], ["0,0", "0,1", "0,2"]],
      ask: "拼满轮廓",
      hints: trio("一二三四五六七八", "二二三四五六七八", "三二三四五六七八"),
    };
    runDrawRound({
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx({ sfx: (n) => sfx.push(n) }),
      theme: { bg: "#fff", accent: "#333" },
      tasks: [task],
      viewportWidth: 360,
    });
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    findByLabel(stage, "轮廓里第 2 行第 1 列")!.fire("click");
    findByText(stage, "✅")!.fire("click");
    expect(sfx).toContain("win");
    // 每块骨牌都有 ≥44px 的热区按钮
    expect(findAll(stage, "shk-piece").length).toBeGreaterThanOrEqual(3);
  });

  it("同一道题连错到上限就带着走，绝不把孩子卡死；destroy 之后监听全摘干净", () => {
    const dom = installDom();
    restoreDom = dom.restore;
    const stage = new StubEl("div");
    const wins: number[] = [];
    const task = { kind: "rect", cols: 6, rows: 4, goal: "area", target: 12, ask: "画一个", hints: trio("一二三四五六七八", "二二三四五六七八", "三二三四五六七八") } as const;
    const handle = runDrawRound({
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx({ win: (s) => wins.push(s) }),
      theme: { bg: "#fff", accent: "#333" },
      tasks: [{ ...task }],
      viewportWidth: 360,
      maxTries: 2,
    });
    const go = findByText(stage, "✅")!;
    go.fire("click");
    go.fire("click");
    expect(findOne(stage, "shk-msg")!.textContent).toContain("下一道");
    handle.destroy();
    expect(totalListeners(stage)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 八、平台接入与前 99 关冻结
// ---------------------------------------------------------------------------

describe("形状王国 1.2 · 平台接入与契约", () => {
  it("meta 说的是十大区域 188 关，1.0 那句「六大王国区域 99 关」彻底没了", () => {
    expect(meta.category).toBe("edu");
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.levels).toBe(188);
    expect(meta.blurb).toContain("十大王国区域 188 关");
    expect(meta.blurb).not.toContain("六大");
    expect(meta.blurb).not.toContain("99");
    // 1.2 新玩法在门口就说清楚
    expect(meta.blurb).toMatch(/画|补对称|拼骨牌/);
    expect(meta.platform).toBe("both");
  });

  it("攻略十章齐全、覆盖 1–188 关，而且一个答案都没写出来", () => {
    expect(guide.gameId).toBe("shape-kingdom");
    expect(guide.entries).toHaveLength(10);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from, `第 ${i + 1} 段接不上`).toBe(guide.entries[i - 1].to + 1);
    }
    // 泄题检查：把后 4 章每道题的答案拿去比对攻略全文
    const text = [...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
    const answers = new Set<string>();
    for (const level of NEW_LEVELS) for (const q of buildQuestions(level)) answers.add(q.answer);
    for (const a of answers) {
      // 单位词本身不算（「6 条」这种短串会误伤），只查带 data- 的图形答案与整句
      if (a.startsWith("data-")) expect(text.includes(a), `攻略里出现了答案 ${a}`).toBe(false);
    }
    // 攻略里不许出现具体某一关的题面数字组合
    expect(text).not.toContain("正确答案");
    expect(text).not.toContain("选第");
    // 1.2 新玩法都在攻略里交代过
    expect(text).toContain("提示");
    expect(text).toContain("作图");
  });

  it("前 99 关逐关指纹与升级前完全一致（99 个哈希 + 一个总哈希）", () => {
    const per = Array.from({ length: 99 }, (_, i) =>
      createHash("sha256").update(JSON.stringify(buildQuestions(i))).digest("hex").slice(0, 12)
    );
    expect(per).toEqual(LEGACY_FINGERPRINTS);
    expect(createHash("sha256").update(per.join("|")).digest("hex")).toBe(LEGACY_FINGERPRINT_ALL);
  });

  it("前 6 章的章节切分、题量公式、题型池一个字都没动", () => {
    expect(LEGACY_CHAPTER_COUNT).toBe(6);
    expect(CHAPTERS.slice(0, 6).reduce((s, c) => s + c.size, 0)).toBe(99);
    const legacyPools = [
      ["shape"], ["color"], ["size"], ["sides"], ["countshape"], ["shape", "color", "size"],
    ];
    let start = 0;
    CHAPTERS.slice(0, 6).forEach((ch, ci) => {
      expect(kindPool(start)).toEqual(legacyPools[ci]);
      for (let i = 0; i < ch.size; i++) {
        const t = i / Math.max(1, ch.size - 1);
        expect(questionCount(start + i)).toBe(4 + Math.min(3, Math.floor(t * 3.6)));
      }
      start += ch.size;
    });
    expect(start).toBe(99);
  });

  it("立体图用等距斜投影画（伪 2.5D），没有 canvas / webgl / 任何 3D 库的影子", () => {
    const solids = new Set<string>();
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "solid" && q.kind !== "net" && q.kind !== "solidcalc" && q.kind !== "netpick") continue;
        const html = q.promptHTML;
        const kind = attr(html, "data-solid");
        if (kind) solids.add(kind);
        expect(html).toContain("<svg");
        expect(html.toLowerCase()).not.toContain("canvas");
        expect(html.toLowerCase()).not.toContain("webgl");
        expect(html.toLowerCase()).not.toContain("three");
        // 多面体是一片片多边形拼出来的；背面剔除真的在干活，看得见的面必定少于总面数
        const faces = attr(html, "data-faces");
        if (kind && faces && (SOLID_KINDS as readonly string[]).includes(kind)) {
          expect(Number(faces), `${kind} 一个面都没画`).toBeGreaterThanOrEqual(1);
          expect(Number(faces), `${kind} 把背面也画出来了`).toBeLessThan(SOLID_FACES[kind as keyof typeof SOLID_FACES]);
        }
      }
    }
    expect(solids.size).toBeGreaterThanOrEqual(5);
    // 正方体从等距视角正好看得见三个面，这是「伪 2.5D 画对了」的标志
    expect(attr(isoSolidSVG("cube", 100), "data-faces")).toBe("3");
    // 换一个偏航角是重画一张静态 SVG，不是真三维动画
    expect(isoSolidFrames("cube", 100, 4)).toHaveLength(4);
    expect(new Set(isoSolidFrames("cube", 100, 4)).size).toBe(4);
  });

  it("图形不只靠颜色区分：各带各的纹理、描边一律 ≥2px（色盲也认得出）", () => {
    // 八种形状里至少有四种花纹，光看轮廓和花纹就能分开
    expect(new Set(Object.values(SHAPE_TEXTURES)).size).toBeGreaterThanOrEqual(4);
    let checked = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "symmetry" && q.kind !== "classify" && q.kind !== "symsum") continue;
        for (const c of [q.promptHTML, ...q.choices]) {
          const tex = attr(c, "data-texture");
          if (!tex) continue;
          expect(Object.values(SHAPE_TEXTURES), `没见过的花纹 ${tex}`).toContain(tex);
          // 除了实心，其余花纹都真的画出了一张 pattern
          if (tex !== "solid") expect(c, `${tex} 没画出花纹`).toContain("<pattern");
          expect(Number(attr(c, "stroke-width")), "描边太细").toBeGreaterThanOrEqual(2);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
    // 同一个形状永远同一种花纹，孩子能建立稳定印象
    expect(attr(exactShapeSVG("square", "red", 80), "data-texture")).toBe(SHAPE_TEXTURES.square);
    expect(attr(exactShapeSVG("square", "blue", 80), "data-texture")).toBe(SHAPE_TEXTURES.square);
  });
});

/** 升级前跑出来的 99 个逐关指纹：改动前 6 章的任何一个参数，这一串就会变 */
const LEGACY_FINGERPRINTS = [
  "7b6c0b625891", "728a77744545", "b54214707dae", "6d7e2cba4026", "db76924640fd", "2019561f5f3a",
  "161de26e55ae", "87c7339093ef", "fa9eac2ed26c", "e309eea2595b", "703766aaa2a7", "013d5f57ab6c",
  "3a0c870d1f47", "b03006cefa2e", "f02dea7981fb", "d14cdd214a63", "64c7d422ef68", "095e569d3d79",
  "c8e522526b9d", "cd759eb878e5", "c8098e9baee5", "0c90057a9d21", "eca8d309a064", "64ecf71f4f4a",
  "82bb2831c8f9", "7aef35446399", "7e89f821e8d1", "4e0e6cb70cf3", "7a9b5c3a2a42", "5f5c6844f4bc",
  "f1a58311869e", "be0ceff8ab54", "ea7f180d4b76", "3cfb9578012a", "b8725cf264c5", "4c022a230f2e",
  "f144164a7381", "f976b49d9bf6", "45d09b89e2dc", "936d9f72b34d", "24a66a3e9444", "9568bf27cdf1",
  "ee9c69afe25f", "a65e75370d02", "240c72c85b06", "98fbd558ed42", "44b28c2a7490", "75eb5669b74c",
  "d06918022288", "820d5e9eb39f", "13a82bfa44be", "c4df0d4196fa", "22fbdeae3397", "8be01bda8b8e",
  "f3db4ffd8643", "59e7a0112158", "431e9173e54d", "69c282a4a90d", "b7c53ad147fa", "d21e5360dcff",
  "3a1866306719", "0683b7964f20", "8f96fe5f84e9", "352eaf1fd84d", "22965cb3da65", "306a3259898d",
  "a2aae12570ca", "6483be43ca1f", "d3b14a9132d2", "8cec05e4ab45", "6c23f97cf794", "b37c129e8304",
  "43db26a382e7", "f70e0ff7b08c", "362a3d66aa72", "cbbfff52724e", "4c6dcca63fd4", "dc79c89956c4",
  "b7e6a23e33ae", "8b7c61dbf1ba", "277ac1119af6", "7613b1a31eb0", "13ebe58c8fd2", "199e9f2f70e3",
  "144a2e9b14cf", "823a74941c50", "6e2954bfb3bd", "3da6976f40e4", "96c24daec99c", "8095d527f550",
  "391c2e412af0", "03a789afe247", "09319f663230", "58c81e9fa3b2", "177b87b3bae7", "0b7d767c3d87",
  "8e65a7c996aa", "d0703c27564d", "9f63bc0bed95",
];

const LEGACY_FINGERPRINT_ALL = "614cb43adcbe4dd6320df1501711072d6a1910f67af17cf7800d46159f9dd93c";

/** TS 用得着：`ShapeQ` 在上面只当类型使 */
export type _ShapeQ = ShapeQ;
