import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 hue-hand r12 矮屏抽牌排", () => {
  it("500px 高档把 .hh-btns 钉底", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".hh-btns{position:sticky;bottom:0");
  });

  it("N-98 增量:840 档同样钉抽牌排", () => {
    expect(SRC).toContain("@media (max-height:840px)");
  });

  it("840 档轻收暗牌区,不盲拷 500 的 48px", () => {
    const at = SRC.indexOf("@media (max-height:840px) and (min-height:501px)");
    const next = SRC.indexOf("@media", at + 1);
    const block = SRC.slice(at, next > 0 ? next : undefined);
    expect(block).toContain(".hh-hidden{min-height:64px;}");
    expect(block).not.toContain("min-height:48px");
  });
});
