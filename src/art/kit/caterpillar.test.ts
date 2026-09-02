// 毛毛虫圆节链 · kit 单测:纯函数契约 + 记录式画布桩,不碰真 DOM。
import { describe, expect, it } from "vitest";
import {
  CAT_ANTENNA_MIN_HEAD_PX,
  CAT_GOLD,
  CAT_HEAD_R_RATIO,
  CAT_LINK_W_RATIO,
  CAT_TAIL_R_RATIO,
  type CatCell,
  type Chain2D,
  bulgeScale,
  catShade,
  chainCenters,
  drawCaterpillar,
  eyeOffsets,
  linkWidth,
  nodeRadii,
  showAntenna,
} from "./caterpillar";

/** 记录式 2D 画布桩:数每种调用、攒渐变色停,供断言用 */
function stub(): {
  ctx: Chain2D;
  calls: string[];
  nums: number[];
  stops: Set<string>;
  count: (name: string) => number;
} {
  const calls: string[] = [];
  const nums: number[] = [];
  const stops = new Set<string>();
  const log = (name: string, ...args: number[]) => {
    calls.push(name);
    nums.push(...args);
  };
  const ctx: Chain2D = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    globalAlpha: 1,
    beginPath: () => log("beginPath"),
    closePath: () => log("closePath"),
    moveTo: (x, y) => log("moveTo", x, y),
    lineTo: (x, y) => log("lineTo", x, y),
    quadraticCurveTo: (cx, cy, x, y) => log("quadraticCurveTo", cx, cy, x, y),
    arc: (x, y, r) => log("arc", x, y, r),
    ellipse: (x, y, rx, ry) => log("ellipse", x, y, rx, ry),
    fill: () => log("fill"),
    stroke: () => log("stroke"),
    createRadialGradient: (...a) => {
      log("createRadialGradient", ...a);
      return { addColorStop: (_o, c) => stops.add(c) };
    },
  };
  return { ctx, calls, nums, stops, count: (name) => calls.filter((c) => c === name).length };
}

const LOOK = { head: "#8FCB7A", bodyA: "#9FD98B", bodyB: "#B8E39B", shadow: "rgba(90,110,74,.14)" };
const CELL = 26;

function centersOf(cells: CatCell[], t = 1): Array<[number, number]> {
  return chainCenters(cells, cells, CELL, t);
}

describe("art-kit · 圆节链几何契约", () => {
  it("节半径:头 CELL×0.42 → 尾 CELL×0.34,单调不增", () => {
    const r = nodeRadii(8, CELL);
    expect(r).toHaveLength(8);
    expect(r[0]).toBeCloseTo(CELL * CAT_HEAD_R_RATIO, 6);
    expect(r[7]).toBeCloseTo(CELL * CAT_TAIL_R_RATIO, 6);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1]);
  });

  it("节数不足也安全:单节只有头径,零节与负数节返回空数组", () => {
    expect(nodeRadii(1, CELL)).toEqual([CELL * CAT_HEAD_R_RATIO]);
    expect(nodeRadii(0, CELL)).toEqual([]);
    expect(nodeRadii(-3, CELL)).toEqual([]);
  });

  it("胶囊宽 = 较小节径 × 0.9(换算断言)", () => {
    expect(linkWidth(10, 8)).toBeCloseTo(8 * 2 * CAT_LINK_W_RATIO, 6);
    expect(linkWidth(8, 10)).toBeCloseTo(14.4, 6);
    expect(CAT_LINK_W_RATIO).toBe(0.9);
  });

  it("直行时相邻节中心距 ≤ CELL,链不断", () => {
    const cells: CatCell[] = [[6, 5], [5, 5], [4, 5], [3, 5]];
    const prev: CatCell[] = [[5, 5], [4, 5], [3, 5], [2, 5]];
    const pts = chainCenters(cells, prev, CELL, 0.5);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      expect(d).toBeLessThanOrEqual(CELL + 1e-6);
    }
  });

  it("拐角处相邻节中心距 ≤ CELL,链不断", () => {
    const cells: CatCell[] = [[5, 5], [4, 5], [4, 4], [4, 3]];
    const prev: CatCell[] = [[4, 5], [4, 4], [4, 3], [4, 2]];
    for (const t of [0, 0.3, 0.5, 0.8, 1]) {
      const pts = chainCenters(cells, prev, CELL, t);
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        expect(d, `t=${t} 第 ${i} 节`).toBeLessThanOrEqual(CELL + 1e-6);
      }
    }
  });

  it("插值是纯函数:不改 cells / prev,t=0 在上一格、t=1 落当前格", () => {
    const cells: CatCell[] = [[5, 5], [4, 5]];
    const prev: CatCell[] = [[4, 5], [3, 5]];
    const cellsSnap = JSON.stringify(cells);
    const prevSnap = JSON.stringify(prev);
    const at0 = chainCenters(cells, prev, CELL, 0);
    const at1 = chainCenters(cells, prev, CELL, 1);
    expect(JSON.stringify(cells)).toBe(cellsSnap);
    expect(JSON.stringify(prev)).toBe(prevSnap);
    expect(at0[0]).toEqual([(4 + 0.5) * CELL, (5 + 0.5) * CELL]);
    expect(at1[0]).toEqual([(5 + 0.5) * CELL, (5 + 0.5) * CELL]);
  });

  it("穿星门那种大跳(格距 > 1)直接落位当前格,不横穿园子", () => {
    const cells: CatCell[] = [[10, 10]];
    const prev: CatCell[] = [[1, 1]];
    const pts = chainCenters(cells, prev, CELL, 0.5);
    expect(pts[0]).toEqual([(10 + 0.5) * CELL, (10 + 0.5) * CELL]);
  });

  it("眼睛偏移永远朝移动方向(四方向映射)", () => {
    const dirs: CatCell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const dir of dirs) {
      const { left, right } = eyeOffsets(dir, 10);
      for (const [ex, ey] of [left, right]) {
        expect(ex * dir[0] + ey * dir[1], `dir=${dir}`).toBeGreaterThan(0);
      }
    }
  });

  it("头径 < 12px 省略触角,达标就画(阈值分支)", () => {
    expect(CAT_ANTENNA_MIN_HEAD_PX).toBe(12);
    expect(showAntenna(5.9)).toBe(false);
    expect(showAntenna(6)).toBe(true);
    expect(showAntenna(10.92)).toBe(true);
  });

  it("鼓包波:波心倍率 > 1,远处 = 1,没有波 = 1", () => {
    expect(bulgeScale(0, 0)).toBeGreaterThan(1);
    expect(bulgeScale(5, 0)).toBe(1);
    expect(bulgeScale(2, -9)).toBe(1);
    expect(bulgeScale(1, 1)).toBeGreaterThan(bulgeScale(2.2, 1));
  });

  it("catShade:变亮变暗单调,非法输入原样返回不抛", () => {
    expect(catShade("#808080", 0.5)).not.toBe("#808080");
    expect(catShade("#808080", -0.5)).toBe("#404040");
    expect(catShade("不是颜色", 0.3)).toBe("不是颜色");
    expect(catShade("", 0.3)).toBe("");
  });
});

describe("art-kit · 圆节链绘制契约(记录式桩)", () => {
  it("圆节链节数 = 逻辑蛇长:每节一个节圆 + 一粒高光", () => {
    const cells: CatCell[] = [[6, 5], [5, 5], [4, 5], [3, 5], [2, 5]];
    const s = stub();
    drawCaterpillar(s.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0] });
    // 每节一个三停渐变节圆
    expect(s.count("createRadialGradient")).toBe(cells.length);
    // 节圆 + 高光至少 2n 个 arc,眼睛等在其上
    expect(s.count("arc")).toBeGreaterThanOrEqual(cells.length * 2);
    // 胶囊 = n-1 段(直行无大跳)
    expect(s.count("lineTo")).toBe(cells.length - 1);
  });

  it("空链与非法格宽:一笔不画也不抛", () => {
    const s = stub();
    expect(() => drawCaterpillar(s.ctx, { centers: [], cell: CELL, look: LOOK, dir: [1, 0] })).not.toThrow();
    expect(s.calls).toHaveLength(0);
    expect(() =>
      drawCaterpillar(s.ctx, { centers: centersOf([[1, 1]]), cell: Number.NaN, look: LOOK, dir: [1, 0] })
    ).not.toThrow();
  });

  it("绘制坐标里没有 NaN(极端安全)", () => {
    const s = stub();
    drawCaterpillar(s.ctx, {
      centers: centersOf([[3, 3], [2, 3], [1, 3]]),
      cell: CELL,
      look: LOOK,
      dir: [0, -1],
      bulge: 0.5,
      tailWag: 1,
      mouthOpen: true,
    });
    expect(s.nums.some((v) => Number.isNaN(v))).toBe(false);
  });

  it("金闪帧:渐变色停集合被金色接管", () => {
    const cells: CatCell[] = [[4, 4], [3, 4], [2, 4]];
    const plain = stub();
    drawCaterpillar(plain.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0] });
    const gold = stub();
    drawCaterpillar(gold.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0], goldFlash: true });
    expect(gold.stops.has(CAT_GOLD)).toBe(true);
    expect(plain.stops.has(CAT_GOLD)).toBe(false);
  });

  it("张嘴帧与微笑帧的调用序列不同(张嘴是填圆,微笑是描弧)", () => {
    const cells: CatCell[] = [[4, 4], [3, 4]];
    const closed = stub();
    drawCaterpillar(closed.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0] });
    const open = stub();
    drawCaterpillar(open.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0], mouthOpen: true });
    expect(open.calls.join(",")).not.toBe(closed.calls.join(","));
    // 微笑弧多一次 stroke,张嘴多一次 fill
    expect(closed.count("stroke")).toBe(open.count("stroke") + 1);
    expect(open.count("fill")).toBe(closed.count("fill") + 1);
  });

  it("小头(头径 < 12px)省略触角、眼睛保留:恰好少两个球头 arc", () => {
    const cells: CatCell[] = [[4, 4], [3, 4], [2, 4]];
    const big = stub();
    drawCaterpillar(big.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0] });
    const tiny = stub();
    // cell = 13 → 头径 13×0.42×2 ≈ 10.9px < 12px
    drawCaterpillar(tiny.ctx, { centers: chainCenters(cells, cells, 13, 1), cell: 13, look: LOOK, dir: [1, 0] });
    expect(showAntenna(13 * CAT_HEAD_R_RATIO)).toBe(false);
    expect(big.count("arc") - tiny.count("arc")).toBe(2);
    // 眼睛保留:眼白 + 黑瞳 + 眼神光 ×2 = 6 个 arc 以上仍在
    expect(tiny.count("arc")).toBeGreaterThanOrEqual(cells.length * 2 + 6);
  });

  it("摆尾两帧:tailWag ±1 画出的尾尖坐标不同,0 相同可复现", () => {
    const cells: CatCell[] = [[4, 4], [3, 4], [2, 4]];
    const a = stub();
    drawCaterpillar(a.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0], tailWag: 1 });
    const b = stub();
    drawCaterpillar(b.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0], tailWag: -1 });
    const c = stub();
    drawCaterpillar(c.ctx, { centers: centersOf(cells), cell: CELL, look: LOOK, dir: [1, 0], tailWag: 1 });
    expect(a.nums.join(",")).not.toBe(b.nums.join(","));
    expect(a.nums.join(",")).toBe(c.nums.join(","));
  });

  it("穿门大跳的那一段不补胶囊(不横穿园子)", () => {
    // 头在 (10,4),第二节在 (1,4):格距 9,不该有胶囊连线
    const centers = chainCenters([[10, 4], [1, 4]], [[10, 4], [1, 4]], CELL, 1);
    const s = stub();
    drawCaterpillar(s.ctx, { centers, cell: CELL, look: LOOK, dir: [1, 0] });
    expect(s.count("lineTo")).toBe(0);
  });
});
