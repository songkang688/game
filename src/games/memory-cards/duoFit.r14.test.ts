import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-69 memory-cards 双人轮流翻 · 915×412 钳卡高", () => {
  it("矮横屏取消 3/4 竖卡、卡高有上限,配对规则字符串不动", () => {
    expect(SRC).toContain("@media (min-width: 640px) and (max-height: 500px)");
    expect(SRC).toContain("aspect-ratio: auto");
    expect(SRC).toContain("height: clamp(48px, 16dvh, 72px)");
    expect(SRC).toContain('textContent = "👥 双人轮流翻"');
    expect(SRC).toContain("cols: 4");
  });
});
