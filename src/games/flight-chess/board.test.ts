import { describe, expect, it } from "vitest";
import {
  AIRLINE_FROM,
  AIRLINE_TO,
  ARM,
  BASE,
  COLORS,
  COLOR_INFO,
  GOAL,
  GRID,
  HOME_LEN,
  HOME_XY,
  JUMP_STEP,
  PLANES_PER_COLOR,
  RING_LEN,
  RING_XY,
  baseRect,
  baseXY,
  canJumpFrom,
  cellXY,
  describePos,
  inBase,
  inHomeLane,
  isAirline,
  isFinished,
  isOwnColorCell,
  isSafe,
  pathOf,
  ringAt,
  ringColor,
  startRing,
  stepsToGoal,
  type Color
} from "./board";

describe("棋盘常量与坐标", () => {
  it("52 格环线 + 6 格终点通道，终点行程是 57", () => {
    expect(RING_LEN).toBe(52);
    expect(HOME_LEN).toBe(6);
    expect(ARM).toBe(13);
    expect(GOAL).toBe(57);
    expect(PLANES_PER_COLOR).toBe(4);
  });

  it("环线坐标正好 52 个，互不重复，全在 15 × 15 网格里", () => {
    expect(RING_XY).toHaveLength(RING_LEN);
    const keys = new Set(RING_XY.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(RING_LEN);
    for (const c of RING_XY) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(GRID);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(GRID);
    }
  });

  it("相邻两格最多差一格，走格绝不会跨半张棋盘", () => {
    for (let i = 0; i < RING_LEN; i++) {
      const a = RING_XY[i];
      const b = RING_XY[(i + 1) % RING_LEN];
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    }
  });

  it("四色起飞格相隔 13 格，每色的本色格正好 13 个且互不重叠", () => {
    const claimed = new Set<number>();
    for (const c of COLORS) {
      expect(startRing(c)).toBe(ARM * c);
      const own = pathOf(c).ownCells.map((p) => ringAt(c, p));
      expect(own).toHaveLength(13);
      for (const ring of own) {
        expect(ringColor(ring)).toBe(c);
        expect(claimed.has(ring)).toBe(false);
        claimed.add(ring);
      }
    }
    expect(claimed.size).toBe(RING_LEN);
  });

  it("本色格与跳格的边界:48 是本色格，但再跳就撞进通道，所以不许跳", () => {
    expect(isOwnColorCell(0)).toBe(true);
    expect(isOwnColorCell(12)).toBe(true);
    expect(isOwnColorCell(13)).toBe(false);
    expect(canJumpFrom(44)).toBe(true);
    expect(isOwnColorCell(48)).toBe(true);
    expect(canJumpFrom(48)).toBe(false);
    expect(JUMP_STEP).toBe(4);
  });

  it("航线两端都是本色格，正好前进 12 格", () => {
    expect(isAirline(AIRLINE_FROM)).toBe(true);
    expect(isAirline(AIRLINE_TO)).toBe(false);
    expect(AIRLINE_TO - AIRLINE_FROM).toBe(12);
    expect(isOwnColorCell(AIRLINE_FROM)).toBe(true);
    expect(isOwnColorCell(AIRLINE_TO)).toBe(true);
  });

  it("终点通道每色 6 格，只有本色进得来，通道口接着环线最后一格", () => {
    for (const c of COLORS) {
      expect(HOME_XY[c]).toHaveLength(HOME_LEN);
      const lastRing = cellXY(c, RING_LEN - 1);
      const firstHome = cellXY(c, RING_LEN);
      expect(Math.abs(lastRing.x - firstHome.x) + Math.abs(lastRing.y - firstHome.y)).toBe(1);
      expect(inHomeLane(RING_LEN)).toBe(true);
      expect(inHomeLane(RING_LEN - 1)).toBe(false);
    }
  });

  it("基地与终点通道都是安全区，环线上不安全", () => {
    expect(isSafe(BASE)).toBe(true);
    expect(inBase(BASE)).toBe(true);
    expect(isSafe(RING_LEN + 2)).toBe(true);
    expect(isSafe(10)).toBe(false);
    expect(isFinished(GOAL)).toBe(true);
    expect(stepsToGoal(GOAL)).toBe(0);
    expect(stepsToGoal(50)).toBe(7);
  });

  it("四角基地互不重叠，停机位落在自己那一角里", () => {
    for (const c of COLORS) {
      const rect = baseRect(c);
      for (let i = 0; i < PLANES_PER_COLOR; i++) {
        const slot = baseXY(c, i);
        expect(slot.x).toBeGreaterThanOrEqual(rect.x);
        expect(slot.x).toBeLessThan(rect.x + rect.w);
        expect(slot.y).toBeGreaterThanOrEqual(rect.y);
        expect(slot.y).toBeLessThan(rect.y + rect.h);
      }
    }
  });

  it("四位队员都有中文名与棋子造型，说的是绕回基地不是别的", () => {
    expect(COLOR_INFO).toHaveLength(4);
    expect(COLOR_INFO.map((c) => c.name)).toEqual(["鸭梨", "康康", "小花", "小鸟"]);
    for (const info of COLOR_INFO) {
      expect(info.token.length).toBeGreaterThan(0);
      expect(info.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("位置描述读得懂，不会冒出 undefined", () => {
    for (const c of COLORS) {
      for (const p of [BASE, 0, 30, RING_LEN + 1, GOAL]) {
        const line = describePos(c as Color, p);
        expect(line).not.toContain("undefined");
        expect(line.length).toBeGreaterThan(4);
      }
    }
  });
});
