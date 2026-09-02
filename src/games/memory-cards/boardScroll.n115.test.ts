import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("N-115 memory-cards 矮横屏盘可滚", () => {
  it("N-69 钳卡高保留,盘加 overflow-y auto", () => {
    expect(SRC).toContain("@media (min-width: 640px) and (max-height: 500px)");
    expect(SRC).toContain(".mmc-board { gap: 4px; max-height: min(280px, 68dvh); overflow-y: auto; }");
    expect(SRC).toContain("height: clamp(48px, 16dvh, 72px)");
  });
});
