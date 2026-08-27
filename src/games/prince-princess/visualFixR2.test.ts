/**
 * prince-princess · 1.3 窗口 5 第 2 轮监督修复员 · 修复配套用例。
 *
 * N2(见 docs/qa/1.3-window5-round2-tester.md):门锁 emoji 字形 24×scale px →
 * `drawPadlockBadge` 自绘挂锁(圆环锁弓 + 金 2 停圆角锁体 + 锁孔),开 / 合两态锁弓不同位。
 * 修后把 R2 测试员的两道水位闸再拧紧(锁字形 1 → 0),只降不升。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { drawPadlockBadge } from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("prince-princess · 修复员 R2 · N2 门锁自绘挂锁", () => {
  it("挂锁开 / 合两态都画得动不抛,极小尺寸与非法尺寸不炸", () => {
    for (const open of [true, false]) {
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 40, 30, 7, open)).not.toThrow();
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 4, 4, 1.5, open)).not.toThrow();
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 4, 4, 0, open)).not.toThrow();
    }
  });

  it("开锁与上锁的锁弓弧不同位(一眼分开 / 合)", () => {
    const arcsOf = (open: boolean): string => {
      const c = new FakeCtx();
      drawPadlockBadge(ctx2d(c), 40, 30, 7, open);
      return JSON.stringify(c.ops.filter((o) => o.op === "arc"));
    };
    expect(arcsOf(true)).not.toBe(arcsOf(false));
  });

  it("index.ts 门锁已换 drawPadlockBadge,锁 emoji 字形退场(闸收紧:1 → 0)", () => {
    const src = read("index.ts");
    expect(src).toContain("drawPadlockBadge(");
    expect((src.match(/🔒/g) ?? []).length).toBe(0);
  });
});
