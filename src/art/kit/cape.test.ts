/**
 * 披风三段飘动 · 单测(1.3 第 22 步 C 档)。
 * 三段形态的速度阈值映射、几何朝向(越快越水平)、180ms ease-out 过渡与 reduced 瞬切。
 */
import { describe, expect, it } from "vitest";

import {
  CAPE_BLEND_MS,
  CAPE_DASH_SPEED,
  CAPE_RUN_SPEED,
  blendCape,
  capeEaseOut,
  capeMode,
  capePoints,
} from "./cape";

describe("art-kit · cape 披风三段飘动", () => {
  it("速度阈值映射:静止垂落 / 跑动后飘 / 冲刺拉直(读速度不改速度)", () => {
    expect(capeMode(0)).toBe("rest");
    expect(capeMode(CAPE_RUN_SPEED - 1)).toBe("rest");
    expect(capeMode(CAPE_RUN_SPEED)).toBe("run");
    expect(capeMode(250)).toBe("run");
    expect(capeMode(CAPE_DASH_SPEED)).toBe("dash");
    expect(capeMode(520)).toBe("dash");
    // 向左跑一样认得出
    expect(capeMode(-520)).toBe("dash");
    expect(capeMode(-250)).toBe("run");
  });

  it("几何朝向:越快越水平(tipY 递减)、拖得越远(tipX 递增)", () => {
    const rest = capePoints("rest");
    const run = capePoints("run");
    const dash = capePoints("dash");
    expect(rest.tipY).toBeGreaterThan(run.tipY);
    expect(run.tipY).toBeGreaterThan(dash.tipY);
    expect(rest.tipX).toBeLessThan(run.tipX);
    expect(run.tipX).toBeLessThan(dash.tipX);
    // 垂落态几乎贴着身体垂直(tipY 接近披风全长)
    expect(rest.tipY).toBeGreaterThan(0.9);
    // 冲刺态几乎水平(tipY 不到披风全长的四分之一)
    expect(dash.tipY).toBeLessThanOrEqual(0.25);
  });

  it("180ms ease-out 过渡:中点严格落在两形态之间,到点等于目标形态", () => {
    expect(CAPE_BLEND_MS).toBe(180);
    const mid = blendCape("rest", "dash", CAPE_BLEND_MS / 2, false);
    const rest = capePoints("rest");
    const dash = capePoints("dash");
    expect(mid.tipX).toBeGreaterThan(rest.tipX);
    expect(mid.tipX).toBeLessThan(dash.tipX);
    expect(mid.tipY).toBeLessThan(rest.tipY);
    expect(mid.tipY).toBeGreaterThan(dash.tipY);
    // ease-out:前半程走得比一半多
    expect(capeEaseOut(0.5)).toBeGreaterThan(0.5);
    expect(blendCape("rest", "dash", CAPE_BLEND_MS, false)).toEqual(dash);
    expect(blendCape("rest", "dash", CAPE_BLEND_MS + 999, false)).toEqual(dash);
  });

  it("reduced 瞬切:不做补间,直接目标形态", () => {
    expect(blendCape("rest", "dash", 1, true)).toEqual(capePoints("dash"));
    expect(blendCape("dash", "rest", 1, true)).toEqual(capePoints("rest"));
  });
});
