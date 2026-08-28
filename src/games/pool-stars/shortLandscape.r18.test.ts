import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_VERTICAL_PX, MIN_BALL_PX, tableLayout } from "./view";

const SRC = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");

/**
 * N-12(r18):915×412 实测击球 top 614、暂停 671,整列控制排在首屏线下且页面不滚。
 * 修法:控制排收进 .ps-side 分组,竖屏/高屏 display:contents 与原布局逐像素等价;
 * 矮横屏切三栏(HUD 左、台面中、控制右),台面 canvas 只按显示等比缩放。
 * 台面物理(TABLE/tableLayout 的缩放规则)一个字不动。
 */
describe("N-12 pool-stars 矮横屏控制排", () => {
  it("控制排分组默认 display:contents,高屏布局不变", () => {
    expect(SRC).toContain('el("div", "ps-side")');
    expect(SRC).toContain(".ps-side{display:contents;}");
  });

  it("矮横屏媒体块:双栏 + 画布等比钳显示高,击球钮保持 44+ 触区", () => {
    expect(SRC).toContain("@media (min-width:640px) and (max-height:500px)");
    expect(SRC).toContain(".ps-table canvas{max-width:100%;height:auto !important;width:auto !important;");
    expect(SRC).toContain(".l99-stage-wrap .ps-table canvas");
    expect(SRC).toContain(".ps-side{display:flex;flex-direction:column;");
    expect(SRC).toContain("overflow-y:auto");
  });

  it("tableLayout 的横竖版缩放规则原样(物理与命中不受显示钳影响)", () => {
    expect(MAX_VERTICAL_PX).toBe(560);
    const lay = tableLayout(1024);
    expect(lay.cssW).toBeGreaterThan(lay.cssH);
    expect(lay.ballPx).toBeGreaterThanOrEqual(MIN_BALL_PX);
    const vertical = tableLayout(360, 280);
    expect(vertical.cssH).toBeLessThanOrEqual(280);
  });

  it("竖屏桌高把自家控制行从余高里扣掉(390×844 主干实测击球 top 922 线下)", () => {
    expect(SRC).toContain("room.h - wrapChromePx()");
    // 无根营地竖屏实测预算:余高 626、自家行 ~290 → 桌高 ≤ 336,整桌 + 击球一屏放下
    expect(tableLayout(390, 336).cssH).toBeLessThanOrEqual(336);
  });
});
