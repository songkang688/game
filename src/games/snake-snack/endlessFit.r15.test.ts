import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GRID } from "./levels";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-81 snake-snack 无尽花园矮横屏", () => {
  it("逻辑格边 26 不变,显示高钳住并钉方向键", () => {
    expect(GRID).toBe(13);
    expect(SRC).toContain("const CELL = 26;");
    expect(SRC).toContain("max-height: min(280px, 56dvh)");
    expect(SRC).toContain("@media (max-height: 500px)");
    expect(SRC).toContain(".sn-pad { position: sticky; bottom: 0");
  });
});
