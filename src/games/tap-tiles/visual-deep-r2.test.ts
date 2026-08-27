/**
 * 音符下落 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 / index.test 不重复）：
 *  1. 16px 微缩健壮性 + 列首符号双通道：四列符号小半径下不抛异常、绘制序列两两互异（色弱第二通道）；
 *  2. 动效链「收尾」段：连击数字弹跳 comboScale 峰值有界（≤1.4），reduced 下恒 1（不弹跳）；
 *  3. 动效链「预告」段：预备倒数 countdownStep 随时间递减到 0，正好衔接第一个音符。
 */
import { describe, expect, it } from "vitest";
import { comboScale, countdownStep, traceLaneSymbol } from "./art";

interface RecStat {
  ops: string[];
}

function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [] };
  const store: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 };
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        const name = String(k);
        const fmt = a.map((x) => (typeof x === "number" ? String(Math.round(x * 100) / 100) : String(x))).join(",");
        stat.ops.push(`${name}(${fmt})`);
        if (name.startsWith("create") && name.endsWith("Gradient")) return grad;
        if (name === "measureText") return { width: 10 };
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
  it("16px 微缩：四列列首符号不抛异常、绘制序列两两互异（色弱第二通道）", () => {
    const seqs: string[] = [];
    for (let lane = 0; lane < 4; lane++) {
      const { ctx, stat } = recCtx();
      expect(() => traceLaneSymbol(ctx, lane, 8, 8, 6)).not.toThrow();
      expect(stat.ops.length, `lane=${lane} 微缩后画空了`).toBeGreaterThan(0);
      seqs.push(stat.ops.join(";"));
    }
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(seqs[i], `列 ${i} 与列 ${j} 符号画法相同`).not.toBe(seqs[j]);
      }
    }
  });

  it("连击弹跳有界且 reduced 恒 1（收尾段退化契约）", () => {
    expect(comboScale(0, false)).toBeGreaterThan(1);
    expect(comboScale(0, false)).toBeLessThanOrEqual(1.4);
    let prev = comboScale(0, false);
    for (let t = 40; t <= 400; t += 40) {
      const s = comboScale(t, false);
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      prev = s;
    }
    for (const t of [0, 60, 150, 999]) expect(comboScale(t, true)).toBe(1);
  });

  it("预备倒数随时间递减到 0，衔接第一个音符（预告段契约）", () => {
    const lead = 1800;
    let prev = Number.POSITIVE_INFINITY;
    for (let t = 0; t < lead; t += 150) {
      const step = countdownStep(t, lead);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(prev);
      prev = step;
    }
    expect(countdownStep(lead - 60, lead)).toBe(0);
    expect(countdownStep(lead + 100, lead)).toBe(0);
  });
});
