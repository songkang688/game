/**
 * 弹道用例(1.2 新增)。
 *
 * 三种弹丸:直线弹、弹力球(反射 1–2 次)、彩纸穿甲弹(破钢)。
 * 反射公式是这一层的心脏,所以「入射角 = 反射角」在这里按角度单测,
 * 预测虚线也在这里钉死:只画第一段反射,不多画。
 */
import { describe, expect, it } from "vitest";
import {
  BOUNCE_TILT,
  PREVIEW_RANGE,
  PREVIEW_TAIL,
  SHELLS,
  SHELL_ORDER,
  angleDeg,
  angleToNormal,
  hitAxis,
  length,
  nextShell,
  previewPath,
  reflect,
  shotVelocity,
  sideways,
  traceShot,
  unit,
  type BlockedAt,
  type ShellKind,
  type Vec2,
} from "./ballistics12";
import type { Dir } from "./terrain12";

/** 拿一张字符表当「哪里挡弹丸」的问答表:`#` 与 `S` 挡,别的都放行 */
function probeOf(rows: readonly string[]): BlockedAt {
  return (cx, cy) => {
    if (cy < 0 || cy >= rows.length) return true;
    const row = rows[cy];
    if (cx < 0 || cx >= row.length) return true;
    return row[cx] === "#" || row[cx] === "S";
  };
}

describe("三种弹丸", () => {
  it("弹丸表把三种脾气写清楚了:只有穿甲弹破钢,只有弹力球会反弹", () => {
    expect(SHELL_ORDER).toEqual(["plain", "bounce", "pierce"]);
    expect(SHELLS.plain.maxBounces).toBe(0);
    expect(SHELLS.plain.breaksSteel).toBe(false);
    expect(SHELLS.bounce.maxBounces).toBe(2);
    expect(SHELLS.bounce.breaksSteel).toBe(false);
    expect(SHELLS.pierce.breaksSteel).toBe(true);
    expect(SHELLS.pierce.pierceBlocks).toBe(2);
    expect(SHELLS.pierce.maxBounces).toBe(0);
  });

  it("好用的弹丸要多等一会儿:冷却依次变长", () => {
    expect(SHELLS.plain.coolMul).toBeLessThan(SHELLS.bounce.coolMul);
    expect(SHELLS.bounce.coolMul).toBeLessThan(SHELLS.pierce.coolMul);
  });

  it("换弹是个圈,按三下回到原处", () => {
    let k: ShellKind = "plain";
    k = nextShell(k);
    expect(k).toBe("bounce");
    k = nextShell(k);
    expect(k).toBe("pierce");
    k = nextShell(k);
    expect(k).toBe("plain");
  });

  it("直线弹笔直出膛,四个方向都是单位向量", () => {
    const want: Array<[Dir, Vec2]> = [
      [0, { x: 0, y: -1 }],
      [1, { x: 1, y: 0 }],
      [2, { x: 0, y: 1 }],
      [3, { x: -1, y: 0 }],
    ];
    for (const [dir, v] of want) {
      expect(shotVelocity(dir, "plain")).toEqual(v);
      expect(length(shotVelocity(dir, "plain"))).toBeCloseTo(1, 9);
    }
  });

  it("弹力球斜着出膛,左右两边各一次,斜角就是 BOUNCE_TILT", () => {
    const right = shotVelocity(0, "bounce", 1);
    const left = shotVelocity(0, "bounce", -1);
    expect(length(right)).toBeCloseTo(1, 9);
    expect(right.x).toBeCloseTo(-left.x, 9);
    expect(right.y).toBeCloseTo(left.y, 9);
    // 斜率 = 横向 / 纵向,正好是设定的那个值
    expect(Math.abs(right.x / right.y)).toBeCloseTo(BOUNCE_TILT, 9);
    // 车头右手边的垂线
    expect(sideways(0).x).toBe(1);
    expect(sideways(0).y).toBe(0);
    expect(sideways(1).x).toBeCloseTo(0, 9);
    expect(sideways(1).y).toBe(1);
  });
});

describe("反射公式", () => {
  it("撞竖墙翻横向分量,撞横墙翻纵向分量,撞死角两个都翻", () => {
    const v = { x: 0.6, y: -0.8 };
    expect(reflect(v, "x")).toEqual({ x: -0.6, y: -0.8 });
    expect(reflect(v, "y")).toEqual({ x: 0.6, y: 0.8 });
    expect(reflect(v, "both")).toEqual({ x: -0.6, y: 0.8 });
  });

  it("入射角 = 反射角:按角度量,一度不差", () => {
    for (const v of [
      { x: 0.4472, y: -0.8944 },
      { x: 1, y: -1 },
      { x: -0.3, y: 0.95 },
      { x: 0.7, y: 0.7 },
    ]) {
      for (const axis of ["x", "y"] as const) {
        const back = reflect(v, axis);
        expect(angleToNormal(back, axis)).toBeCloseTo(angleToNormal(v, axis), 9);
        // 反射不改速度大小,只改方向
        expect(length(back)).toBeCloseTo(length(v), 9);
      }
    }
  });

  it("反射两次回到原方向(同一根轴上弹两下等于没弹)", () => {
    const v = unit({ x: 0.5, y: -1 });
    const twice = reflect(reflect(v, "x"), "x");
    expect(twice.x).toBeCloseTo(v.x, 9);
    expect(twice.y).toBeCloseTo(v.y, 9);
    expect(angleDeg({ x: 1, y: 0 })).toBeCloseTo(0, 9);
  });

  it("hitAxis 分得清撞的是竖墙还是横墙", () => {
    // 一条竖着的墙在 x = 3
    const wall = probeOf(["....", "...#", "...#", "...#"]);
    expect(hitAxis(2.6, 1.5, 3.1, 1.5, wall)).toBe("x");
    // 一条横着的墙在 y = 0
    const floor = probeOf(["####", "....", "....", "...."]);
    expect(hitAxis(1.5, 1.2, 1.5, 0.9, floor)).toBe("y");
    expect(hitAxis(1.5, 1.5, 1.6, 1.6, floor)).toBeNull();
  });
});

describe("走一条弹道", () => {
  const room = [
    "#######",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#######",
  ];

  it("不给反弹次数的弹丸撞墙就没了,折线只有起点和撞点", () => {
    const hit = traceShot({ x: 3.5, y: 5 }, { x: 0, y: -1 }, probeOf(room), { maxBounces: 0 });
    expect(hit.stop).toBe("wall");
    expect(hit.bounces).toBe(0);
    expect(hit.points).toHaveLength(2);
    expect(hit.end.y).toBeGreaterThan(1); // 停在墙外面,没钻进墙里
    expect(hit.end.y).toBeLessThan(1.15);
  });

  it("弹力球在屋子里斜着弹两次,折线上就多两个拐点", () => {
    const v = shotVelocity(1, "bounce", 1);
    const shot = traceShot({ x: 1.5, y: 3.5 }, v, probeOf(room), { maxBounces: 2, maxDist: 30 });
    expect(shot.bounces).toBe(2);
    // 起点 + 两个拐点 + 终点
    expect(shot.points).toHaveLength(4);
    for (const p of shot.points) {
      expect(p.x).toBeGreaterThan(1);
      expect(p.y).toBeGreaterThan(1);
      expect(p.x).toBeLessThan(6);
      expect(p.y).toBeLessThan(6);
    }
  });

  it("弹够次数之后再撞墙就散了,不会永远弹下去", () => {
    const v = shotVelocity(1, "bounce", 1);
    const one = traceShot({ x: 1.5, y: 3.5 }, v, probeOf(room), { maxBounces: 1, maxDist: 40 });
    expect(one.bounces).toBe(1);
    expect(one.stop).toBe("wall");
  });

  it("一路没东西挡就飞到最远距离,不是撞墙停的", () => {
    const open = traceShot({ x: 3.5, y: 3.5 }, { x: 1, y: 0 }, () => false, { maxDist: 6 });
    expect(open.stop).toBe("range");
    expect(open.dist).toBeGreaterThanOrEqual(6);
    expect(open.end.x).toBeCloseTo(3.5 + open.dist, 6);
    expect(open.end.y).toBe(3.5);
  });
});

describe("预测虚线", () => {
  const room = [
    "#######",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#######",
  ];

  it("只画第一段反射:三个点,一个拐点,尾巴很短", () => {
    const v = shotVelocity(1, "bounce", 1);
    const pts = previewPath({ x: 1.5, y: 3.5 }, v, probeOf(room));
    expect(pts).toHaveLength(3);
    const tail = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
    expect(tail).toBeGreaterThan(0);
    expect(tail).toBeLessThanOrEqual(PREVIEW_TAIL + 0.1);
  });

  it("前面没有墙就只画一条直线段,不凭空造拐点", () => {
    const pts = previewPath({ x: 3.5, y: 3.5 }, { x: 1, y: 0 }, () => false, 4);
    expect(pts).toHaveLength(2);
    expect(pts[1].x).toBeGreaterThan(pts[0].x);
  });

  it("拐点真的在墙边上,而且预测线不会长过 PREVIEW_RANGE", () => {
    const v = shotVelocity(0, "bounce", 1);
    const pts = previewPath({ x: 3.5, y: 5 }, v, probeOf(room));
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const bend = pts[1];
    expect(bend.y).toBeGreaterThan(1);
    expect(bend.y).toBeLessThan(1.2);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    expect(total).toBeLessThanOrEqual(PREVIEW_RANGE + PREVIEW_TAIL + 0.5);
  });
});
