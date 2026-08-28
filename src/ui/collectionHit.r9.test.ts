import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./collection.ts", import.meta.url)), "utf8");

describe("收藏册热区 44px", () => {
  it(".collection-close 40→44", () => {
    expect(SRC).toMatch(/\.collection-close\{[^}]*width:44px/);
    expect(SRC).toMatch(/\.collection-close\{[^}]*height:44px/);
    expect(SRC).not.toMatch(/\.collection-close\{[^}]*width:40px/);
  });

  it(".card-btn min-height 36→44", () => {
    expect(SRC).toMatch(/\.card-btn\{[^}]*min-height:44px/);
    expect(SRC).not.toMatch(/\.card-btn\{[^}]*min-height:36px/);
  });
});
