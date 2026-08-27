/**
 * 海底大胃王 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 不重复）：
 *  1. 16px 微缩健壮性：鱼身三种头饰在小半径下不抛异常、绘制非空，金冠/银星带序列互异（双人 16px 可辨）；
 *  2. 2× 特写层次：鱼身保有渐变 + 描边层，不许退化平涂；
 *  3. 功能提示不被动画吃掉：毒藻光环在 reduced 下恒定可见（≥0.5）；低画质砍前景/远景装饰层但主层不动。
 */
import { describe, expect, it } from "vitest";
import { drawFishBody, layerToggles, toxinAuraPulse, type Headdress } from "./art";

interface RecStat {
  ops: string[];
  grads: number;
  fills: number;
  strokes: number;
}

function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [], grads: 0, fills: 0, strokes: 0 };
  const store: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 };
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        const name = String(k);
        const fmt = a.map((x) => (typeof x === "number" ? String(Math.round(x * 10) / 10) : String(x))).join(",");
        stat.ops.push(`${name}(${fmt})`);
        if (name.startsWith("create") && name.endsWith("Gradient")) {
          stat.grads++;
          return grad;
        }
        if (name === "measureText") return { width: 10 };
        if (name === "fill" || name === "fillRect") stat.fills++;
        if (name === "stroke" || name === "strokeRect") stat.strokes++;
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

const HEADS: Headdress[] = ["crown", "star", "none"];

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：三种头饰鱼身不抛异常、绘制非空，金冠 vs 银星带序列互异", () => {
    const seqs = new Map<Headdress, string>();
    for (const head of HEADS) {
      const { ctx, stat } = recCtx();
      expect(() => drawFishBody(ctx, { r: 5, color: "#ff8aa5", t: 0.5, reduced: false, head })).not.toThrow();
      expect(stat.ops.length, `head=${head} 微缩后画空了`).toBeGreaterThan(0);
      seqs.set(head, stat.ops.join(";"));
    }
    expect(seqs.get("crown")).not.toBe(seqs.get("star"));
    expect(seqs.get("crown")).not.toBe(seqs.get("none"));
  });

  it("2× 特写：鱼身保有渐变与描边层，不退化平涂", () => {
    const { ctx, stat } = recCtx();
    drawFishBody(ctx, { r: 40, color: "#ff8aa5", t: 0.5, reduced: false, head: "crown" });
    expect(stat.grads, "鱼身背腹渐变要在").toBeGreaterThanOrEqual(1);
    expect(stat.strokes, "轮廓/鳞纹描边要在").toBeGreaterThanOrEqual(1);
    expect(stat.fills).toBeGreaterThanOrEqual(4);
  });

  it("危险提示与画质分档：毒藻光环 reduced 恒 ≥0.5 可见；低画质只砍装饰层", () => {
    for (const t of [0, 0.7, 1.9, 3.3, 8.8]) {
      expect(toxinAuraPulse(t, true), `t=${t} reduced 下毒藻光环不可见了`).toBeGreaterThanOrEqual(0.5);
    }
    const low = layerToggles("low");
    const high = layerToggles("high");
    expect(low.far).toBe(false);
    expect(low.fore).toBe(false);
    expect(high.far).toBe(true);
    expect(high.fore).toBe(true);
  });
});
