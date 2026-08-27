/**
 * 数字花园 · 1.3 第 2 轮 A 档复验契约（专项④ 精 2D + 回归防线）。
 *
 * 第 2 轮实测本款 360/320 零溢出、CPU 4× 连发合并 60fps。
 * 把两条口径沉淀成机器化契约:
 *  ① 精 2D:源码零透视关键字(数字盘面不许假 3D);
 *  ② 回归防线「功能提示被动画吃掉」:reduced 分级入口存在,
 *     且 mgshake/mgflash 等反馈通道不因 reduced 整体消失(降级不是去功能)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MG_CSS } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("merge-2048 · 精 2D 与 reduced 功能保留（r2 沉淀）", () => {
  it("源码零透视关键字,数字盘保持正视精 2D", () => {
    for (const kw of ["perspective", "rotate3d", "matrix3d", "translateZ", 'from "three"']) {
      expect(SRC.includes(kw), `index.ts 混进了 ${kw}`).toBe(false);
    }
  });

  it("撞墙抖动与合并闪光两条反馈通道都在 CSS 里,未被 reduced 整体拿掉", () => {
    expect(MG_CSS).toContain("@keyframes mgshake");
    expect(MG_CSS).toContain("@keyframes mgflash");
    expect(SRC).toContain("prefers-reduced-motion");
  });
});
