/**
 * 花瓣数独 · 1.3 第 2 轮 A 档复验契约（专项④ 精 2D 的机器化沉淀）。
 *
 * 本窗棋牌/数字盘面必须保持精 2D:数字键用完的 rotateX 翻面是「未加 perspective
 * 的纯压扁动画」,不许升级成假 3D。把 index.ts / art.ts 源码里的透视关键字
 * 全部钉死为零出现——perspective / rotate3d / matrix3d / translateZ / three.js。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FILES = ["./index.ts", "./art.ts"].map((f) => ({
  name: f,
  src: readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8"),
}));

describe("sudoku-petal · 精 2D 契约（专项④ r2 沉淀）", () => {
  it("盘面与绘制源码零透视关键字,翻面只是纯压扁", () => {
    for (const { name, src } of FILES) {
      for (const kw of ["perspective", "rotate3d", "matrix3d", "translateZ", 'from "three"', "three.js"]) {
        expect(src.includes(kw), `${name} 混进了 ${kw}`).toBe(false);
      }
    }
  });
});
