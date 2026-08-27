/**
 * 冰冰火火森林 · 摄像机的用例。
 *
 * 盯死三件事:**拉远有下限**、**下限之外改用箭头而不是硬拽**、
 * 以及跟随速度与帧率无关(30fps 和 60fps 追同样远)。
 */
import { describe, expect, it } from "vitest";
import { CAMERA, arrowLabel, computeCamera, followTowards, type CameraInput } from "./camera";

function input(over: Partial<CameraInput> = {}): CameraInput {
  return {
    iceX: 4,
    iceY: 3,
    fireX: 5,
    fireY: 3,
    gridW: 40,
    gridH: 16,
    viewW: 640,
    viewH: 360,
    baseCell: 40,
    ...over,
  };
}

describe("摄像机 · 放得下就不动", () => {
  it("整张小图塞得进画面时不拉远也不移动,镜头就钉在图中央", () => {
    const out = computeCamera(input({ gridW: 9, gridH: 5, iceX: 1, fireX: 7 }));
    expect(out.cx).toBeCloseTo(4.5);
    expect(out.cy).toBeCloseTo(2.5);
    expect(out.arrows).toEqual([]);
  });

  it("缩放永远不会超过 1 —— 小图不许被放大糊掉", () => {
    const out = computeCamera(input({ gridW: 6, gridH: 4, viewW: 1600, viewH: 900 }));
    expect(out.scale).toBeLessThanOrEqual(CAMERA.MAX_SCALE);
    expect(out.cell).toBeLessThanOrEqual(40);
  });
});

describe("摄像机 · 两人分散先拉远", () => {
  it("越分散格子越小", () => {
    const near = computeCamera(input({ iceX: 8, fireX: 9 }));
    const far = computeCamera(input({ iceX: 2, fireX: 15 }));
    expect(far.cell).toBeLessThan(near.cell);
  });

  it("拉远之后两个人确实都还在画面里(没到下限之前不该有箭头)", () => {
    const out = computeCamera(input({ iceX: 4, fireX: 12 }));
    expect(out.clamped).toBe(false);
    expect(out.arrows).toEqual([]);
  });

  it("镜头落在两人中点附近,不偏袒任何一位", () => {
    const out = computeCamera(input({ iceX: 6, iceY: 2, fireX: 14, fireY: 8, gridH: 24 }));
    const iceGap = Math.abs(out.cx - 6.5);
    const fireGap = Math.abs(out.cx - 14.5);
    expect(Math.abs(iceGap - fireGap)).toBeLessThan(0.001);
  });
});

describe("摄像机 · 拉远有上限", () => {
  it("再怎么分散也不会小过 MIN_SCALE", () => {
    for (const gap of [10, 20, 40, 80, 200]) {
      const out = computeCamera(input({ gridW: 240, iceX: 0, fireX: gap }));
      expect(out.scale, `相隔 ${gap} 格`).toBeGreaterThanOrEqual(CAMERA.MIN_SCALE - 1e-9);
    }
  });

  it("到了下限就标 clamped,再远也不会继续缩", () => {
    const a = computeCamera(input({ gridW: 240, iceX: 0, fireX: 60 }));
    const b = computeCamera(input({ gridW: 240, iceX: 0, fireX: 200 }));
    expect(a.clamped).toBe(true);
    expect(b.clamped).toBe(true);
    expect(b.cell).toBeCloseTo(a.cell);
    expect(a.scale).toBeCloseTo(CAMERA.MIN_SCALE);
  });

  it("超限的那一位在边上给箭头,而不是把另一位硬拽过去", () => {
    const out = computeCamera(input({ gridW: 240, iceX: 0, fireX: 120 }));
    expect(out.arrows.length).toBe(2);
    const ice = out.arrows.find((a) => a.hero === "ice")!;
    const fire = out.arrows.find((a) => a.hero === "fire")!;
    // 凛凛在左、焰焰在右,箭头分别指向两侧
    expect(ice.dx).toBeLessThan(0);
    expect(fire.dx).toBeGreaterThan(0);
    for (const arrow of out.arrows) {
      expect(Math.hypot(arrow.dx, arrow.dy)).toBeCloseTo(1);
    }
  });

  it("箭头旁边写的是名字,不是「你死了」这类话", () => {
    expect(arrowLabel("ice")).toContain("凛凛");
    expect(arrowLabel("fire")).toContain("焰焰");
    for (const hero of ["ice", "fire"] as const) {
      for (const bad of ["死", "输", "血"]) expect(arrowLabel(hero).includes(bad)).toBe(false);
    }
  });

  it("镜头不会跑到图外面去", () => {
    const out = computeCamera(input({ gridW: 240, gridH: 40, iceX: 0, iceY: 0, fireX: 1, fireY: 1 }));
    const halfX = out.cell > 0 ? 640 / out.cell / 2 : 0;
    expect(out.cx).toBeGreaterThanOrEqual(halfX - 1e-6);
    expect(out.cy).toBeGreaterThanOrEqual(0);
  });
});

describe("摄像机 · 跟随与帧率无关", () => {
  it("30fps 跑 12 帧和 60fps 跑 24 帧,追到的位置差不到 2%", () => {
    let slow = 0;
    let fast = 0;
    for (let i = 0; i < 12; i++) slow = followTowards(slow, 100, 1000 / 30);
    for (let i = 0; i < 24; i++) fast = followTowards(fast, 100, 1000 / 60);
    expect(Math.abs(slow - fast) / 100).toBeLessThan(0.02);
  });

  it("追得再久也不会冲过头", () => {
    let v = 0;
    for (let i = 0; i < 600; i++) v = followTowards(v, 10, 16.7);
    expect(v).toBeLessThanOrEqual(10 + 1e-9);
    expect(v).toBeCloseTo(10, 5);
  });

  it("dt 为 0 时原地不动;负数也不会往回跳", () => {
    expect(followTowards(3, 9, 0)).toBe(3);
    expect(followTowards(3, 9, -50)).toBe(3);
  });
});
