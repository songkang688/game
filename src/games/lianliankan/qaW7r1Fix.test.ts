/**
 * 连连看 · 窗口 7 第 1 轮视觉修复用例(C 档监督修复员,只增不减)。
 *
 * 钉住 A 档报告(docs/qa/1.3-window7-round1-tester.md)建议 8 修后的状态:
 * board.ts 的 `MASK_FACE = "❓"` 死常量清理完毕——面具渲染唯一走 art.ts `maskFaceSvg()`,
 * 判定层(pickMasked / maskKey)一个字未动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as board from "./board";

const BOARD_SRC = readFileSync(fileURLToPath(new URL("./board.ts", import.meta.url)), "utf8");
const INDEX_SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("窗口7 R1 修复 · A-8 MASK_FACE 死常量清理", () => {
  it("board.ts 不再导出 MASK_FACE,源码里 ❓ 字符清零", () => {
    expect("MASK_FACE" in board).toBe(false);
    expect(BOARD_SRC.includes("MASK_FACE")).toBe(false);
    expect(BOARD_SRC.includes("❓")).toBe(false);
  });

  it("面具判定层原样:pickMasked / maskKey 仍在,面具渲染唯一走 maskFaceSvg()", () => {
    expect(typeof board.pickMasked).toBe("function");
    expect(typeof board.maskKey).toBe("function");
    expect(INDEX_SRC).toContain("maskFaceSvg()");
    expect(INDEX_SRC.includes("❓")).toBe(false);
  });
});
