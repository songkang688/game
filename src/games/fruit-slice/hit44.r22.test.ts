import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-125 / N-126 fruit-slice 热区", () => {
  it("菜单卡高下限 44", () => {
    expect(SRC).toContain("const cardH = Math.max(44, Math.min(88, (h * 0.66) / configs.length - 12))");
  });

  it("选园/选回合返回用 hit44 扩到 44,绘制仍可 32", () => {
    expect(SRC).toContain("function hit44");
    expect(SRC).toContain("inRect(x, y, hit44(btnBack))");
    expect(SRC).toContain("w: 70, h: 32");
  });
});
