/**
 * 五子棋 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / art.test 不重复）：
 *  1. 16px 微缩健壮性：黑白子在小半径下不抛异常、绘制非空；
 *  2. 2× 特写层次：棋子保有径向渐变（玉石画法），黑白绘制序列互异（灰度安全双证）；
 *  3. 宪法左上 45° 光照钉死：径向高光圆心偏移 (-0.38r, -0.42r) 不许被挪。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { paintStone } from "./art";

const artSrc = readFileSync(fileURLToPath(new URL("./art.ts", import.meta.url)), "utf8");

interface RecStat {
  ops: string[];
  grads: number;
  fills: number;
}

function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [], grads: 0, fills: 0 };
  const store: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 };
  const grad = { addColorStop: (o: number, c: string) => void stat.ops.push(`stop:${o}:${c}`) };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        const name = String(k);
        const fmt = a.map((x) => (typeof x === "number" ? String(Math.round(x * 100) / 100) : String(x))).join(",");
        stat.ops.push(`${name}(${fmt})`);
        if (name.startsWith("create") && name.endsWith("Gradient")) {
          stat.grads++;
          return grad;
        }
        if (name === "measureText") return { width: 10 };
        if (name === "fill" || name === "fillRect") stat.fills++;
        return undefined;
      };
    },
    set(t, k, v) {
      if (k === "fillStyle" || k === "strokeStyle") stat.ops.push(`${String(k)}:${typeof v === "string" ? v : "<grad>"}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, stat };
}

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：黑白子在 r=6.5 下不抛异常、绘制非空", () => {
    for (const p of [1, 2] as const) {
      const { ctx, stat } = recCtx();
      expect(() => paintStone(ctx, 8, 8, 6.5, p)).not.toThrow();
      expect(stat.ops.length, `p=${p} 微缩后画空了`).toBeGreaterThan(0);
    }
  });

  it("2× 特写：棋子保有径向渐变（玉石画法），黑白序列互异", () => {
    const black = recCtx();
    paintStone(black.ctx, 64, 64, 52, 1);
    const white = recCtx();
    paintStone(white.ctx, 64, 64, 52, 2);
    expect(black.stat.grads, "黑子径向渐变要在").toBeGreaterThanOrEqual(1);
    expect(white.stat.grads, "白子径向渐变要在").toBeGreaterThanOrEqual(1);
    expect(black.stat.ops.join(";")).not.toBe(white.stat.ops.join(";"));
  });

  it("宪法左上 45° 光照钉死：高光圆心偏移 (-0.38r, -0.42r) 不许被挪", () => {
    expect(artSrc).toContain("cx - r * 0.38");
    expect(artSrc).toContain("cy - r * 0.42");
  });
});
