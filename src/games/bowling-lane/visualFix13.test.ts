/**
 * bowling-lane · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * 低优装饰件(learner 第 69 行备选方案 A):馆内两侧从纯色 #3b3556 一笔平涂
 * 升级为「邻道暗剪影」—— 比主道木色深 8% 的透视梯形(四角走 laneProject,
 * 与主道同套会聚)+ 每侧 2 根立柱竖线(alpha 0.22 ≤ 0.25),
 * 邻道与主道之间留 0.18×LANE_W 暗色分隔带(暗场层还在)。
 * 纯静态件:画在跟球运镜 save/scale 之前,不进缩放;reduced 无关。
 * 主道、沟槽、灯箱、投影数学一个数不动。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { FakeCtx } from "./domStub";
import { LANE_LEN, LANE_W, laneProject } from "./logic";
import {
  BL_COLORS,
  BL_NEIGHBOR_GAP,
  BL_NEIGHBOR_WOOD,
  BL_PILLAR_ALPHA,
  drawNeighborLanes,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (): CanvasRenderingContext2D => new FakeCtx() as unknown as CanvasRenderingContext2D;

describe("bowling-lane · 修复员装饰件 · 邻道暗剪影", () => {
  it("邻道剪影画得动不抛:320/360 窄屏与常规宽高都不炸", () => {
    for (const [w, h] of [
      [320, 480],
      [360, 640],
      [520, 720],
      [900, 600],
    ] as const) {
      expect(() => drawNeighborLanes(ctx2d(), { w, h }), `${w}x${h}`).not.toThrow();
    }
  });

  it("剪影填色 = 主道木色深 8%(learner 规格),立柱 alpha ≤ 0.25", () => {
    expect(BL_NEIGHBOR_WOOD).toBe(shade(BL_COLORS.blWoodA, -8));
    expect(BL_PILLAR_ALPHA).toBeLessThanOrEqual(0.25);
  });

  it("邻道与主道之间留暗色分隔带:远端邻道内缘仍在主道外(暗场层不消失)", () => {
    expect(BL_NEIGHBOR_GAP).toBeGreaterThan(0);
    const view = { w: 360, h: 640 };
    const laneEdge = laneProject(0, LANE_LEN, view);
    const neighborEdge = laneProject(-LANE_W * BL_NEIGHBOR_GAP, LANE_LEN, view);
    expect(neighborEdge.sx).toBeLessThan(laneEdge.sx);
  });

  it("邻道梯形与主道同套会聚:远端俯视整道宽在屏上比近端窄", () => {
    const view = { w: 360, h: 640 };
    const span = (t: number): number =>
      laneProject(-LANE_W * BL_NEIGHBOR_GAP, t * LANE_LEN, view).sx -
      laneProject(-LANE_W * (1 + BL_NEIGHBOR_GAP), t * LANE_LEN, view).sx;
    expect(span(1)).toBeLessThan(span(0));
  });

  it("index.ts 调用序:邻道剪影压在暗底之后、跟球运镜 save 之前(不进缩放)", () => {
    const src = read("index.ts");
    const base = src.indexOf('g.fillStyle = "#3b3556"');
    const neighbor = src.indexOf("drawNeighborLanes(g, view)");
    const follow = src.indexOf("// 「跟球」运镜");
    expect(base).toBeGreaterThan(-1);
    expect(neighbor).toBeGreaterThan(base);
    expect(neighbor).toBeLessThan(follow);
  });
});
