/**
 * bumper-cars · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * G10:第 1 关地板观感近平涂 —— 按 learner 备选方案在 render ① 段补第三块
 *      反射小斑(0.18×min(w,h),错开放置),前两块位置半径不动;
 *      融冰断面裂纹线色透明度 0.9 → 0.96(加深一档),线宽 / 根数不动。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

describe("bumper-cars · 修复员 G10 · 反射斑与冰裂纹", () => {
  it("反射斑从两块补到三块,第三块 0.18×min 且与前两块错开", () => {
    const src = read("index.ts");
    const calls = src.match(/drawFloorGlow\(g,/g) ?? [];
    expect(calls.length).toBe(3);
    expect(src).toContain("Math.min(f.w, f.h) * 0.18");
    // 前两块的位置与半径原样保留
    expect(src).toContain("f.w * 0.36, f.h * 0.32, Math.min(f.w, f.h) * 0.3");
    expect(src).toContain("f.w * 0.66, f.h * 0.64, Math.min(f.w, f.h) * 0.22");
  });

  it("冰裂纹透明度加深到 0.96,线宽 0.35 与 7 根裂纹不动(不画花)", () => {
    const src = read("index.ts");
    expect(src).toContain("shade(BC_COLORS.bcIceEdge, -22), 0.96");
    expect(src).toContain("lineWidth = 0.35");
    expect((src.match(/i < 7; i\+\+/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
