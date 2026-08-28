/**
 * snow-fight · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * S5:无尽雪怪从「无渐变纯白双圆 + 两点眼」升级为三停渐变双球 + 冷蓝底影 +
 *     深青歪毛线帽(第三帽形)+ 竖椭圆眼白高光,圆心半径与 1.2 同位。
 * B2:seat1 帽体加深到 shade(-18),两帽灰度亮度差 ≥ 15/255。
 * G3:命中反馈冒泡从 8 种 emoji 字形换成白 + 冷蓝两停溅雪(reduced 单帧淡出)。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hexToRgb, shade } from "../../art/kit/palette";
import { FakeCtx } from "./domStub";
import { SNF_PUFF_COLORS, SNF_PUFF_DOTS, paintFeedbackPuff, paintSnowFoe } from "./paint13";
import { HAT_BODY_SHADE, SNF_PALETTE, SNOWFOE_BODY_STOPS, SNOWFOE_HAT } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

function ctx(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

/** 感知亮度(0–255):双人 16px 灰度专项的同一把尺 */
function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe("snow-fight · 修复员 S5 · 无尽雪怪重绘", () => {
  it("雪怪画得动不抛:常规尺寸与最小尺寸都不炸", () => {
    expect(() => paintSnowFoe(ctx(), 100, 80, 12)).not.toThrow();
    expect(() => paintSnowFoe(ctx(), 0, 0, 1)).not.toThrow();
  });

  it("双球圆心半径与 1.2 同位(身球 y+0.5r·0.95r / 头球 y−0.55r·0.68r),判定footprint不变", () => {
    const g = new FakeCtx();
    paintSnowFoe(g as unknown as CanvasRenderingContext2D, 100, 80, 10);
    const arcs = g.ops.filter((o) => o.op === "arc");
    expect(arcs.some((o) => o.args[0] === 100 && o.args[1] === 85 && Math.abs(o.args[2] - 9.5) < 1e-6)).toBe(true);
    expect(arcs.some((o) => o.args[0] === 100 && o.args[1] === 74.5 && Math.abs(o.args[2] - 6.8) < 1e-6)).toBe(true);
  });

  it("眼睛升级为竖椭圆(ry > rx)+ 底影 / 下缘冷蓝椭圆在场", () => {
    const g = new FakeCtx();
    paintSnowFoe(g as unknown as CanvasRenderingContext2D, 100, 80, 10);
    const eyes = g.ops.filter((o) => o.op === "ellipse" && o.args[3] > o.args[2]);
    expect(eyes.length).toBeGreaterThanOrEqual(2);
    const flats = g.ops.filter((o) => o.op === "ellipse" && o.args[2] > o.args[3]);
    expect(flats.length).toBeGreaterThanOrEqual(2);
  });

  it("三停渐变与帽色是合法色值,帽色与两队主色都不同(第三帽形配色)", () => {
    for (const c of SNOWFOE_BODY_STOPS) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SNOWFOE_HAT).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(SNOWFOE_HAT).not.toBe(SNF_PALETTE.sfPink);
    expect(SNOWFOE_HAT).not.toBe(SNF_PALETTE.sfBlue);
    // 底停必须比顶停暗:三停才立得住
    expect(luma(SNOWFOE_BODY_STOPS[2])).toBeLessThan(luma(SNOWFOE_BODY_STOPS[0]));
  });

  it("index.ts 的 snowfoe 分支已改走 paintSnowFoe,纯白平涂不回流", () => {
    const src = read("index.ts");
    expect(src).toContain("paintSnowFoe(");
    expect(src).not.toMatch(/snowfoe"\)\s*\{\s*\n\s*c\.fillStyle = "#ffffff"/);
  });
});

describe("snow-fight · 修复员 B2 · seat1 帽体加深", () => {
  it("seat1 帽体加深 ≥10 档,seat0 保持 -6 不回退", () => {
    expect(HAT_BODY_SHADE[0]).toBe(-6);
    expect(HAT_BODY_SHADE[1]).toBeLessThanOrEqual(-16);
  });

  it("两帽体色灰度亮度差 ≥ 15/255(色弱可辨,不再只靠帽形)", () => {
    const hat0 = shade(SNF_PALETTE.sfPink, HAT_BODY_SHADE[0]);
    const hat1 = shade(SNF_PALETTE.sfBlue, HAT_BODY_SHADE[1]);
    expect(Math.abs(luma(hat0) - luma(hat1))).toBeGreaterThanOrEqual(15);
  });
});

describe("snow-fight · 修复员 G3 · 反馈冒泡换溅雪", () => {
  it("溅雪画得动不抛:寿命两端 / 常规与 reduced 都不炸", () => {
    for (const reduced of [false, true]) {
      for (const k of [0, 0.5, 0.99]) {
        expect(() => paintFeedbackPuff(ctx(), 100, 60, 12, k, reduced)).not.toThrow();
      }
    }
  });

  it("粒数在 6–10 档内,两停配色是雪白 + 冷蓝", () => {
    expect(SNF_PUFF_DOTS).toBeGreaterThanOrEqual(6);
    expect(SNF_PUFF_DOTS).toBeLessThanOrEqual(10);
    expect(SNF_PUFF_COLORS[0]).toBe("#FFFFFF");
    expect(luma(SNF_PUFF_COLORS[1])).toBeLessThan(luma(SNF_PUFF_COLORS[0]));
  });

  it("reduced 单帧淡出:不同寿命进度下粒子圆心不动(只降 alpha / 缩粒径)", () => {
    const centers = (k: number, reduced: boolean): string => {
      const g = new FakeCtx();
      paintFeedbackPuff(g as unknown as CanvasRenderingContext2D, 100, 60, 12, k, reduced);
      return JSON.stringify(g.ops.filter((o) => o.op === "arc").map((o) => [o.args[0], o.args[1]]));
    };
    expect(centers(0.2, true)).toBe(centers(0.7, true));
    // 常规档确实外扩(圆心随 k 变)
    expect(centers(0.2, false)).not.toBe(centers(0.7, false));
  });

  it("index.ts 冒泡账本不再携带 emoji 字形(Puff.face 退场,fillText 不喂反馈)", () => {
    const src = read("index.ts");
    expect(src).not.toContain("face:");
    expect(src).not.toContain("fillText(p.face");
    for (const e of ["📦", "🛡️", "💥", "💨", "✨"]) expect(src).not.toContain(e);
  });
});
