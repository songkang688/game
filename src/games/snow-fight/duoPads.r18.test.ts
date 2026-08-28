/**
 * r18 · N-55 补账:双人对战十二键并排(r15)后,915×412 实测第二行 382–428 仍 FOLD
 * (双人 wrap 顶距 128,sticky 钉在 wrap 底 432)。照 N-75 麻将配方,
 * 只给 `data-duo` 的键排改 fixed 钉视口底;闯关 `.snf-pads`(N-85)零触碰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("r18 snow-fight 对战十二键钉视口底", () => {
  it("data-duo 键排 fixed 进 412,闯关 sticky 与 N-85 垫原样", () => {
    // r15 规则原样保留
    expect(SRC).toContain(".snf-pads[data-duo]{display:grid;grid-template-columns:1fr 1fr");
    expect(SRC).toContain(".snf-pads{position:sticky;bottom:0");
    expect(SRC).toContain("opts.humans === 1 ? 118 : 0");
    // 新增:只对双人生效的 fixed 钉底
    expect(SRC).toMatch(/\.snf-pads\[data-duo\]\{position:fixed;left:10px;right:10px;bottom:6px;/);
  });
});
