/**
 * 2.5D 双面块 · 单测。
 * 记录桩把每一次路径落点都收进来,验证「侧面与顶面全画在本格里」这条铁律;
 * 颜色那半验证顶面 = 主色、侧面 = shade(-22)、sideRatio 默认 0.18。
 */
import { describe, expect, it } from "vitest";
import { hexToRgb, shade, withAlpha } from "./palette";
import { SIDE_RATIO, SIDE_SHADE, blockFaces, roundRectPath, topSideBlock, type BlockCtx } from "./block25d";

/** 记录桩:收集全部路径坐标,顺带记 fill 时用的是什么颜色 */
class RecordCtx implements BlockCtx {
  fillStyle: unknown = "";
  xs: number[] = [];
  ys: number[] = [];
  fills: unknown[] = [];
  beginPath(): void {}
  closePath(): void {}
  moveTo(x: number, y: number): void {
    this.xs.push(x);
    this.ys.push(y);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number): void {
    this.xs.push(x1, x2);
    this.ys.push(y1, y2);
  }
  fill(): void {
    this.fills.push(this.fillStyle);
  }
}

describe("art/kit · palette", () => {
  it("shade:负往黑走、正往白走,输出永远是合法 #RRGGBB", () => {
    expect(shade("#E2A87A", -22)).toMatch(/^#[0-9a-f]{6}$/i);
    const [r0] = hexToRgb("#E2A87A");
    const [rDark] = hexToRgb(shade("#E2A87A", -22));
    const [rLight] = hexToRgb(shade("#E2A87A", 22));
    expect(rDark).toBeLessThan(r0);
    expect(rLight).toBeGreaterThan(r0);
    // 认不出的颜色当中灰,画画路上不许抛错
    expect(shade("not-a-color", -22)).toMatch(/^#[0-9a-f]{6}$/i);
    // 提到 255 以上也夹得住:纯白再加光还是纯白
    expect(shade("#FFFFFF", 22)).toBe("#ffffff");
    expect(withAlpha("#F4859F", 0.5)).toBe("rgba(244,133,159,0.5)");
  });

  it("shade(-22) 是双面块的侧面档位:三通道等比压暗 22%", () => {
    const [r, g, b] = hexToRgb("#C9D3DE");
    const [sr, sg, sb] = hexToRgb(shade("#C9D3DE", -22));
    expect(sr).toBe(Math.round(r * 0.78));
    expect(sg).toBe(Math.round(g * 0.78));
    expect(sb).toBe(Math.round(b * 0.78));
  });
});

describe("art/kit · block25d 双面块", () => {
  it("顶面 = 主色、侧面 = shade(-22),sideRatio 全库统一 0.18", () => {
    expect(SIDE_RATIO).toBe(0.18);
    expect(SIDE_SHADE).toBe(-22);
    const faces = blockFaces("#E2A87A");
    expect(faces.top).toBe("#E2A87A");
    expect(faces.side).toBe(shade("#E2A87A", -22));
  });

  it("双面块的每一笔都收在 (x,y,w,h) 盒子里 —— 侧面画进格内,不脏隔壁格", () => {
    const c = new RecordCtx();
    topSideBlock(c, 10, 20, 26, 26, "#E2A87A");
    expect(c.xs.length).toBeGreaterThan(4);
    for (const x of c.xs) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(36);
    }
    for (const y of c.ys) {
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(46);
    }
    // 两次 fill:先侧面(暗)后顶面(主色)
    expect(c.fills).toEqual([shade("#E2A87A", -22), "#E2A87A"]);
  });

  it("roundRectPath 半径夹到 min(w,h)/2,窄条也画得出来", () => {
    const c = new RecordCtx();
    roundRectPath(c, 0, 0, 4, 2, 8);
    for (const x of c.xs) expect(x).toBeGreaterThanOrEqual(0);
    for (const x of c.xs) expect(x).toBeLessThanOrEqual(4);
  });
});
