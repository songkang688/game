/**
 * 朵星台球 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项③量化锚：暖 / 冷两阵营主色灰度几乎同档（Δ < 12/255），
 *     所以「花印 vs 星印」的形状通道必须存在——两阵营压印的绘制序列不许相同，
 *     极小尺寸(simple)也要保住「圆点 vs 菱形点」的形状差；
 *  ② 专项②：球体三停(light/base/dark)灰度严格分阶。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALL_COLORS, paintBallStamp, resetArtCache } from "./art";
import { installDom, makeRecordingCtx, restoreDom, type Dom } from "./domStub";

let dom: Dom;
beforeEach(() => {
  dom = installDom(800);
  resetArtCache();
});
afterEach(() => {
  void dom;
  restoreDom();
});

function lum(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

describe("专项③:阵营靠形状+颜色双通道", () => {
  it("暖/冷主色灰度同档(Δ<12),正是因此形状通道不可少", () => {
    const d = Math.abs(lum(BALL_COLORS.warm.base) - lum(BALL_COLORS.cool.base));
    expect(d).toBeLessThan(12);
  });

  it("正常尺寸:暖阵营画花印、冷阵营画星印,绘制序列不同", () => {
    const a = makeRecordingCtx();
    paintBallStamp(a.ctx as CanvasRenderingContext2D, "warm", 12, false);
    const b = makeRecordingCtx();
    paintBallStamp(b.ctx as CanvasRenderingContext2D, "cool", 12, false);
    expect(a.ops.length).toBeGreaterThan(0);
    expect(b.ops.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.ops)).not.toBe(JSON.stringify(b.ops));
  });

  it("极小尺寸(simple):暖是圆点(arc)、冷是菱形点(lineTo),形状差保住", () => {
    const a = makeRecordingCtx();
    paintBallStamp(a.ctx as CanvasRenderingContext2D, "warm", 4, true);
    const b = makeRecordingCtx();
    paintBallStamp(b.ctx as CanvasRenderingContext2D, "cool", 4, true);
    expect(a.names()).toContain("arc");
    expect(a.names()).not.toContain("lineTo");
    expect(b.names()).toContain("lineTo");
    expect(b.names()).not.toContain("arc");
  });
});

describe("专项②:球体三停分阶", () => {
  it("四类球 light/base/dark 的灰度严格递减", () => {
    for (const kind of ["cue", "warm", "cool", "black"] as const) {
      const c = BALL_COLORS[kind];
      expect(lum(c.light), `${kind} light>base`).toBeGreaterThan(lum(c.base));
      expect(lum(c.base), `${kind} base>dark`).toBeGreaterThan(lum(c.dark));
    }
  });
});
