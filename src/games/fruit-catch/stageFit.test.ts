/**
 * 接水果 · 横屏+平板画布出屏(三人组 r5 playbook N-1,单款最重)。
 *
 * 实测:915×412 裁 741 / canvas 出屏 617 / 左右按钮折叠线下(只见树梢不见果篮);
 * 1024×768 平板也裁 415 / 出屏 281。实时接水果不能边玩边滚。
 * 修法(配方 B 之 1 + F):三个模式(闯关/双人/无尽)的画布都走共享件
 * attachCanvasFit 按舞台可视余量钳显示高;wrap 层 touch-action 改 pan-y 留滚动兜底。
 * 物理分辨率 W×H 与接果判定坐标零改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("接水果 · 画布钳高接线(N-1)", () => {
  it("闯关/双人/无尽三个模式都接了共享钳高件,destroy 各自摘监听", () => {
    expect(SRC).toContain('import { attachCanvasFit } from "../stageFit";');
    expect(SRC.split("attachCanvasFit(canvas, wrap)").length - 1).toBe(3);
    expect(SRC.split("fit.detach()").length - 1).toBe(3);
  });

  it("wrap 层只禁横划(pan-y),舞台滚动兜底留着;画布与按钮仍是 none", () => {
    expect(SRC).toMatch(/\.frc-wrap \{[^}]*touch-action: pan-y/);
    expect(SRC).toMatch(/\.frc-canvas \{[^}]*touch-action: none/);
    expect(SRC).toMatch(/\.frc-btn \{[^}]*touch-action: none/);
  });

  it("物理分辨率没被顺手动:画布仍按 W×H 建", () => {
    expect(SRC).toContain('width="${W}" height="${H}"');
  });
});
