import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SHEET = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf8");

describe("N-66 chess-garden 双人末行", () => {
  it("矮宽屏把棋盘收到 58dvh,r2-2 解锁格 min 仍在", () => {
    expect(SHEET).toContain(".cg-wrap .cg-sq {");
    expect(SHEET).toContain("min-width: 0");
    expect(SHEET).toContain("max-width: min(248px, 58dvh)");
    expect(SHEET).toContain(".cg-wrap .cg-tools");
    expect(SHEET).toContain("position: sticky");
  });
});
