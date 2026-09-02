// 1.3 第 1 步 C · 速度与镜头单测:线数随强度、reduced 全零、镜头微动有界且循环连续。
import { describe, expect, it } from "vitest";
import {
  MAX_SPEED_LINES,
  NUDGE_MAX_ROT,
  NUDGE_MAX_SHIFT,
  advanceSpeedLines,
  cameraNudge,
  drawSpeedLines,
  makeSpeedLines,
} from "./speedfx";

/** 记录式 ctx 桩(私有,不碰真 DOM) */
function makeStubCtx() {
  const calls: string[] = [];
  const ctx = {
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    stroke: () => calls.push("stroke"),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const W = 360;
const H = 640;

describe("runner/speedfx · makeSpeedLines", () => {
  it("intensity 越大线越多,满强度到 MAX_SPEED_LINES", () => {
    const low = makeSpeedLines(0.2, false).lines.length;
    const mid = makeSpeedLines(0.6, false).lines.length;
    const high = makeSpeedLines(1, false).lines.length;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    expect(high).toBe(MAX_SPEED_LINES);
  });

  it("reduced 一律 0 条,哪怕满强度", () => {
    expect(makeSpeedLines(1, true).lines.length).toBe(0);
    expect(makeSpeedLines(0.5, true).lines.length).toBe(0);
  });

  it("强度夹到 0..1:负数 0 条、超 1 不超上限、NaN 不抛", () => {
    expect(makeSpeedLines(-3, false).lines.length).toBe(0);
    expect(makeSpeedLines(99, false).lines.length).toBe(MAX_SPEED_LINES);
    expect(() => makeSpeedLines(Number.NaN, false)).not.toThrow();
    expect(makeSpeedLines(Number.NaN, false).lines.length).toBe(0);
  });

  it("同 seed 可复现,不同 seed 出不同的线", () => {
    expect(makeSpeedLines(0.8, false, 42)).toEqual(makeSpeedLines(0.8, false, 42));
    expect(makeSpeedLines(0.8, false, 1).lines).not.toEqual(makeSpeedLines(0.8, false, 2).lines);
  });
});

describe("runner/speedfx · drawSpeedLines / advanceSpeedLines", () => {
  it("一条线一笔 stroke,数量对得上;空状态不落笔", () => {
    const rec = makeStubCtx();
    const state = makeSpeedLines(0.7, false, 3);
    drawSpeedLines(rec.ctx, state, W, H);
    expect(rec.calls.filter((c) => c === "stroke").length).toBe(state.lines.length);
    const empty = makeStubCtx();
    drawSpeedLines(empty.ctx, makeSpeedLines(1, true), W, H);
    expect(empty.calls.length).toBe(0);
  });

  it("视口 0 不抛也不画", () => {
    const rec = makeStubCtx();
    const state = makeSpeedLines(1, false);
    expect(() => drawSpeedLines(rec.ctx, state, 0, H)).not.toThrow();
    expect(() => drawSpeedLines(rec.ctx, state, W, 0)).not.toThrow();
    expect(rec.calls.length).toBe(0);
  });

  it("advance 让相位循环推进且始终在 [0, 1) 里;负 dt / NaN 不动", () => {
    const state = makeSpeedLines(0.5, false, 7);
    const before = state.lines.map((l) => l.phase);
    advanceSpeedLines(state, 0.4);
    const after = state.lines.map((l) => l.phase);
    expect(after).not.toEqual(before);
    for (const p of after) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
    advanceSpeedLines(state, Number.NaN);
    advanceSpeedLines(state, -1);
    expect(state.lines.map((l) => l.phase)).toEqual(after);
  });
});

describe("runner/speedfx · cameraNudge", () => {
  it("有界:任意 t、两种动作,位移 ≤ 视口 1.5%、旋转 ≤ 1.2°", () => {
    for (const kind of ["tilt", "land"] as const) {
      for (let t = -2; t <= 3; t += 0.05) {
        const n = cameraNudge(t, kind, false);
        expect(Math.abs(n.dx)).toBeLessThanOrEqual(NUDGE_MAX_SHIFT + 1e-9);
        expect(Math.abs(n.dy)).toBeLessThanOrEqual(NUDGE_MAX_SHIFT + 1e-9);
        expect(Math.abs(n.rot)).toBeLessThanOrEqual(NUDGE_MAX_ROT + 1e-9);
      }
    }
  });

  it("reduced 恒为 0:任何时刻、任何动作都纹丝不动", () => {
    for (const kind of ["tilt", "land"] as const) {
      for (const t of [0, 0.25, 0.5, 0.99, 1.5]) {
        expect(cameraNudge(t, kind, true)).toEqual({ dx: 0, dy: 0, rot: 0 });
      }
    }
  });

  it("t 循环连续:t 与 t+1 同相,周期边界两侧几乎归零", () => {
    for (const kind of ["tilt", "land"] as const) {
      const a = cameraNudge(0.37, kind, false);
      const b = cameraNudge(1.37, kind, false);
      expect(b.dx).toBeCloseTo(a.dx, 6);
      expect(b.dy).toBeCloseTo(a.dy, 6);
      expect(b.rot).toBeCloseTo(a.rot, 6);
      const end = cameraNudge(0.9999, kind, false);
      const start = cameraNudge(1.0001, kind, false);
      expect(Math.abs(end.dy - start.dy)).toBeLessThan(1e-2 * NUDGE_MAX_SHIFT * 10);
      expect(Math.abs(end.rot - start.rot)).toBeLessThan(1e-2 * NUDGE_MAX_ROT * 10);
    }
  });

  it("动作真的在动:tilt 中段有横移有角度,land 中段只往下沉", () => {
    const tilt = cameraNudge(0.5, "tilt", false);
    expect(tilt.dx).toBeGreaterThan(0);
    expect(tilt.rot).toBeGreaterThan(0);
    const land = cameraNudge(0.4, "land", false);
    expect(land.dy).toBeGreaterThan(0);
    expect(land.dx).toBe(0);
    expect(land.rot).toBe(0);
  });

  it("NaN 的 t 按 0 处理:两种动作都从静止起步", () => {
    expect(cameraNudge(Number.NaN, "tilt", false)).toEqual({ dx: 0, dy: 0, rot: 0 });
    expect(cameraNudge(Number.NaN, "land", false)).toEqual({ dx: 0, dy: 0, rot: 0 });
  });
});
