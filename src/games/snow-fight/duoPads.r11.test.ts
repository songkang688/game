import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-55 snow-fight 双人十二键矮横屏并排", () => {
  it("双人垫挂 data-duo,500px 高档两块 3×2 牌并排", () => {
    expect(SRC).toContain('pads.setAttribute("data-duo", "1")');
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".snf-pads[data-duo]{display:grid;grid-template-columns:1fr 1fr");
  });

  it("不改回合/灯笼判定入口", () => {
    expect(SRC).toContain("stepArena");
  });
});
