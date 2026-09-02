import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WELL_DISPLAY_MIN, WELL_DUO_MIN, wellDisplayPx } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-74 block-drop 双人井字 ≠ N-50 闯关七键", () => {
  it("叠井用更矮下限,分栏从 640 起,闯关键 sticky 另写", () => {
    expect(WELL_DUO_MIN).toBeLessThan(WELL_DISPLAY_MIN);
    expect(wellDisplayPx(488, 200, WELL_DUO_MIN)).toBe(200);
    expect(wellDisplayPx(488, 80, WELL_DUO_MIN)).toBe(WELL_DUO_MIN);
    expect(SRC).toContain("@media (min-width:640px)");
    expect(SRC).toContain(".bd-pad{position:sticky;bottom:0");
    expect(SRC).toContain("WELL_DUO_MIN");
  });
});
