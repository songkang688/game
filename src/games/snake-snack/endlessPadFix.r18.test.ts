/**
 * r18 · N-81 补账:r15 只加了 sticky,915×412 实测无尽花园方向键第二行 409–457 仍 FOLD
 * (无尽屏顶上多一行「◀ 回选关」,wrap 真实顶距 165,预算 108 不够,sticky 钉在 wrap 底 469)。
 * 修法照 N-75 麻将配方:`.sn-mode` 作用域内改 fixed 钉视口底。闯关 `.sn-pad` sticky 原样。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GRID } from "./levels";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r18 snake-snack 无尽花园方向键钉视口底", () => {
  it("无尽作用域 fixed 钉底,闯关 sticky 与逻辑格边不动", () => {
    expect(GRID).toBe(13);
    expect(SRC).toContain("const CELL = 26;");
    // r15 闯关规则原样保留
    expect(SRC).toContain(".sn-pad { position: sticky; bottom: 0");
    // 无尽作用域:wrap 预算按真实顶距、盘再收一档、键 fixed 进 412
    expect(SRC).toContain(".sn-mode .sn-wrap { max-height: calc(100dvh - 176px); }");
    expect(SRC).toContain(".sn-mode .sn-canvas { max-height: min(128px, 31dvh); }");
    expect(SRC).toMatch(/\.sn-mode \.sn-pad \{ position: fixed; left: 10px; right: 10px; bottom: 6px;/);
  });
});
