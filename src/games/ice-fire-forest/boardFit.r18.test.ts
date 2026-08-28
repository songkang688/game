/** 三人组 r18 · N-103 闯关主画布 915×412 底切 59px（画布 232~471,预算没扣壳高） */
import { describe, expect, it } from "vitest";
import { boardHeightBudget, clampBoardBudget } from "./logic";

describe("N-103 画布预算按真实余量钳一刀", () => {
  it("915×412 实测:画布顶 232,余量 174 装不下 239 预算,钳完底边进 412", () => {
    const budget = boardHeightBudget(915, 412);
    const boardTop = 232;
    const room = 412 - boardTop - 6;
    const clamped = clampBoardBudget(budget, room);
    expect(budget, "没钳之前确实超余量(这就是切 59px 的病根)").toBeGreaterThan(room);
    expect(clamped).toBeLessThanOrEqual(room);
    expect(boardTop + clamped, "画布底必须进 412").toBeLessThanOrEqual(412);
    expect(clamped, "画布不能矮过 sidePads 下限,矮了看不清").toBeGreaterThanOrEqual(120);
  });

  it("量不到余量(jsdom / 首帧)或余量够宽时原样放行,竖屏 390×844 不回退", () => {
    const budget = boardHeightBudget(390, 844);
    expect(clampBoardBudget(budget, Number.NaN)).toBe(budget);
    expect(clampBoardBudget(budget, 0)).toBe(budget);
    expect(clampBoardBudget(budget, budget)).toBe(budget);
    expect(clampBoardBudget(budget, 638)).toBe(budget);
  });

  it("余量再挤也守住 120px 下限,交给摄像机跟随", () => {
    expect(clampBoardBudget(239, 60)).toBe(120);
  });
});
