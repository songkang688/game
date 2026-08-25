import { describe, expect, it } from "vitest";
import {
  GRID_COLS,
  GRID_ROWS,
  buildWaypoints,
  canPlace,
  pathCellSet,
  pathLength,
  pickTarget,
  pointAlongPath,
} from "./logic";

describe("garden-guard 路径", () => {
  it("拐点转换为格子中心", () => {
    const pts = buildWaypoints([
      [0, 1],
      [3, 1],
    ]);
    expect(pts).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 3.5, y: 1.5 },
    ]);
  });

  it("默认路径总长为 22 格", () => {
    expect(pathLength(buildWaypoints())).toBeCloseTo(22);
  });

  it("沿路径取点:起点、中途、终点", () => {
    const pts = buildWaypoints([
      [0, 0],
      [4, 0],
      [4, 2],
    ]);
    expect(pointAlongPath(pts, 0)).toEqual({ x: 0.5, y: 0.5, done: false });
    const mid = pointAlongPath(pts, 5); // 4 格横 + 1 格竖
    expect(mid.x).toBeCloseTo(4.5);
    expect(mid.y).toBeCloseTo(1.5);
    expect(mid.done).toBe(false);
    expect(pointAlongPath(pts, 99).done).toBe(true);
  });

  it("路径格子集合包含拐角与中间格", () => {
    const cells = pathCellSet([
      [0, 1],
      [2, 1],
      [2, 3],
    ]);
    expect(cells.has("0,1")).toBe(true);
    expect(cells.has("1,1")).toBe(true);
    expect(cells.has("2,2")).toBe(true);
    expect(cells.has("2,3")).toBe(true);
    expect(cells.has("0,0")).toBe(false);
  });
});

describe("garden-guard 放塔与索敌", () => {
  it("路上、占用、出界都不能放塔", () => {
    const blocked = new Set(["1,1"]);
    const occupied = new Set(["2,2"]);
    expect(canPlace(0, 0, blocked, occupied)).toBe(true);
    expect(canPlace(1, 1, blocked, occupied)).toBe(false);
    expect(canPlace(2, 2, blocked, occupied)).toBe(false);
    expect(canPlace(-1, 0, blocked, occupied)).toBe(false);
    expect(canPlace(GRID_COLS, 0, blocked, occupied)).toBe(false);
    expect(canPlace(0, GRID_ROWS, blocked, occupied)).toBe(false);
  });

  it("优先打射程内走得最远的怪", () => {
    const monsters = [
      { x: 1, y: 1, dist: 2, hp: 3 },
      { x: 1.5, y: 1, dist: 5, hp: 3 },
      { x: 9, y: 9, dist: 8, hp: 3 }, // 射程外
      { x: 1, y: 1.2, dist: 6, hp: 0 }, // 已被打倒
    ];
    expect(pickTarget(monsters, 1, 1, 2)).toBe(1);
    expect(pickTarget(monsters, 20, 20, 2)).toBe(-1);
  });
});
