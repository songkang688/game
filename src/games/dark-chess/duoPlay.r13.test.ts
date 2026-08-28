import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CSS } from "./view";

const IDX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

describe("N-65 dark-chess 双人同屏", () => {
  it("矮屏钳双人棋盘宽,取消/暂停钉底,单人壳不加 duoplay", () => {
    expect(CSS).toContain(".dc-duoplay .dc-board{max-width:min(280px,56dvh);}");
    expect(CSS).toContain(".dc-duoplay .dc-row{position:sticky;bottom:0");
    expect(IDX).toContain('opts.rival === "human" ? "dc-wrap dc-duoplay"');
  });
});
