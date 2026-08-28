import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-129 garden-guard 热区", () => {
  it("三处返回与升级/出售点按走 hit44", () => {
    expect(SRC).toContain("function hit44");
    expect(SRC.match(/hit44\(btnBack\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(SRC).toContain("hit44(panelUpgrade)");
    expect(SRC).toContain("hit44(panelSell)");
  });
});
