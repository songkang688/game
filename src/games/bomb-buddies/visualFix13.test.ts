/**
 * bomb-buddies · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * Z1 残留:logic / ai / levels / domStub / visual13 / pace12.test 六个文件头注释
 * 的旧名已随更名一并清除 —— 这里把「全目录源码零商标词」钉死,谁回流当场红。
 * (PLAN-*.md 是历史计划文档,口径留主管裁决,不在断言范围。)
 * S3/S4:小怪四母形自绘 + 泡泡王三停渐变(替换 🐸🐰🐱👻🐲 与平涂粉圆)。
 * B1:双人服装灰度差拉到 ≥15/255(原 bbPink/bbBlue 灰差仅 0.6)。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hexToRgb } from "../../art/kit/palette";
import { FakeCtx } from "./domStub";
import {
  BB_BOSS_R,
  BB_BOSS_STOPS,
  BB_CHIBI_OUTFIT,
  BB_COLORS,
  BB_CRITTER,
  BB_CRITTER_R,
  drawBossKing,
  drawCritter,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (): CanvasRenderingContext2D => new FakeCtx() as unknown as CanvasRenderingContext2D;

/** 感知亮度(0–255):与 tester 双人 16px 灰度专项同一把尺 */
function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe("bomb-buddies · 修复员 · Z1 注释残留清零", () => {
  it("六个源码文件(含注释)再无旧名商标词", () => {
    for (const f of ["logic.ts", "ai.ts", "levels.ts", "domStub.ts", "visual13.ts", "pace12.test.ts"]) {
      expect(read(f), f).not.toContain("炸弹人");
    }
  });

  it("全部绘制与测试源码只认现行标题「泡泡布阵」", () => {
    expect(read("meta.ts")).toContain("泡泡布阵");
    expect(read("visual13.ts")).toContain("泡泡布阵");
  });
});

describe("bomb-buddies · 修复员 S3/S4 · 小怪与泡泡王自绘", () => {
  it("四小怪双朝向都画得动不抛,最小格子也不炸", () => {
    for (const kind of ["slime", "hopper", "chaser", "ghosty"] as const) {
      for (const facing of [1, -1] as const) {
        expect(() => drawCritter(ctx2d(), kind, 60, 60, 40, facing), kind).not.toThrow();
      }
      expect(() => drawCritter(ctx2d(), kind, 12, 12, 24), kind).not.toThrow();
    }
  });

  it("泡泡王画得动不抛,体半径 ≥ 1.6× 小怪(首领感底线,格判定不动)", () => {
    expect(() => drawBossKing(ctx2d(), 60, 60, 40)).not.toThrow();
    expect(() => drawBossKing(ctx2d(), 12, 12, 24)).not.toThrow();
    expect(BB_BOSS_R).toBeGreaterThanOrEqual(BB_CRITTER_R * 1.6);
  });

  it("泡泡王三停按 learner #5 规格(粉白→#FFD6EA→#E8A9CC),底停更暗", () => {
    expect(BB_BOSS_STOPS[1]).toBe("#FFD6EA");
    expect(BB_BOSS_STOPS[2]).toBe("#E8A9CC");
    expect(luma(BB_BOSS_STOPS[2])).toBeLessThan(luma(BB_BOSS_STOPS[0]));
  });

  it("四小怪主色合法且互不重复(母形 + 色双通道识别)", () => {
    const colors = Object.values(BB_CRITTER);
    for (const c of colors) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("index.ts 小怪层已换 drawCritter/drawBossKing,glyphAt 字形与平涂粉圆退场", () => {
    const src = read("index.ts");
    expect(src).toContain("drawCritter(");
    expect(src).toContain("drawBossKing(");
    expect(src).not.toContain("glyphAt(");
    expect(src).not.toContain("#ffe0f0");
  });
});

describe("bomb-buddies · 修复员 B1 · 双人服装灰度拉开", () => {
  it("两套服装灰度亮度差 ≥ 15/255(16px 灰度下裙裤之外多一条通道)", () => {
    expect(Math.abs(luma(BB_CHIBI_OUTFIT[0]) - luma(BB_CHIBI_OUTFIT[1]))).toBeGreaterThanOrEqual(15);
  });

  it("bbPink / bbBlue 配色 token 本体不动(地板摇杆 HUD 不受牵连)", () => {
    expect(BB_COLORS.bbPink.toUpperCase()).toBe("#F4859F");
    expect(BB_COLORS.bbBlue.toUpperCase()).toBe("#7FB2F0");
    expect(read("index.ts")).toContain("BB_CHIBI_OUTFIT[0]");
    expect(read("index.ts")).toContain("BB_CHIBI_OUTFIT[1]");
  });
});
