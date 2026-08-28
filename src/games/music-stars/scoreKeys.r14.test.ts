/**
 * N-73(trio-r14 A):简谱视奏琴键切底。≠ 沙盒、≠ 仅芯片。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { MST_CSS } from "./ui";

const ADV = readFileSync(new URL("./advanced.ts", import.meta.url), "utf8");
const SANDBOX = readFileSync(new URL("./sandboxUi.ts", import.meta.url), "utf8");

describe("N-73 简谱视奏琴键收进 412", () => {
  it("第 167 关是 score 视奏,不是沙盒", () => {
    expect(LEVELS[166].mode).toBe("score");
    expect(SANDBOX).not.toContain("mst-scoreplay");
  });

  it("视奏壳钉键,芯片不进这一档", () => {
    expect(ADV).toContain('cfg.mode === "score" ? "mst-wrap mst-scoreplay"');
    expect(MST_CSS).toContain(".mst-wrap.mst-scoreplay .mst-keys{position:sticky;bottom:0");
    const at = MST_CSS.indexOf("@media (max-height:500px) and (min-width:640px)");
    expect(at).toBeGreaterThan(-1);
    const block = MST_CSS.slice(at, MST_CSS.indexOf("@media", at + 10));
    expect(block).not.toContain(".mst-chip");
  });
});
