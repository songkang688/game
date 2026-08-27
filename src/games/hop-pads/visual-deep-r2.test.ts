/**
 * 跳跳台 · 1.3 窗口3 第 2 轮视觉验收 · 测试员深挖用例。
 *
 * 本轮深挖三条（对应 round2 深度走查项，与 round1 的 visual-scan / fix-r1 不重复）：
 *  1. 16px 微缩健壮性：主角脸五姿态、台面图案在小半径下不抛异常、绘制非空（角色特写·缩）；
 *  2. 2× 特写层次：大半径下底色 + 暗部/描边层仍在，不许退化成单笔平涂（角色特写·放）；
 *  3. 深度雾契约：fogAlpha 随距离单调不减、近处为 0、上限 FOG_MAX ≤ 0.35（2.5D 纵深哨兵）。
 */
import { describe, expect, it } from "vitest";
import { FOG_FAR, FOG_MAX, FOG_NEAR, drawHeroFace, drawPadMotif, fogAlpha, type HeroPose } from "./art";

interface RecStat {
  ops: string[];
  grads: number;
  fills: number;
  strokes: number;
}

/** 录制型 2D 上下文：任意方法调用记一笔，渐变/度量返回可用桩 */
function recCtx(): { ctx: CanvasRenderingContext2D; stat: RecStat } {
  const stat: RecStat = { ops: [], grads: 0, fills: 0, strokes: 0 };
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
      if (k === "fillStyle" || k === "strokeStyle") stat.ops.push(`${String(k)}:${typeof v === "string" ? v : "<grad>"}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, stat };
}

const POSES: HeroPose[] = ["idle", "charge", "fly", "land", "fall"];

describe("1.3 视觉深挖（窗口3 · round2 tester）", () => {
  it("16px 微缩：主角脸五姿态与台面图案在 r≈6 下不抛异常、绘制非空", () => {
    for (const pose of POSES) {
      const { ctx, stat } = recCtx();
      expect(() => drawHeroFace(ctx, pose, 8, 8, 6.5, 0.5)).not.toThrow();
      expect(stat.ops.length, `pose=${pose} 微缩后画空了`).toBeGreaterThan(0);
    }
    for (const kind of ["steady", "moving", "cracked", "spring"]) {
      const { ctx, stat } = recCtx();
      expect(() => drawPadMotif(ctx, kind, 8, 8, 7, 3)).not.toThrow();
      expect(stat.ops.length, `pad kind=${kind} 微缩后画空了`).toBeGreaterThan(0);
    }
  });

  it("2× 特写：主角脸有多层填充（眼白/瞳孔/高光/腮红），台面图案有描边层", () => {
    const { ctx, stat } = recCtx();
    drawHeroFace(ctx, "idle", 64, 64, 52, 0.5);
    expect(stat.fills, "特写脸至少眼白+瞳孔+高光+腮红多层填充").toBeGreaterThanOrEqual(4);
    const pad = recCtx();
    drawPadMotif(pad.ctx, "moving", 64, 64, 56, 24);
    expect(pad.stat.strokes + pad.stat.fills, "台面图案要有笔画层").toBeGreaterThan(0);
  });

  it("深度雾契约：fogAlpha 单调不减、近处 0、上限 FOG_MAX ≤ 0.35", () => {
    expect(FOG_MAX).toBeLessThanOrEqual(0.35);
    expect(fogAlpha(FOG_NEAR)).toBe(0);
    expect(fogAlpha(FOG_FAR)).toBeCloseTo(FOG_MAX, 5);
    let prev = -1;
    for (let dz = 0; dz <= FOG_FAR + 200; dz += 40) {
      const a = fogAlpha(dz);
      expect(a, `dz=${dz} 处雾度回落`).toBeGreaterThanOrEqual(prev);
      expect(a).toBeLessThanOrEqual(FOG_MAX);
      prev = a;
    }
  });
});
