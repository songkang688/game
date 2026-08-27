/**
 * bumper-cars · 1.3 窗口 5 第 2 轮监督修复员 · 修复配套用例。
 *
 * N3(见 docs/qa/1.3-window5-round2-tester.md):R1 G10 足额落地后第 1 关浅粉地板上
 * 反射斑观感仍含蓄 —— 中心 alpha 0.16 → 0.24 提一档 + 斑心一枚同倾角迷你内核亮斑
 * (纯色小面积,4× 节流 A/B 实测零帧率代价;渐变保持两停 —— 加中途停实测回压 ~7fps,不采);
 * 椭圆几何与 render ① 段三处调用点(0.3 / 0.22 / 0.18×min)一个数不动,「冰面不画花」约束保持。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { drawFloorGlow, FLOOR_GLOW_CORE_ALPHA, FLOOR_GLOW_SHEEN_ALPHA } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("bumper-cars · 修复员 R2 · N3 反射斑观感提档", () => {
  it("反射斑照画不抛,非法半径不炸", () => {
    expect(() => drawFloorGlow(ctx2d(new FakeCtx()), 50, 40, 20)).not.toThrow();
    expect(() => drawFloorGlow(ctx2d(new FakeCtx()), 50, 40, 0)).not.toThrow();
    expect(() => drawFloorGlow(ctx2d(new FakeCtx()), 50, 40, -3)).not.toThrow();
  });

  it("中心 alpha 提到 0.24 档(> R1 的 0.16),内核亮斑比中心淡且渐变保持两停(帧率回压防线)", () => {
    expect(FLOOR_GLOW_CORE_ALPHA).toBeGreaterThanOrEqual(0.24);
    expect(FLOOR_GLOW_CORE_ALPHA).toBeLessThan(0.4);
    expect(FLOOR_GLOW_SHEEN_ALPHA).toBeLessThan(FLOOR_GLOW_CORE_ALPHA);
    // 大椭圆径向渐变只许两停:4× 节流 A/B 实测加中途停回压 ~7fps
    const body = read("visual13.ts");
    const fn = body.slice(body.indexOf("export function drawFloorGlow"), body.indexOf("drawLampPost"));
    expect((fn.match(/addColorStop\(/g) ?? []).length).toBe(2);
  });

  it("椭圆几何与三处调用点不动:r×0.62r 倾角 −0.5;render ① 段仍是 0.3 / 0.22 / 0.18×min 三块", () => {
    const vis = read("visual13.ts");
    expect(vis).toContain("g.ellipse(x, y, r, r * 0.62, -0.5, 0, Math.PI * 2)");
    const src = read("index.ts");
    expect((src.match(/drawFloorGlow\(g,/g) ?? []).length).toBe(3);
    expect(src).toContain("f.w * 0.36, f.h * 0.32, Math.min(f.w, f.h) * 0.3");
    expect(src).toContain("f.w * 0.66, f.h * 0.64, Math.min(f.w, f.h) * 0.22");
    expect(src).toContain("f.w * 0.24, f.h * 0.74, Math.min(f.w, f.h) * 0.18");
  });
});
