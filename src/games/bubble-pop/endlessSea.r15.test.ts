import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SEA_ROWS } from "./collapse";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-82 bubble-pop 无尽泡泡海矮横屏", () => {
  it("12 行逻辑不变,基线 min-width 36 保留,矮屏才收格", () => {
    expect(SEA_ROWS).toBe(12);
    expect(SRC).toContain("min-width: 36px");
    expect(SRC).toContain("@media (max-height: 500px)");
    expect(SRC).toContain(".bp-cell { min-width: 0; min-height: 0; }");
  });
});
