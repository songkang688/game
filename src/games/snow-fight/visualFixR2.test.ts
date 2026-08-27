/**
 * snow-fight · 1.3 窗口 5 第 2 轮监督修复员 · 修复配套用例。
 *
 * N1(= R1 G3 修复不彻底的座位标半项,见 docs/qa/1.3-window5-round2-tester.md):
 * 头顶座位标与暖手火苗从画布 fillText emoji 字形换成 paint13 自绘徽记
 * (seat 0 五瓣小花 / seat 1 五角金星 / 暖手两停渐变火苗)。
 * 修后水位:画布 fillText 3 → 1(只剩风旗功能字)、emoji 码点 55 → 53,
 * 这里把 R2 测试员的 ratchet 再拧紧一格,只降不升。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { paintSeatMark, paintWarmFlame, SEAT_STAR_GOLD, WARM_FLAME_STOPS } from "./paint13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const DRAW_FILES = ["index.ts", "paint13.ts", "visual13.ts"];
const drawSrc = (): string => DRAW_FILES.map(read).join("\n");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("snow-fight · 修复员 R2 · N1 座位标与暖手矢量化", () => {
  it("座位标两队 × 暖手火苗都画得动不抛,极小尺寸与非法尺寸不炸", () => {
    for (const seat of [0, 1] as const) {
      expect(() => paintSeatMark(ctx2d(new FakeCtx()), 40, 30, 8, seat)).not.toThrow();
      expect(() => paintSeatMark(ctx2d(new FakeCtx()), 4, 4, 1.2, seat)).not.toThrow();
      expect(() => paintSeatMark(ctx2d(new FakeCtx()), 4, 4, 0, seat)).not.toThrow();
    }
    expect(() => paintWarmFlame(ctx2d(new FakeCtx()), 40, 30, 8)).not.toThrow();
    expect(() => paintWarmFlame(ctx2d(new FakeCtx()), 4, 4, 0)).not.toThrow();
  });

  it("两队座位标形状通道拉得开:朵朵五瓣花走圆弧(≥6 圆),星星金星走折线(0 圆)", () => {
    const arcsOf = (seat: 0 | 1): number => {
      const c = new FakeCtx();
      paintSeatMark(ctx2d(c), 40, 30, 8, seat);
      return c.ops.filter((o) => o.op === "arc").length;
    };
    expect(arcsOf(0)).toBeGreaterThanOrEqual(6);
    expect(arcsOf(1)).toBe(0);
  });

  it("暖手火苗是两停渐变(顶暖黄 → 底深橙),不是平涂", () => {
    const c = new FakeCtx();
    paintWarmFlame(ctx2d(c), 40, 30, 8);
    const grads = c.ops.filter((o) => o.op === "gradient");
    expect(grads.length).toBeGreaterThanOrEqual(1);
    expect(WARM_FLAME_STOPS[0]).not.toBe(WARM_FLAME_STOPS[1]);
    expect(SEAT_STAR_GOLD).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("index.ts 已换 paintSeatMark / paintWarmFlame,头顶字形的 fillText 退场(闸收紧:3 → 1 只剩风旗功能字)", () => {
    const src = read("index.ts");
    expect(src).toContain("paintSeatMark(");
    expect(src).toContain("paintWarmFlame(");
    const n = (drawSrc().match(/fillText\(/g) ?? []).length;
    expect(n).toBeLessThanOrEqual(1);
  });

  it("emoji 码点闸收紧:55 → 53 只降不升(火苗与花的字形字面量退场;P_MARK 仍留给 DOM 功能文字)", () => {
    const n = (drawSrc().match(/\p{Extended_Pictographic}/gu) ?? []).length;
    expect(n).toBeLessThanOrEqual(53);
  });
});
