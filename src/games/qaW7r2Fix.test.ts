/**
 * 窗口 7 · 第 2 轮视觉修复(C 档)跨款用例:N-4 shade 收敛验证。
 *
 * A 档 R2 报告 N-4:同名 `shade` 三份实现三种量纲,建议归一到 kit 单源。
 * 本轮收敛法:kit `art/kit/fruit.shade`(20-A 归属)一字不动做唯一混色引擎;
 * poop-hero(百分比量纲)与 memory-cards(小数量纲)的同名函数改为薄适配层
 * (量纲换算 + 大写输出),公开签名与全部输出色值逐位不变。
 * A 档 qaW7r2 的三量纲行为断言原样保留照绿——本文件补钉「单源等价」:
 * 两款适配层对任意采样输入都必须与 kit 引擎逐位一致,再造第二套混色公式就红。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { shade as kitShade } from "../art/kit/fruit";
import { shadeColor as fsShadeColor } from "./fruit-slice/visual";
import { shade as mcShade } from "./memory-cards/visual";
import { shade as phShade } from "./poop-hero/visual";

const HEXES = ["#F4859F", "#7FB2F0", "#808080", "#F6C36B", "#3B3B4F", "#123ABC", "#000000", "#FFFFFF"];

describe("W7R2 修复 · N-4 shade 混色引擎收敛 kit 单源", () => {
  it("poop-hero 适配层:pct 百分比 → kit 小数,采样网格逐位等价", () => {
    for (const hex of HEXES) {
      for (const pct of [-100, -42, -28, -18, -10, 0, 10, 16, 25, 30, 100]) {
        expect(phShade(hex, pct), `${hex} @ ${pct}%`).toBe(kitShade(hex, pct / 100).toUpperCase());
      }
    }
  });

  it("memory-cards 适配层:小数量纲直通 kit,采样网格逐位等价", () => {
    for (const hex of HEXES) {
      for (const amt of [-1, -0.35, -0.2, -0.16, 0, 0.2, 0.62, 1]) {
        expect(mcShade(hex, amt), `${hex} @ ${amt}`).toBe(kitShade(hex, amt).toUpperCase());
      }
    }
  });

  it("收敛前钉死的公开色值一个不变(等价改造,不是换规格)", () => {
    // memory-cards visual21 用例同款断言
    expect(mcShade("#F6C36B", -0.2)).toBe("#C59C56");
    expect(mcShade("#3B3B4F", 0.2)).toBe("#626272");
    expect(mcShade("rgba(1,2,3,.4)", -0.2)).toBe("rgba(1,2,3,.4)");
    // poop-hero visual.test 同款端点断言 + 披风深色 token
    expect(phShade("#808080", 100)).toBe("#FFFFFF");
    expect(phShade("#808080", -100)).toBe("#000000");
    expect(phShade("#F4859F", -18)).toBe("#C86D82");
  });

  it("两款视觉文件都从 kit 引擎 import(源码级钉死,不许再长第二套公式)", () => {
    for (const rel of ["./poop-hero/visual.ts", "./memory-cards/visual.ts"] as const) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      expect(src, rel).toContain('shade as kitShade } from "../../art/kit/fruit"');
      expect(src, rel).not.toContain("parseInt(hex");
    }
  });
});

describe("W7R2 修复 · B 档修订 #1:fruit-slice 第 4、5 份 shade 量纲钉死(实现收编顺延下轮)", () => {
  it("fruit-slice shadeColor:amt 是 ±255 通道加法、输出 rgb() 字符串——与 kit 比例混合不等价,照抄参数必翻车", () => {
    expect(fsShadeColor("#808080", -46)).toBe("rgb(82,82,82)");
    expect(fsShadeColor("#ffc46b", -46)).toBe("rgb(209,150,61)");
    // 加法平移保持通道间距不变;kit 比例混合会按比例缩——同参数两家结果不同
    expect(fsShadeColor("#ffc46b", -46)).not.toBe(kitShade("#ffc46b", -46 / 255));
    // 越界钳到 0/255,不环绕
    expect(fsShadeColor("#101010", -46)).toBe("rgb(0,0,0)");
    expect(fsShadeColor("#f0f0f0", 46)).toBe("rgb(255,255,255)");
  });

  it("index.ts 局部 shade 与 visual.shadeColor 同一加法规则(源码级对照,防两份各自漂移)", () => {
    const idx = readFileSync(new URL("./fruit-slice/index.ts", import.meta.url), "utf8");
    const vis = readFileSync(new URL("./fruit-slice/visual.ts", import.meta.url), "utf8");
    for (const src of [idx, vis]) {
      expect(src).toContain("Math.max(0, Math.min(255, (n >> 16) + amt))");
      expect(src).toContain("return `rgb(${r},${g},${b})`;");
    }
  });
});
