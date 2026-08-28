/**
 * N-99：915×412 上花田盘+数字键+消息行共 446px，塞不进 178px 的舞台段，
 * 而 .sp-wrap 基础档 overflow:hidden——盘底两排格子（391~504）永远滚不到。
 * 矮横屏档改成花田自己竖着滚；数字键/工具行的 sticky 本来就是给滚动准备的，钉在可视底边。
 */
import { describe, expect, it } from "vitest";
import { SP_CSS } from "./index";

describe("N-99 sudoku-petal 矮横屏盘底两排滚得到", () => {
  const start = SP_CSS.indexOf("@media (max-height:500px){");
  const block = SP_CSS.slice(start, SP_CSS.indexOf("@media", start + 10));

  it("矮横屏档花田自己竖着滚(基础档 overflow:hidden 不动,竖屏零变化)", () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain(".sp-wrap{overflow-y:auto;-webkit-overflow-scrolling:touch;}");
    // 基础档照旧 hidden:装得下的屏一个滚动条都不多
    expect(SP_CSS).toContain("position:relative;overflow:hidden;");
  });

  it("数字键与工具行 sticky 钉在可视底边,滚盘时不跟着走", () => {
    expect(block).toContain(".sp-pad,.sp-tools{position:sticky;bottom:0;");
  });
});
