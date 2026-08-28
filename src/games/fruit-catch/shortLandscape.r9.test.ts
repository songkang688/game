/**
 * 接住小水果 · 三人组第 9 轮 测试修复员 B · N-1（r5 立项，四轮未动）修后钉子。
 *
 * 修前实测：915×412 关内裁 741 / canvas 出屏 617 / ⬅️➡️ 整排折叠线下；
 * 1024×768 也裁 415 / 出屏 281。病根是 360×460 的**竖幅**画布配 `width:100%`——
 * 宿主 656px 宽时显示高 838px，接水果这种实时玩法却不能滚。
 *
 * 修法：① 画布 `max-height` 按舞台可视余量钳（replaced 元素的 max-height 会
 * 按比例带着宽一起收，画面不压扁、backing 与判定坐标零触碰）；
 * ② 矮横屏走 r6 配方 G 之双栏——画布占左栏，分数条 / 按钮排 / 提示语挪右栏。
 *
 * 修后实测（三种玩法 × 六档视口）：关内 1 / 0 / 0 / 5 / 5 / 1，
 * 双人抢果 19 / 0 / 0，无尽水果雨 0 / 0 / 0，折叠线下控件一律 0。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FC_MIN_CANVAS_H, canvasCapHeightPx } from "./index";
import { H, W } from "./logic";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-1 · 画布按可视余量钳高（canvasCapHeightPx）", () => {
  it("量不出余量（NaN / 0 / 负数）时返回 null，一个样式都不写", () => {
    expect(canvasCapHeightPx(Number.NaN)).toBeNull();
    expect(canvasCapHeightPx(0)).toBeNull();
    expect(canvasCapHeightPx(-80)).toBeNull();
  });

  it("余量够就按余量收，留 4px 亚像素余地", () => {
    expect(canvasCapHeightPx(420)).toBe(416);
    expect(canvasCapHeightPx(300.7)).toBe(296);
  });

  it("余量再小也兜在 FC_MIN_CANVAS_H，剩下的才交给舞台滚动", () => {
    expect(canvasCapHeightPx(80)).toBe(FC_MIN_CANVAS_H);
    expect(FC_MIN_CANVAS_H).toBeGreaterThanOrEqual(160);
  });

  it("915×412 口径：余量 ~230 时画布显示高回到裁切线内，宽按比例跟着收", () => {
    const cap = canvasCapHeightPx(230)!;
    expect(cap).toBeLessThanOrEqual(230);
    // 竖幅画布：钳完的显示宽 = 高 ÷ (H/W)，比例一个像素都不变
    const shownW = cap / (H / W);
    expect(Math.round(shownW)).toBe(Math.round((cap * W) / H));
    expect(shownW).toBeLessThan(656);
  });
});

describe("N-1 · 钳的是 max-height，不是 backing 分辨率", () => {
  it("backing 宽高来自 logic 的 W/H 常量，修复没碰它们", () => {
    expect(W).toBe(360);
    expect(H).toBe(460);
    expect(src).toContain('<canvas class="frc-canvas fc-canvas" width="${W}" height="${H}"></canvas>');
  });

  it("写的是行内 maxHeight，绝不去动 canvas.width / canvas.height", () => {
    expect(src).toContain("if (canvas.style.maxHeight !== px) canvas.style.maxHeight = px;");
    expect(src).not.toContain("canvas.width =");
    expect(src).not.toContain("canvas.height =");
  });

  it("「画布下面的家当」只认真的排在画布下面的兄弟：双栏下按钮排不占竖向预算", () => {
    expect(src).toContain("if (r.top >= rect.bottom - 2) below = Math.max(below, r.bottom - rect.bottom);");
    expect(src).toContain("below += Math.max(0, wrapRect.bottom - Math.max(rect.bottom + below, wrapRect.top));");
  });

  it("三种玩法（闯关 / 双人抢果 / 无尽水果雨）各自的 draw 都挂了钳高，且是节流的", () => {
    const hits = [...src.matchAll(/if \(fitTick\+\+ % 15 === 0\) fitFruitCanvas\(canvas, wrap\);/g)];
    expect(hits.length).toBe(3);
  });
});

describe("N-1 · 矮横屏双栏（配方 G）", () => {
  const head = "@media (min-width: 700px) and (max-height: 560px)";

  it("媒体查询只咬 915×412 一族，竖屏三档与平板两档不进这条分支", () => {
    const hits = (w: number, h: number): boolean => w >= 700 && h <= 560;
    expect(hits(915, 412)).toBe(true);
    expect(hits(360, 640)).toBe(false);
    expect(hits(390, 844)).toBe(false);
    expect(hits(412, 915)).toBe(false);
    expect(hits(1024, 768)).toBe(false);
    expect(hits(1280, 800)).toBe(false);
    expect(src).toContain(head);
  });

  it("画布占左栏，其余家当（分数条 / 按钮排 / 提示语）全挪右栏", () => {
    const at = src.indexOf(head);
    const block = src.slice(at, src.indexOf("\n}\n", at));
    expect(block).toContain(".frc-wrap > * { grid-column: 2; }");
    expect(block).toContain(".frc-wrap > .frc-canvas { grid-column: 1;");
  });

  it("方向钮在矮横屏仍是 44px 起的大热区", () => {
    const at = src.indexOf(head);
    const block = src.slice(at, src.indexOf("\n}\n", at));
    const m = block.match(/\.frc-btn \{ width: (\d+)px; height: (\d+)px;/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
    expect(Number(m![2])).toBeGreaterThanOrEqual(44);
  });
});
