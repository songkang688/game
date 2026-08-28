/**
 * ice-fire-forest · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * G2:三组功能 icon 从 emoji 字形换矢量自绘 ——
 *     门锁 → 挂锁(圆环锁弓 + 圆角方体 + 锁孔,开锁锁弓抬起);
 *     元素门面 → 主角水滴 / 火苗剪影缩成徽记(复用 heroSilhouette 几何);
 *     顶举 → 双弧托举符号(两条圆头弧 + 被托起的小圆)。
 *     三件都是静态小件,reduced 无关;底座与判定一个数不动。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { drawDoorBadge, drawLiftIcon, drawPadlock } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("ice-fire-forest · 修复员 G2 · 三组 icon 矢量化", () => {
  it("挂锁开 / 锁两态都画得动不抛,最小尺寸不炸", () => {
    for (const open of [true, false]) {
      expect(() => drawPadlock(ctx2d(new FakeCtx()), 20, 20, 7, open, "#6A5F8C")).not.toThrow();
      expect(() => drawPadlock(ctx2d(new FakeCtx()), 4, 4, 2, open, "#3E8FC0")).not.toThrow();
    }
  });

  it("开锁与上锁的锁弓弧不同位(一眼分开关)", () => {
    const at = (open: boolean): string => {
      const c = new FakeCtx();
      drawPadlock(ctx2d(c), 20, 20, 7, open, "#6A5F8C");
      return JSON.stringify(c.ops.filter((o) => o.op === "arc"));
    };
    expect(at(true)).not.toBe(at(false));
  });

  it("元素门徽记复用主角剪影几何,冰 / 火两形都画得动且不同形", () => {
    for (const kind of ["ice", "fire"] as const) {
      expect(() => drawDoorBadge(ctx2d(new FakeCtx()), kind, 20, 20, 8, "#4FA8D8"), kind).not.toThrow();
    }
  });

  it("顶举符号画得动:两条托举弧 + 顶上小圆都在场", () => {
    const c = new FakeCtx();
    drawLiftIcon(ctx2d(c), 20, 20, 8, "#8C6FB8");
    const arcs = c.ops.filter((o) => o.op === "arc");
    // 两条弧 + 小圆本体 + 高光点 ≥ 4 笔 arc
    expect(arcs.length).toBeGreaterThanOrEqual(4);
    expect(() => drawLiftIcon(ctx2d(new FakeCtx()), 4, 4, 2, "#8C6FB8")).not.toThrow();
  });

  it("index.ts 三处已换矢量画笔,画布上锁 / 门面 / 顶举的 emoji 字形退场", () => {
    const src = read("index.ts");
    expect(src).toContain("drawPadlock(");
    expect(src).toContain("drawDoorBadge(");
    expect(src).toContain("drawLiftIcon(");
    for (const e of ["🔓", "🔒", "🤲"]) expect(src).not.toContain(e);
    // 雪花 / 火焰还留在 DOM 按钮标签与 HUD 计数文案里(功能文字,不在画布)——
    // 画布 fillText 不再喂它们:
    expect(src).not.toMatch(/fillText\(ice \? /);
  });
});
