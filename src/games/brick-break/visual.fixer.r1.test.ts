/**
 * 1.3 窗口 6 · C 档 · 第 1 轮监督修复员 · W6R1-04 修复钉子(brick-break)。
 * 道具胶囊从「平涂双段 + 14px serif emoji 内贴」升级为:
 * 四停纵向渐变(受光白 → 上半 → 下半 → 暗底)+ 左上高光斑 + 1.5px 描边,
 * 图标全部换 drawCapsuleIcon 的双色矢量;空心圈「别接我」形状通道原样保留。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { POWER_ORDER } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口6 r1 fixer · W6R1-04 胶囊渐变化 + 图标矢量化", () => {
  it("胶囊主体是 ≥4 停纵向渐变,不再是两段 fillRect 平涂", () => {
    const cap = SRC.slice(SRC.indexOf("function drawCapsule("));
    const body = cap.slice(0, cap.indexOf("\n}"));
    expect(body).toMatch(/createLinearGradient\(0, -rh, 0, rh\)/);
    expect((body.match(/addColorStop\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(body).not.toMatch(/fillRect\(-rw, -rh, rw \* 2, rh\)/);
  });

  it("有左上高光斑(光源左上 45° 约定)与 1.5px 描边", () => {
    const cap = SRC.slice(SRC.indexOf("function drawCapsule("));
    const body = cap.slice(0, cap.indexOf("\n}"));
    expect(body).toMatch(/rgba\(255,255,255,\.85\)/);
    expect(body).toMatch(/ellipse\(-rw \* [\d.]+, -rh \* [\d.]+/);
    expect(body).toMatch(/lineWidth = 1\.5/);
  });

  it("serif emoji 内贴退休:不再设 serif 字体、不再 fillText 道具 emoji", () => {
    expect(SRC).not.toContain('"14px serif"');
    expect(SRC).not.toContain("fillText(look.emoji");
  });

  it("六种道具都有矢量图标分支(drawCapsuleIcon 覆盖 POWER_ORDER)", () => {
    const icon = SRC.slice(SRC.indexOf("function drawCapsuleIcon("));
    const body = icon.slice(0, icon.indexOf("\n}"));
    // narrow 走 default 分支(内收箭头),其余五种各有具名 case
    for (const kind of POWER_ORDER.filter((k) => k !== "narrow")) {
      expect(body, kind).toContain(`case "${kind}"`);
    }
    expect(body).toMatch(/default:/);
    expect(SRC).toContain("drawCapsuleIcon(c2d, cap.kind)");
  });

  it("「别接我」的空心圈形状通道原样保留(look.hollow 分支还在)", () => {
    expect(SRC).toContain("capsuleLook(cap.kind)");
    expect(SRC).toMatch(/look\.hollow/);
    const cap = SRC.slice(SRC.indexOf("function drawCapsule("));
    const body = cap.slice(0, cap.indexOf("\n}"));
    expect(body).toMatch(/strokeStyle = "#E0709A"/);
  });
});
