import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { H, W } from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("C-2 brick-break 横屏画布钳高", () => {
  it("根容器让出竖滑，画布自己锁手势", () => {
    expect(SRC).toContain("touch-action: pan-y");
    expect(SRC).toMatch(/\.brk-canvas \{[^}]*max-height: calc\(100dvh - 168px\)/);
    expect(SRC).toMatch(/\.brk-canvas \{[^}]*touch-action: none/);
    expect(SRC).toContain(".brk-ctrl");
    expect(SRC).toContain("position: sticky; bottom: 0");
  });

  it("U-11 中高视口加一档更紧的画布预算,C-2 168 句仍在", () => {
    expect(SRC).toContain("@media (max-height: 840px)");
    expect(SRC).toContain("max-height: calc(100dvh - 248px)");
  });

  it("物理台面尺寸不动", () => {
    expect(W).toBe(360);
    expect(H).toBe(430);
  });
});
