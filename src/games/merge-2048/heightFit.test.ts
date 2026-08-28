// 竖向裁切审计修复:格子边长以前只按视口宽算——横屏 640×360 上 4×4 盘面给出
// 116px 一格、连缝 494px 高,而 `.game-stage` 的可视高只剩 ~280px:盘面下半截
// 连同方向按钮排一起被裁掉。修法:`cellPxFor` 多收一个竖向预算,盘面高度同样
// 不许超;预算量不出来时行为和从前一字不差。
import { describe, expect, it } from "vitest";
import { TABLE_CHROME_PX, boardHeightBudget, cellPxFor } from "./index";

/** 和 createSeat 的 span 公式同一口径:size 格 + (size+1) 条 6px 的缝 */
const GAP = 6;
const spanOf = (size: number, cell: number): number => size * cell + (size + 1) * GAP;

describe("cellPxFor · 竖向预算", () => {
  it("不给预算(或 Infinity / NaN / ≤0)时和老行为一字不差", () => {
    for (const size of [4, 5, 6]) {
      for (const w of [320, 360, 420, 640, 1024]) {
        const legacy = cellPxFor(size, w);
        expect(cellPxFor(size, w, 1, Number.POSITIVE_INFINITY)).toBe(legacy);
        expect(cellPxFor(size, w, 1, Number.NaN)).toBe(legacy);
        expect(cellPxFor(size, w, 1, 0)).toBe(legacy);
        expect(cellPxFor(size, w, 1, -100)).toBe(legacy);
      }
    }
  });

  it("横屏 640×360 实测口径:预算 ~250px 时盘面高不超预算", () => {
    const cell = cellPxFor(4, 640, 1, 250);
    expect(spanOf(4, cell)).toBeLessThanOrEqual(250);
    // 老行为(只按宽)会给 116px 一格、494px 高——正是被裁掉的那一档
    expect(cellPxFor(4, 640)).toBeGreaterThan(cell);
  });

  it("预算再紧也兜在 34px(可读下限),剩下的交给舞台滚动", () => {
    expect(cellPxFor(4, 640, 1, 60)).toBe(34);
    expect(cellPxFor(6, 360, 1, 40)).toBe(34);
  });

  it("竖屏 360×640:预算宽裕时格子尺寸不变(不误伤原有布局)", () => {
    // 640 视口 − 顶栏/HUD/按钮排(~TABLE_CHROME_PX) ≈ 400+,比宽向预算松
    expect(cellPxFor(4, 360, 1, 420)).toBe(cellPxFor(4, 360));
  });

  it("双人分屏(seats=2)同样受竖向预算钳制", () => {
    const cell = cellPxFor(4, 640, 2, 200);
    expect(spanOf(4, cell)).toBeLessThanOrEqual(200);
  });
});

describe("boardHeightBudget · 量不到就不设限", () => {
  it("host 为空或没有 getBoundingClientRect 时返回 Infinity", () => {
    expect(boardHeightBudget(null)).toBe(Number.POSITIVE_INFINITY);
    expect(boardHeightBudget({} as unknown as HTMLElement)).toBe(Number.POSITIVE_INFINITY);
  });

  it("找不到 .game-stage 祖先(独立挂载 / 测试桩)时返回 Infinity", () => {
    const host = {
      getBoundingClientRect: () => ({ top: 100, height: 0 }),
      parentElement: null
    } as unknown as HTMLElement;
    expect(boardHeightBudget(host)).toBe(Number.POSITIVE_INFINITY);
  });

  it("量得到裁切线:预算 = 裁切线 − host 顶 − 桌面家当", () => {
    const stage = {
      className: "game-stage",
      getBoundingClientRect: () => ({ top: 60, height: 300 }),
      clientTop: 4,
      clientHeight: 292,
      parentElement: null
    };
    const host = {
      getBoundingClientRect: () => ({ top: 70, height: 0 }),
      parentElement: stage
    } as unknown as HTMLElement;
    // 裁切线 = 60 + 4 + 292 = 356;预算 = 356 − 70 − TABLE_CHROME_PX
    expect(boardHeightBudget(host)).toBe(356 - 70 - TABLE_CHROME_PX);
  });

  it("量出非正数(还没排好版)时不设限,别把盘面钳没", () => {
    const stage = {
      className: "game-stage",
      getBoundingClientRect: () => ({ top: 0, height: 100 }),
      clientTop: 0,
      clientHeight: 100,
      parentElement: null
    };
    const host = {
      getBoundingClientRect: () => ({ top: 0, height: 0 }),
      parentElement: stage
    } as unknown as HTMLElement;
    expect(boardHeightBudget(host)).toBe(Number.POSITIVE_INFINITY);
  });
});
