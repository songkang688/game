/**
 * 朵星格斗王 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / art.test 不重复）：
 *  1. 16px 微缩健壮性：八位行头的头饰 + 五官在小头半径下不抛异常、绘制非空；
 *  2. 头饰区双通道：八位头饰绘制序列两两互异（16px 只剩头顶那一笔时仍可辨）；
 *  3. 功能提示不被动画吃掉：P1/P2 脚环双色互异，边侧标记在 reduced 下仍有绘制（静态不消失）。
 */
import { describe, expect, it } from "vitest";
import { HERO_LOOKS, RING_COLORS, drawFace, drawHeadgear, drawSideMarker } from "./art";

interface RecStat {
  ops: string[];
  fills: number;
  strokes: number;
}

function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [], fills: 0, strokes: 0 };
  const store: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 };
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        const name = String(k);
        const fmt = a.map((x) => (typeof x === "number" ? String(Math.round(x * 10) / 10) : String(x))).join(",");
        stat.ops.push(`${name}(${fmt})`);
        if (name.startsWith("create") && name.endsWith("Gradient")) return grad;
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

const IDS = Object.keys(HERO_LOOKS);

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：八位头饰 + 五官在 headR=5 下不抛异常、绘制非空", () => {
    expect(IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of IDS) {
      const { ctx, stat } = recCtx();
      expect(() => drawHeadgear(ctx, 8, 8, 5, 1, HERO_LOOKS[id])).not.toThrow();
      expect(() => drawFace(ctx, 8, 8, 5, 1, "normal", "#5a4a66")).not.toThrow();
      expect(stat.ops.length, `${id} 微缩后画空了`).toBeGreaterThan(0);
    }
  });

  it("头饰区双通道：八位头饰绘制序列两两互异", () => {
    const seqs = IDS.map((id) => {
      const { ctx, stat } = recCtx();
      drawHeadgear(ctx, 32, 32, 20, 1, HERO_LOOKS[id]);
      return { id, seq: stat.ops.join(";") };
    });
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i].seq, `${seqs[i].id} 与 ${seqs[j].id} 头饰画法相同`).not.toBe(seqs[j].seq);
      }
    }
  });

  it("P1/P2 脚环双色互异；边侧标记 reduced 下仍有绘制（静态不消失）", () => {
    expect(RING_COLORS[0]).not.toBe(RING_COLORS[1]);
    for (const side of [0, 1] as const) {
      const { ctx, stat } = recCtx();
      expect(() => drawSideMarker(ctx, 40, 20, side, 30, true)).not.toThrow();
      expect(stat.ops.length, `side=${side} reduced 下标记消失了`).toBeGreaterThan(0);
    }
  });
});
