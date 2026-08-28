/**
 * r9 tester-B · N-30 无尽古堡(advk-):D-pad 右侧、工具钮 sticky、房间格钳可视余量。
 * 房间生成 / 钥匙判定零触碰。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { castleBoardCapPx } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r9 N-30 adventure-king 无尽古堡布局", () => {
  it("房间格上限按可视余量钳,默认仍 420", () => {
    expect(castleBoardCapPx(800)).toBe(420);
    expect(castleBoardCapPx(200)).toBe(200);
    expect(castleBoardCapPx(40)).toBe(140);
    expect(castleBoardCapPx(Number.NaN)).toBe(420);
  });

  it("playfield 矮横屏双栏、工具钮 sticky、D-pad 跟房间格同排", () => {
    expect(src).toContain("advk-playfield");
    expect(src).toMatch(/\.advk-tools\{[^}]*position:sticky/);
    expect(src).toMatch(/@media \(max-height:500px\) and \(min-width:700px\)/);
    expect(src).toContain("playfield.append(board, pad)");
    expect(src).toContain("fitCastleBoard()");
  });

  it("走廊引擎前缀 ak- 的 runner 结构不被古堡改动绑死", () => {
    expect(src).toContain('pad.className = "ak-pad"');
    expect(src).toContain("function createRunner");
  });
});
