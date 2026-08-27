/**
 * 花园国际象棋 · 1.3 第 1 轮 C 档修复契约（对应 A 档 2-1 一般：棋子主体平涂无渐变）。
 *
 * 修法：参照 sudoku-petal 的层叠法，主体路径叠三层——本色描边整形 → 半透明暗纱 →
 * 向顶部左上内缩的本色亮层，构成两停明暗（渐变等效）。免 <defs>/id，内联多份不撞车。
 */
import { describe, expect, it } from "vitest";
import { pieceSVG } from "./art";
import type { PieceType } from "./board";

const TYPES: readonly PieceType[] = [1, 2, 3, 4, 5, 6];

describe("chess-garden · 主体两停层叠明暗（A 档 2-1 修复）", () => {
  it("12 张棋子主体都有暗纱层与内缩亮层，且仍不含 defs/id/url(#", () => {
    for (const type of TYPES) {
      for (const white of [true, false]) {
        const svg = pieceSVG(type, white);
        const label = `type${type} ${white ? "白" : "黑"}`;
        expect(svg, `${label} 缺暗纱层`).toContain('fill="rgba(56,34,16,0.14)"');
        expect(svg, `${label} 缺内缩亮层`).toContain('transform="matrix(0.92 0 0 0.92');
        expect(svg, `${label} 混进 defs`).not.toContain("<defs");
        expect(svg, `${label} 混进 url(#`).not.toContain("url(#");
        expect(svg, `${label} 混进 id=`).not.toContain(" id=");
      }
    }
  });

  it("亮层内缩锚点在顶部——暗纱只在底部与侧缘露出一圈（光源左上约定不变）", () => {
    for (const type of TYPES) {
      const svg = pieceSVG(type, true);
      // matrix(s 0 0 s tx ty)：tx=15(1-s)、ty=topY(1-s)，都是非负小平移，亮层不越出整形
      const m = svg.match(/matrix\(0\.92 0 0 0\.92 ([\d.]+) ([\d.]+)\)/);
      expect(m, `type${type} 缺 matrix 亮层`).not.toBeNull();
      expect(Number.parseFloat(m![1])).toBeGreaterThan(0);
      expect(Number.parseFloat(m![2])).toBeGreaterThanOrEqual(0);
    }
  });
});
