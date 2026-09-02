/**
 * 贪吃毛毛虫 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 B 档报告(docs/qa/1.3-window7-round1-learner.md)建议 10 修后的状态:
 * 双身位关两虫头部灰度只差 Δ12,16px 灰度下色相通道塌缩——
 * 粉虫加剪影级蝴蝶结(kit `CatLook.bow`),形状 + 亮度双通道认虫;
 * 蝴蝶结是认人轮廓,不吃 showAntenna 的 12px 门槛,多小都画。
 */
import { describe, expect, it } from "vitest";

import { drawCaterpillar, type CatLook, type Chain2D } from "../../art/kit/caterpillar";
import { SS_WORM_GREEN, SS_WORM_PINK } from "./visual13";

/** Rec.601 灰度(0–255) */
function luma601(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff);
}

function stubCtx(): { ctx: Chain2D; stats: { fills: number } } {
  const stats = { fills: 0 };
  const gradient = { addColorStop: () => {} };
  const noop = (): void => {};
  const ctx = {
    createRadialGradient: () => gradient,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    fill: () => { stats.fills++; },
    stroke: noop,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
  } as unknown as Chain2D;
  return { ctx, stats };
}

describe("窗口7 R1 修复 · B-10 双虫 16px 剪影可分", () => {
  it("粉虫戴深梅色蝴蝶结,绿虫不戴(几何差通道)", () => {
    expect(SS_WORM_PINK.bow).toBe("#9B4E86");
    expect(SS_WORM_GREEN.bow).toBeUndefined();
  });

  it("蝴蝶结自身灰阶差:对粉虫头色 ≥40(亮度通道,16px 灰度仍可辨)", () => {
    const delta = Math.abs(luma601(SS_WORM_PINK.head) - luma601(SS_WORM_PINK.bow as string));
    expect(delta).toBeGreaterThanOrEqual(40);
  });

  it("小到触角被省略(头径 <12px)时蝴蝶结照画:同几何下粉虫比绿虫多 3 次填充", () => {
    const centers: ReadonlyArray<[number, number]> = [[50, 50], [40, 50], [30, 50]];
    const draw = (look: CatLook): number => {
      const { ctx, stats } = stubCtx();
      // cell=10 → 头半径 4.2px,头径 8.4 < 12:触角分支关闭,只剩蝴蝶结的差异
      drawCaterpillar(ctx, { centers, cell: 10, look, dir: [1, 0] });
      return stats.fills;
    };
    expect(draw(SS_WORM_PINK) - draw(SS_WORM_GREEN)).toBe(3);
  });
});
