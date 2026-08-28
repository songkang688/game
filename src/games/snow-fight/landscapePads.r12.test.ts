import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-55 snow-fight 双人十二键矮横屏并排", () => {
  it("矮横屏 :has(.snf-pad-duo) 把两块牌排到画布右侧", () => {
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain(".snf-wrap:has(.snf-pad-duo)");
    expect(SRC).toContain("flex-direction:row;flex-wrap:nowrap");
    expect(SRC).toContain("shortLandscapePads");
    expect(SRC).toContain("snf-pad-duo");
  });

  it("回合键与灯笼选择器仍在", () => {
    expect(SRC).toContain("bindHold");
    expect(SRC).toContain("snf-btn-throw");
    expect(SRC).toContain("snf-btn-scoop");
  });
});
