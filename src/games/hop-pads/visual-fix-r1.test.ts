// 窗口3 · 第 1 轮监督修复:B 档 TOP10 之 10(上)——天空云量 3 团 → 5 团。
// 钉住:新增两团复用 drawCloudPuff、半透明(0.5/0.6)、高度与相位错开不成排。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("hop-pads 天空云量微调(B-10)", () => {
  it("保留原有三朵大云的绘制循环", () => {
    expect(src).toContain("for (let i = 0; i < 3; i++) {");
    expect(src).toContain("drawCloudPuff(ctx, cx, hy - (0.34 + 0.16 * (i % 2)) * hy");
  });

  it("新增两团高云:同 drawCloudPuff,不新增绘制函数", () => {
    const extra = src.match(/再添两团半透明高云[\s\S]{0,400}?\n\s*\}/)?.[0] ?? "";
    expect(extra).toContain("drawCloudPuff(ctx, cx,");
    expect(extra.includes("function ")).toBe(false);
  });

  it("新增云是半透明的(alpha 0.5/0.6)且用完即还原", () => {
    const extra = src.match(/再添两团半透明高云[\s\S]{0,400}?\n\s*\}/)?.[0] ?? "";
    expect(extra).toContain("ctx.globalAlpha = 0.5 + i * 0.1;");
    expect(extra).toContain("ctx.globalAlpha = 1;");
  });

  it("高度错开:新云高度系数(0.26/0.58)与原云(0.34/0.5)互不重合", () => {
    const extra = src.match(/再添两团半透明高云[\s\S]{0,400}?\n\s*\}/)?.[0] ?? "";
    expect(extra).toContain("hy - (0.26 + 0.32 * i) * hy");
    const news = [0.26, 0.26 + 0.32];
    const olds = [0.34, 0.34 + 0.16];
    for (const n of news) for (const o of olds) expect(Math.abs(n - o)).toBeGreaterThan(0.05);
  });

  it("新云相位与原云错开(不同 offset,避免成排)", () => {
    const extra = src.match(/再添两团半透明高云[\s\S]{0,400}?\n\s*\}/)?.[0] ?? "";
    expect(extra).toContain("(i + 0.5) * span) / 2 + 130 - drift");
  });
});
