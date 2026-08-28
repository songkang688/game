/**
 * 彩虹跑跑 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（与 round1 的 visual-scan / fix-r1 不重复）：
 *  1. 16px 微缩健壮性：星币 8 帧与跑者三姿态在小半径下不抛异常、绘制非空；
 *  2. 2× 特写层次：星币保有径向渐变 + 描边层，高光偏移在左上象限（宪法光照约定）；
 *  3. 金色恒定契约：远景 LOD 金点（drawCoinDot）仍用金币色板，不许退化为任意色。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  COIN_FRAME_COUNT,
  COIN_GOLD_DEEP,
  COIN_GOLD_LIGHT,
  COIN_GOLD_MID,
  drawCoinDot,
  drawCoinFrame,
  drawRunner,
  type RunnerPose,
} from "./art";

const artSrc = readFileSync(fileURLToPath(new URL("./art.ts", import.meta.url)), "utf8");

interface RecStat {
  ops: string[];
  grads: number;
  fills: number;
  strokes: number;
  fillStyles: string[];
}

function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [], grads: 0, fills: 0, strokes: 0, fillStyles: [] };
  const store: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 };
  const grad = { addColorStop: () => undefined };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (..._a: unknown[]) => {
        const name = String(k);
        stat.ops.push(name);
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
      if (k === "fillStyle" && typeof v === "string") stat.fillStyles.push(v);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, stat };
}

const POSES: RunnerPose[] = ["run", "jump", "slide"];

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：星币 8 帧与跑者三姿态在小半径下不抛异常、绘制非空", () => {
    for (let f = 0; f < COIN_FRAME_COUNT; f++) {
      const { ctx, stat } = recCtx();
      expect(() => drawCoinFrame(ctx, 5.5, f)).not.toThrow();
      expect(stat.ops.length, `coin frame=${f} 微缩后画空了`).toBeGreaterThan(0);
    }
    for (const pose of POSES) {
      const { ctx, stat } = recCtx();
      expect(() =>
        drawRunner(ctx, { pose, r: 5.5, step: 2, t: 0.5, squashX: 1, squashY: 1, reduced: false }),
      ).not.toThrow();
      expect(stat.ops.length, `runner pose=${pose} 微缩后画空了`).toBeGreaterThan(0);
    }
  });

  it("2× 特写：星币保有渐变 + 描边层，高光偏移在左上象限", () => {
    const { ctx, stat } = recCtx();
    drawCoinFrame(ctx, 48, 0);
    expect(stat.grads, "星币正面帧要有径向渐变").toBeGreaterThanOrEqual(1);
    expect(stat.strokes, "星币要有深金描边").toBeGreaterThanOrEqual(1);
    // 宪法左上 45° 光照：径向渐变圆心往左上偏（源码钉死，防有人挪高光）
    expect(artSrc).toContain("-rx * 0.35");
    expect(artSrc).toContain("-r * 0.4");
  });

  it("金色恒定：LOD 远景金点仍用金币色板，不退化为任意色", () => {
    const { ctx, stat } = recCtx();
    drawCoinDot(ctx, 3);
    expect(stat.ops.length).toBeGreaterThan(0);
    const golds = [COIN_GOLD_LIGHT, COIN_GOLD_MID, COIN_GOLD_DEEP].map((c) => c.toLowerCase());
    const used = stat.fillStyles.map((c) => c.toLowerCase());
    expect(
      used.some((c) => golds.includes(c)),
      `金点用色 ${JSON.stringify(stat.fillStyles)} 不在金币色板里`,
    ).toBe(true);
  });
});
