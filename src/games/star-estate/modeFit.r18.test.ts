/**
 * r18 · N-3:模式屏(1v3/短盘/双人)实测 `.se-wrap` 顶距 128,r14 锁的 76 预算让
 * `.se-pad` sticky 钉不住(掷骰 396–442 线下),棋盘末行 438–451 也在线下。
 * 修法:只在 `.se-mode` 作用域补真预算 + 藏座位净资产行抬棋盘 + 行动排收窄靠右。
 * 闯关路径、`38dvh` 棋盘钳、r10/r12/r14 锁的字符串一律原样。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r18 star-estate 模式屏矮横屏", () => {
  it("旧锁原样:r14 预算串、38dvh 棋盘钳、sticky pad 都还在", () => {
    expect(SRC).toContain(".se-wrap{max-height:calc(100dvh - 76px);}");
    expect(SRC).toContain(".se-board-wrap{max-height:min(156px,38dvh);}");
    expect(SRC).toContain(".se-pad{");
  });

  it("新增:模式屏真预算 + 座位收单行 + 行动排收窄", () => {
    expect(SRC).toContain("@media (max-height:500px) and (min-width:700px)");
    expect(SRC).toContain(".se-mode .se-wrap{max-height:calc(100dvh - 128px);}");
    expect(SRC).toContain(".se-mode .se-seat-info{display:none;}");
    expect(SRC).toContain(".se-mode .se-pad{width:max-content;align-self:flex-end;");
  });
});
