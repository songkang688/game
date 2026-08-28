import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DUO_PANE_FALLBACK, DUO_STAGE_MIN_H, STAGE_MIN_H, duoPaneHeightPx, stageHeightPx } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-54 hop-pads 双人同屏按块钳高", () => {
  it("余量够时按 (room − chrome − gap) / 2，量不出退回旧 236", () => {
    expect(duoPaneHeightPx(Number.NaN, 70)).toBe(DUO_PANE_FALLBACK);
    expect(duoPaneHeightPx(0, 70)).toBe(DUO_PANE_FALLBACK);
    expect(duoPaneHeightPx(340, 70, 8)).toBe(Math.floor((340 - 70 - 8) / 2));
    expect(duoPaneHeightPx(200, 80, 8)).toBe(DUO_STAGE_MIN_H);
  });

  it("单人 stageHeightPx 下限仍是 STAGE_MIN_H，双人挂载不再写死 236", () => {
    expect(stageHeightPx(460, 120, 40)).toBe(STAGE_MIN_H);
    expect(SRC).toContain("duoPaneHeightFromShell");
    expect(SRC).toContain("height: () => duoPaneHeightFromShell(shell)");
    expect(SRC).not.toMatch(/height:\s*236/);
  });
});
