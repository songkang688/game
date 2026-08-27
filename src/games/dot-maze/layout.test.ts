/**
 * 豆豆迷宫 · 360px 排布回归。
 *
 * 规格第九节要求整张迷宫在 360px 上完整入屏、格子不小于 14px。
 * 地图是生成器按关号算出来的，谁改了 `planFor` 里的宽高公式都可能把这条踩掉，
 * 所以这里拿 188 关和无尽前若干圈的真实宽度逐个过一遍。
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CELL_PX,
  MIN_CELL_PX,
  NARROW_VIEWPORT_PX,
  PAD_HIT_PX,
  availableWidth,
  cellPxFor,
  maxCanvasWidth,
  mazeFits,
} from "./layout";
import { TOTAL, endlessConfig, mazeFor } from "./levels";

describe("豆豆迷宫 · 360px 排布", () => {
  it("可用宽度是屏宽减掉外框内边距", () => {
    expect(availableWidth(NARROW_VIEWPORT_PX)).toBe(NARROW_VIEWPORT_PX - 20);
    expect(availableWidth(0)).toBe(0);
    expect(availableWidth(-100)).toBe(0);
  });

  it("格子边长按屏宽平分，并夹在 14–26 之间", () => {
    expect(cellPxFor(NARROW_VIEWPORT_PX, 17)).toBe(20);
    // 窄屏 + 最宽的图：正好压到下限，不会更小
    expect(cellPxFor(NARROW_VIEWPORT_PX, 23)).toBe(MIN_CELL_PX);
    // 大屏也不会把格子拉到夸张的尺寸
    expect(cellPxFor(1280, 15)).toBe(MAX_CELL_PX);
    expect(cellPxFor(360, 0)).toBeGreaterThanOrEqual(MIN_CELL_PX);
  });

  it("虚拟方向键热区不小于 44px", () => {
    expect(PAD_HIT_PX).toBeGreaterThanOrEqual(44);
  });

  it("全部 188 关在 360px 上都装得下，而且每格都不小于 14px", () => {
    for (let level = 0; level < TOTAL; level += 1) {
      const cols = mazeFor(level).w;
      expect(mazeFits(NARROW_VIEWPORT_PX, cols), `第 ${level + 1} 关有 ${cols} 列，360px 装不下`).toBe(true);
      expect(cellPxFor(NARROW_VIEWPORT_PX, cols)).toBeGreaterThanOrEqual(MIN_CELL_PX);
      expect(cols * MIN_CELL_PX).toBeLessThanOrEqual(availableWidth(NARROW_VIEWPORT_PX));
    }
  });

  it("无尽模式前 30 圈的地图在 360px 上一样装得下", () => {
    for (let round = 0; round < 30; round += 1) {
      const cols = endlessConfig(round).maze.w;
      expect(mazeFits(NARROW_VIEWPORT_PX, cols), `无尽第 ${round + 1} 圈有 ${cols} 列`).toBe(true);
    }
  });

  it("更窄的 320px 上也还有回旋余地", () => {
    let widest = 0;
    for (let level = 0; level < TOTAL; level += 1) widest = Math.max(widest, mazeFor(level).w);
    expect(widest * MIN_CELL_PX).toBeLessThanOrEqual(availableWidth(NARROW_VIEWPORT_PX));
    // 320px 上最宽的图会略微超出，这时靠等比缩放兜底，但不能超过一整格
    expect(widest * MIN_CELL_PX - availableWidth(320)).toBeLessThan(MIN_CELL_PX * 2);
  });

  it("大屏上画布有宽度上限，迷宫不会被拉变形", () => {
    expect(maxCanvasWidth(23)).toBe(23 * MAX_CELL_PX);
    expect(maxCanvasWidth(0)).toBe(MAX_CELL_PX);
  });
});
