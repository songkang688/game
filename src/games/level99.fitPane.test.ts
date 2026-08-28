import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fitPaneH } from "./level99";

/**
 * trio-r4 遗留:orb-arena / snake-royale 关内壳卡比内容高一大截,卡底露白。
 * 修法是进关时量一次缺口,把竞技场画布逻辑高等比补足(fitPaneH 是纯换算,可直接测)。
 */
describe("fitPaneH 竞技场画布钳高", () => {
  it("竖屏手机:640 逻辑宽显示成 311px,250px 缺口换算后画布明显加高", () => {
    // delta = 250 * (640/311) ≈ 514 → 360+514 = 874
    expect(fitPaneH(360, 640, 311, 250, 1)).toBe(874);
  });

  it("平板 1024×768:显示宽=逻辑宽时缺口 1:1 折进逻辑高", () => {
    expect(fitPaneH(360, 640, 640, 76, 1)).toBe(436);
  });

  it("缺口巨大时钳在 960,竖屏不会拉成一根面条", () => {
    expect(fitPaneH(360, 640, 311, 2000, 1)).toBe(960);
  });

  it("矮横屏内容溢出(gap<0)允许收窄,但不低于 240", () => {
    expect(fitPaneH(360, 640, 648, -255, 1)).toBe(240);
  });

  it("下限不许反向抬高本来就矮的分屏画布", () => {
    expect(fitPaneH(200, 640, 640, 0, 1)).toBe(200);
    expect(fitPaneH(224, 640, 640, -500, 2)).toBe(224);
  });

  it("竖排分屏两行平分缺口", () => {
    // 每行 delta = (250/2) * (640/311) ≈ 257 → 200+257 = 457
    expect(fitPaneH(200, 640, 311, 250, 2)).toBe(457);
  });

  it("量不出显示宽或行数非法时原样返回", () => {
    expect(fitPaneH(360, 640, 0, 250, 1)).toBe(360);
    expect(fitPaneH(360, 640, 311, 250, 0)).toBe(360);
    expect(fitPaneH(360, 640, 311, Number.NaN, 1)).toBe(360);
  });
});

describe("两款竞技场都在进关时调用了钳高", () => {
  it.each(["orb-arena", "snake-royale"])("%s 建完画布后调用 fitPanesToStage", (id) => {
    const src = readFileSync(join(__dirname, id, "index.ts"), "utf8");
    expect(src).toContain("fitPanesToStage(wrap, canvases, paneW, paneH)");
  });
});
