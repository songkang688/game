import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-72 lianliankan 关内盘面收高", () => {
  it("矮屏只钳 .llk-board 宽,洗牌/提示工具类还在", () => {
    expect(SRC).toContain("@media (max-height: 500px)");
    expect(SRC).toContain("max-width: min(420px, 78dvh)");
    expect(SRC).toContain("llk-shuffle");
    expect(SRC).toContain("llk-hintbtn");
  });
});
