import { describe, expect, it } from "vitest";
import {
  DRAW_DISTANCE,
  FOG_START,
  LANE_SPACING_RATIO,
  MAX_STAGE_WIDTH,
  SPLIT_BREAKPOINT,
  depthScale,
  fogAlpha,
  gridLineZs,
  groundY,
  horizonY,
  jumpArc,
  laneWidthAt,
  paneRects,
  parallaxOffset,
  project,
  slideSquash,
  splitLayout,
  stageSize,
} from "./view25d";

const PANE = { x: 0, y: 0, width: 360, height: 200 };

describe("分屏布局", () => {
  it("窄屏上下分、宽屏左右分", () => {
    expect(splitLayout(375)).toBe("column");
    expect(splitLayout(SPLIT_BREAKPOINT - 1)).toBe("column");
    expect(splitLayout(SPLIT_BREAKPOINT)).toBe("row");
    expect(splitLayout(1280)).toBe("row");
  });

  it("375 的手机竖屏画布不会超出屏宽", () => {
    const size = stageSize(375);
    expect(size.layout).toBe("column");
    expect(size.width).toBeLessThanOrEqual(375);
    expect(size.height).toBeGreaterThan(0);
  });

  it("1280 的桌面窗口画布封顶,不会拉成一条", () => {
    const size = stageSize(1280);
    expect(size.layout).toBe("row");
    expect(size.width).toBe(MAX_STAGE_WIDTH);
    expect(size.height).toBeLessThan(size.width);
  });

  it("两格加起来正好铺满画布,不重叠也不留缝", () => {
    for (const width of [320, 375, 720, 1024, 1280]) {
      const size = stageSize(width);
      const [a, b] = paneRects(size, size.layout);
      if (size.layout === "column") {
        expect(a.height + b.height).toBeCloseTo(size.height, 6);
        expect(b.y).toBeCloseTo(a.y + a.height, 6);
        expect(a.width).toBe(size.width);
      } else {
        expect(a.width + b.width).toBeCloseTo(size.width, 6);
        expect(b.x).toBeCloseTo(a.x + a.width, 6);
        expect(a.height).toBe(size.height);
      }
    }
  });
});

describe("2.5D 透视投影", () => {
  it("脚下不缩放,越远缩得越小", () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(20)).toBeLessThan(depthScale(5));
    expect(depthScale(DRAW_DISTANCE)).toBeGreaterThan(0);
    expect(depthScale(DRAW_DISTANCE)).toBeLessThan(0.2);
  });

  it("三条道向远处收拢到一个点", () => {
    const nearGap = Math.abs(project(PANE, 2, 0).x - project(PANE, 2, 2).x);
    const midGap = Math.abs(project(PANE, 30, 0).x - project(PANE, 30, 2).x);
    const farGap = Math.abs(project(PANE, 120, 0).x - project(PANE, 120, 2).x);
    expect(midGap).toBeLessThan(nearGap);
    expect(farGap).toBeLessThan(midGap);
    expect(farGap).toBeGreaterThan(0);
  });

  it("中间那条道永远在正中央", () => {
    for (const z of [0, 10, 60, 120]) {
      expect(project(PANE, z, 1).x).toBeCloseTo(PANE.x + PANE.width / 2, 6);
    }
  });

  it("越远越贴近地平线,但不会翻到地平线上面去", () => {
    const near = project(PANE, 0, 1).y;
    const far = project(PANE, 120, 1).y;
    expect(near).toBeCloseTo(groundY(PANE), 6);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(horizonY(PANE));
  });

  it("下半格的两个人各自算各自的坐标,不会画到对方那一格去", () => {
    const size = stageSize(375);
    const [top, bottom] = paneRects(size, size.layout);
    const a = project(top, 12, 0);
    const b = project(bottom, 12, 0);
    expect(a.y).toBeLessThan(top.y + top.height);
    expect(b.y).toBeGreaterThan(bottom.y);
    expect(b.y - a.y).toBeCloseTo(bottom.y - top.y, 6);
  });

  it("带小数的车道位置刚好落在两条道中间(换道动画用)", () => {
    const left = project(PANE, 8, 0).x;
    const mid = project(PANE, 8, 1).x;
    expect(project(PANE, 8, 0.5).x).toBeCloseTo((left + mid) / 2, 6);
  });
});

describe("远端雾化与滚动网格", () => {
  it("近处不起雾,远端糊成一片", () => {
    const half = (FOG_START + DRAW_DISTANCE) / 2;
    expect(fogAlpha(0)).toBe(0);
    expect(fogAlpha(FOG_START)).toBe(0);
    expect(fogAlpha(DRAW_DISTANCE)).toBe(1);
    expect(fogAlpha(half)).toBeCloseTo(0.5, 6);
    expect(FOG_START).toBeLessThan(DRAW_DISTANCE);
  });

  it("障碍在最后几秒里是稳稳变大的,不会挤在地平线上突然弹出来", () => {
    // 以中等速度 60 米/秒计，前方 2 秒的东西至少要落在路面的中段以下
    const pane = { x: 0, y: 0, width: 360, height: 200 };
    const top = horizonY(pane);
    const bottom = groundY(pane);
    const at2s = project(pane, 120, 1).y;
    const at1s = project(pane, 60, 1).y;
    const progress = (y: number): number => (y - top) / (bottom - top);
    expect(progress(at2s)).toBeGreaterThan(0.15);
    expect(progress(at1s)).toBeGreaterThan(0.3);
    expect(progress(at1s)).toBeGreaterThan(progress(at2s));
  });

  it("同一条道上的东西,不管上下分屏还是左右分屏都占车道的同一个比例", () => {
    const tall = { x: 0, y: 0, width: 320, height: 180 };
    const wide = { x: 0, y: 0, width: 480, height: 340 };
    const ratio = (pane: typeof tall): number =>
      laneWidthAt(pane, 20) / (LANE_SPACING_RATIO * pane.width);
    expect(ratio(tall)).toBeCloseTo(ratio(wide), 6);
    expect(laneWidthAt(tall, 0)).toBeCloseTo(LANE_SPACING_RATIO * tall.width, 6);
    expect(laneWidthAt(tall, 50)).toBeLessThan(laneWidthAt(tall, 10));
  });

  it("网格线始终等间距铺满可视距离", () => {
    const zs = gridLineZs(0, 10);
    expect(zs[0]).toBeCloseTo(10, 6);
    expect(zs[zs.length - 1]).toBeLessThan(DRAW_DISTANCE);
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeCloseTo(10, 6);
  });

  it("人往前跑,网格线就往后掠(第一条线越来越近)", () => {
    expect(gridLineZs(0, 10)[0]).toBeCloseTo(10, 6);
    expect(gridLineZs(3, 10)[0]).toBeCloseTo(7, 6);
    expect(gridLineZs(9.5, 10)[0]).toBeCloseTo(0.5, 6);
    expect(gridLineZs(10, 10)[0]).toBeCloseTo(10, 6);
  });

  it("远景视差层挪得比近景慢,而且永远在一个循环里", () => {
    const near = parallaxOffset(500, 0.4, 120);
    const far = parallaxOffset(500, 0.08, 120);
    expect(near).toBeGreaterThanOrEqual(0);
    expect(near).toBeLessThan(120);
    expect(far).toBeGreaterThanOrEqual(0);
    expect(far).toBeLessThan(120);
    expect(parallaxOffset(50, 0.4, 120)).toBeCloseTo(20, 6);
    expect(parallaxOffset(50, 0.08, 120)).toBeCloseTo(4, 6);
  });
});

describe("跳跃与下滑的动画曲线", () => {
  it("跳跃是一条起落对称的弧线,最高点在正中间", () => {
    expect(jumpArc(0)).toBe(0);
    expect(jumpArc(1)).toBe(0);
    expect(jumpArc(0.5)).toBeCloseTo(1, 6);
    expect(jumpArc(0.25)).toBeCloseTo(jumpArc(0.75), 6);
  });

  it("下滑时人物压扁,中段最扁,起落都恢复原样", () => {
    expect(slideSquash(0)).toBe(1);
    expect(slideSquash(1)).toBe(1);
    expect(slideSquash(0.5)).toBeLessThan(0.6);
    expect(slideSquash(0.5)).toBeGreaterThan(0.4);
  });
});
