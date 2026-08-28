/**
 * 贪吃蛇 · 方向键两档被裁(三人组 r4 playbook C-3)。
 *
 * 实测:360×640 裁 203px 方向键折叠线下;915×412 裁 690 / canvas 出屏 498。
 * 实时贪吃蛇不能边玩边滚——显示高走共享件 attachCanvasFit 按舞台可视余量钳
 * max-height;画布是 width:100% 的替换元素,连宽等比收不变形;
 * 格子判定与速度曲线零改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("贪吃蛇 · 画布钳高接线(C-3)", () => {
  it("接了共享钳高件,destroy 摘监听", () => {
    expect(SRC).toContain('import { attachCanvasFit } from "../stageFit";');
    expect(SRC).toContain("const fit = attachCanvasFit(canvas, wrap);");
    expect(SRC).toContain("fit.detach();");
  });

  it("物理分辨率仍是 SIZE×SIZE,判定没被顺手动", () => {
    expect(SRC).toContain('width="${SIZE}" height="${SIZE}"');
  });

  it("画布显示层 width:100% + touch-action:none 原样(划动转向不惊动页面)", () => {
    expect(SRC).toMatch(/\.sn-canvas \{[^}]*width: 100%/);
    expect(SRC).toMatch(/\.sn-canvas \{[^}]*touch-action: none/);
  });
});
