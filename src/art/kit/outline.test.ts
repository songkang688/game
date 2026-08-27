import { describe, expect, it } from "vitest";
import { OUTLINE_DARKEN, OUTLINE_MAX, OUTLINE_MIN, strokeOutline } from "./outline";
import { shade } from "./palette";

function stubCtx(): { ctx: CanvasRenderingContext2D; rec: { strokeStyle: string; lineWidth: number; strokes: number } } {
  const rec = {
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    strokes: 0,
    stroke(): void {
      rec.strokes++;
    },
  };
  return { ctx: rec as unknown as CanvasRenderingContext2D, rec };
}

describe("art/kit outline", () => {
  it("统一描边:深 20%、线宽夹在 1.5–2px", () => {
    expect(OUTLINE_MIN).toBe(1.5);
    expect(OUTLINE_MAX).toBe(2);
    expect(OUTLINE_DARKEN).toBe(-20);
    const a = stubCtx();
    strokeOutline(a.ctx, "#F4859F");
    expect(a.rec.strokeStyle).toBe(shade("#F4859F", -20));
    expect(a.rec.lineWidth).toBe(1.5);
    expect(a.rec.strokes).toBe(1);
    // 线宽越界会被夹回约定范围
    const b = stubCtx();
    strokeOutline(b.ctx, "#7FB2F0", 9);
    expect(b.rec.lineWidth).toBe(2);
    const c = stubCtx();
    strokeOutline(c.ctx, "#7FB2F0", 0.2);
    expect(c.rec.lineWidth).toBe(1.5);
  });
});
