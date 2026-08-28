/** 三人组 r16 · N-86 大厅模式卡收高（≠ N-32 无尽战斗三钮） */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-86 brave-path 大厅模式卡", () => {
  it("矮横屏两列收高并藏说明,对战/备战仍走 .bvp-mode", () => {
    expect(SRC).toContain("对战 · 星星的队伍");
    expect(SRC).toContain("备战小屋");
    expect(SRC).toContain("el(\"button\", \"bvp-mode\")");
    const n86 = SRC.slice(SRC.indexOf("/* N-86"), SRC.indexOf(".bvp-hero-line"));
    expect(n86).toContain("@media (max-height:500px)");
    expect(n86).toContain("grid-template-columns:1fr 1fr");
    expect(n86).toContain(".bvp-mode-d{display:none;}");
  });

  it("无尽战斗 N-32 操作行 sticky 零回归", () => {
    expect(SRC).toContain('if (opts.onFlee) wrap.className = "bvp-endless-fight"');
    expect(SRC).toContain(".bvp-endless-fight .bvp-acts{");
    expect(SRC).toContain("position:sticky;bottom:0");
  });
});
