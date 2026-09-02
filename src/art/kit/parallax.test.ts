import { describe, expect, it } from "vitest";
import { makeParallax } from "./parallax";

describe("art/kit parallax", () => {
  it("各层按自己的倍率滚,到周期就回卷", () => {
    const p = makeParallax([0.2, 0.5, 0.9], 100);
    p.step(1, 60);
    expect(p.offsets[0]).toBeCloseTo(12, 6);
    expect(p.offsets[1]).toBeCloseTo(30, 6);
    expect(p.offsets[2]).toBeCloseTo(54, 6);
    p.step(1, 60);
    // 0.9 层 108 > 100,回卷到 8
    expect(p.offsets[2]).toBeCloseTo(8, 6);
    expect(p.total()).toBeGreaterThan(0);
  });

  it("基准速度为 0(reduced)就纹丝不动;reset 一步归零", () => {
    const p = makeParallax([0.2, 0.5, 0.9], 100);
    for (let i = 0; i < 60; i++) p.step(1 / 60, 0);
    expect(p.total()).toBe(0);
    p.step(0.5, 60);
    expect(p.total()).toBeGreaterThan(0);
    p.reset();
    expect(p.total()).toBe(0);
    expect(p.offsets).toEqual([0, 0, 0]);
  });
});
