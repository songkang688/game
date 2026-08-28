import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-126 sprout-defense 返回热区", () => {
  it("地图/局内返回走 hit44,绘制高度原文可小于 44", () => {
    expect(SRC).toContain("function hit44");
    expect(SRC).toContain("inRect(x, y, hit44(btnBack))");
    expect(SRC).toContain("h: 30");
    expect(SRC).toContain("h: 28");
  });
});
