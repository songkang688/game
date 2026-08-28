import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-121 fruit-catch 模式键触区", () => {
  it("开双人/无尽与回地图 min-height 44,不改左右篮钮 84×56", () => {
    expect(SRC).toMatch(/\.frc-open\s*\{[^}]*min-height:\s*44px/s);
    expect(SRC).toMatch(/\.frc-back\s*\{[^}]*min-height:\s*44px/s);
    const btn = /\.frc-btn\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/.exec(SRC);
    expect(btn).not.toBeNull();
    expect(Number(btn![1])).toBe(84);
    expect(Number(btn![2])).toBe(56);
  });
});
