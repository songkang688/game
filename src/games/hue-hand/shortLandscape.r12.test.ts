import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-8 hue-hand r12 矮屏抽牌排", () => {
  it("500px 高档把 .hh-btns 钉底(N-98 起 fixed 钉视口底,sticky 在 .l99-host 链失效)", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".hh-wrap > .hh-btns{position:fixed;");
  });

  it("N-98:矮横屏 .hh-wrap 自己开内滚,对手行/横幅滚得到", () => {
    const block = SRC.split("@media (max-height:500px)")[1] ?? "";
    expect(block).toContain(".hh-wrap{overflow-y:auto;overscroll-behavior:contain");
  });
});
