import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-42 puff-bros 暂停与模式钮热区", () => {
  it("暂停钮与模式钮都不低于 44", () => {
    expect(SRC).toContain("export const TOUCH_MIN = 44");
    expect(SRC).toContain(".pfb-btn{");
    expect(SRC).toContain(".pfb-mode{");
    expect(SRC).toContain("min-height:${TOUCH_MIN}px");
  });

  it("矮横屏把方向垫挪到画布右侧（C-8 同款）", () => {
    expect(SRC).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SRC).toContain(".pfb-pads{grid-column:2");
    expect(SRC).toContain("flex-direction:column");
  });
});
