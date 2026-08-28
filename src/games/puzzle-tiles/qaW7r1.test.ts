/**
 * 拼图乐园 · 窗口 7 第 1 轮视觉验收补充用例(测试员,只增不减)。
 *
 * 钉住本轮扫描确认过的视觉保证:
 * ① 三种板式的 render 都接了齿边皮肤层 skinFor(拼图感);
 * ② 齿形半径两档:常规 18%、块宽 < 40px 降 14%(360px 兜底);
 * ③ 动效时序与 reduced 分支(放错 reduced 一个类都不加)。
 * 注:牌面内容仍是 emoji 字符(专项①问题已入报告,交 C 档),这里不钉它。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { jigsawRadiusPct } from "../../art/kit/jigsaw";
import { PT_TIMING, dropFxClasses } from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 · puzzle-tiles 拼图皮肤接线", () => {
  it("推格子 / 旋转块 / 缺块补齐三种 render 都调 skinFor", () => {
    for (const fn of ["renderSlide", "renderRotate", "renderFill"]) {
      const start = SRC.indexOf(`function ${fn}`);
      expect(start).toBeGreaterThan(-1);
      const seg = SRC.slice(start, start + 2400);
      expect(seg).toContain("skinFor(");
    }
  });
});

describe("窗口7 R1 · puzzle-tiles 齿形两档(360px 兜底)", () => {
  it("常规块 18%、窄于 40px 降到 14%", () => {
    expect(jigsawRadiusPct(64)).toBe(18);
    expect(jigsawRadiusPct(40)).toBe(18);
    expect(jigsawRadiusPct(39)).toBe(14);
    expect(jigsawRadiusPct(28)).toBe(14);
  });
});

describe("窗口7 R1 · puzzle-tiles 动效时序与 reduced 分支", () => {
  it("抬升 80ms / 吸附 150ms / 摇头 240ms(与 plan 宣称一致)", () => {
    expect(PT_TIMING.liftMs).toBe(80);
    expect(PT_TIMING.snapMs).toBe(150);
    expect(PT_TIMING.shakeMs).toBe(240);
  });

  it("放对 reduced 只留接缝白光;放错 reduced 一个类都不加", () => {
    expect(dropFxClasses("snap", true)).toEqual(["pzv-seam"]);
    expect(dropFxClasses("wrong", true)).toEqual([]);
    expect(dropFxClasses("wrong", false)).toEqual(["pzv-shake"]);
  });
});
