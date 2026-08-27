/**
 * 窗口4 · 档B · 第 1 轮学习优化员 —— 拼图乐园的落地覆盖。
 *
 * 落地内容:吸附阈值原来只按「格宽 × 35%」算,
 * 360px 窄屏上 6 列的格宽只剩五十几像素,吸附半径不到 19px,
 * 比小朋友指尖的落点误差还小,碎片总在缺口边上弹回来。
 * 现在给阈值加一个 18px 的地板(同时不超过半格,免得两格之间打架)。
 */
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { SNAP_MIN, SNAP_RATIO, cellCenter, resolveDrop, snapThreshold, type GridGeom } from "./snap";

describe("档B R1 落地 · 拼图乐园 · 窄屏吸附地板", () => {
  it("宽格子还是按 35% 走,老手感一点没变", () => {
    expect(snapThreshold(60)).toBeCloseTo(21, 5);
    expect(snapThreshold(80)).toBeCloseTo(28, 5);
    expect(SNAP_RATIO).toBeCloseTo(0.35, 5);
  });

  it("窄格子吃到地板:再小也有 18px 可吸", () => {
    expect(SNAP_MIN).toBe(18);
    expect(snapThreshold(40)).toBe(18);
    expect(snapThreshold(50)).toBe(18);
    // 51px 起 35% 就超过地板了,自然接回原来的曲线
    expect(snapThreshold(52)).toBeCloseTo(18.2, 5);
  });

  it("地板不会大过半格:极小格子上两格之间不会互相抢", () => {
    for (const cell of [4, 8, 12, 20, 30, 36, 60, 120]) {
      expect(snapThreshold(cell)).toBeLessThanOrEqual(cell / 2);
    }
  });

  it("坏参数照旧返回 0,不吸也不崩", () => {
    expect(snapThreshold(0)).toBe(0);
    expect(snapThreshold(-10)).toBe(0);
    expect(snapThreshold(Number.NaN)).toBe(0);
  });

  it("360px 上最宽的一关:偏 17px 松手也能吸进去(改之前会弹回来)", () => {
    const widest = LEVELS.reduce((a, b) => (b.cols > a.cols ? b : a));
    // 360px 上真实可用宽度:页面左右各 4vw(=14.4px)、.pz-wrap 再各 12px
    const inner = 360 - 2 * 14.4 - 2 * 12;
    const gap = widest.cols >= 5 ? 5 : 8;
    const cell = Math.floor((inner - gap * (widest.cols - 1)) / widest.cols);
    const g: GridGeom = { left: 8, top: 8, cell, gap, cols: widest.cols, rows: widest.rows };
    expect(cell * SNAP_RATIO, "这一关的格宽本来就够大,举不出窄屏的例子").toBeLessThan(SNAP_MIN);
    const center = cellCenter(g, 7);
    const drop = resolveDrop(g, center.x + 17, center.y, { holes: [7], filled: [], value: 7 });
    expect(drop).toEqual({ kind: "snap", pos: 7 });
  });

  it("离得太远照样弹回来,不是无脑全吸", () => {
    const g: GridGeom = { left: 0, top: 0, cell: 48, gap: 4, cols: 5, rows: 5 };
    const center = cellCenter(g, 12);
    const far = resolveDrop(g, center.x + 40, center.y + 40, { holes: [12], filled: [], value: 12 });
    expect(far.kind).toBe("bounce");
  });
});
